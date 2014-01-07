var _ = require("underscore"),
    db = require("./db"),
    Q = require("q"),
    ObjectID = require("mongodb").ObjectID,
    textMerge = require("./tools/textMerge");

exports.device =
{
    sync: function (req, res)
    {
        db.getDevice({ token: req.body.token })
            .then(function (device) {
                if (!device)
                    throw new Error("Device not found.");
                
                return _insertPatches(device, req.body.patches)
                    .then(function () {
                        return _mergePatches(device.userId);
                    })
                    .then(function () {
                        return _getDevicePatches(device);
                    })
                    .done(function (patches){
                        res.json({ patches: patches, toAcknowledge: device.toSync });
                    },
                    function (err) {
                        console.log(err);
                        res.send({ error: "Could not sync." });
                    });
            });
    },

    acknowledge: function (req, res)
    {
        db.getDevice({ token: req.body.token })
            .then(function (device) {
                if (!device)
                    throw new Error("Device not found.");

                var syncedIds = req.body.syncedIds.map(function (i) { return new ObjectID(i); });
                var version = req.body.lastPatchId && new ObjectID(req.body.lastPatchId);

                return db.updateDevice(
                {
                    _id: device._id
                },
                {
                    $pullAll: { toSync: syncedIds },
                    $set: { version: version }
                });
            })
            .done(function () {
                res.json({});
            },
            function (err) {
                console.log(err);
                res.send({ error: "Could not acknowledge the sync." });
            });

    }
};

exports.web =
{
    submit: function (req, res)
    {
        if (!req.session.userId)
            return res.send({ error: "Session expired."});

        var userId = new ObjectID(req.session.userId),
            patch = req.body.patch;
        
        return _insertPatches({ userId: userId }, [patch])
            .then(function () {
                return _mergePatches(userId);
            })
            .done(function () {
                // todo: return the task back ?
                res.json({});
            },
            function (err) {
                console.log(err);
                res.send({ error: "Could not submit the change." });
            });
    }
};


function _insertPatches(device, patches)
{
    var devices;
    var userId = device.userId;
    
    var inserts = patches.map(function (patch) {
        return insertPatch(patch);
    });

    function insertPatch(patch)
    {
        _.extend(patch, {
            _id: new ObjectID(),
            userId: userId,
            clientPatchId: new ObjectID(patch.clientPatchId),
            taskId: new ObjectID(patch.taskId),
            _applied: false
        });
        
        if (device._id)
            patch.deviceId = device._id;

        return db.getPatch({ clientPatchId: patch.clientPatchId })
            .then(function (duplicate)
            {
                if (duplicate)
                    return;

                return db.insertPatch(patch);
            })
            .then(function ()
            {
                var updates = devices.map(function (otherDevice) {
                    return markIfOutOfOrder(otherDevice, patch);
                });

                return Q.all(updates);
            });
    }

    function markIfOutOfOrder(otherDevice, patch)
    {
        if (device._id && otherDevice._id.equals(device._id))
            return;

        // the device will get this patch when syncing next time anyway
        if (!otherDevice.version || otherDevice.version.getTimestamp() < patch.clientPatchId.getTimestamp())
            return;

        return db.updateDevice({ _id: otherDevice._id }, { $push: { toSync: patch._id }});
    }

    return db.findDevices({ userId: userId }, { lazy: false })
        .then(function (foundDevices) {
            if (!foundDevices)
                throw new Error("Error loading devices.");

            devices = foundDevices;
        })
        .then(function () {
            return Q.all(inserts);
        });
}

function _getDevicePatches(device)
{
    var conditions = [];

    // send all the out-of-order patches
    device.toSync.forEach(function (toSyncId) {
        conditions.push({ _id: toSyncId });
    });

    var query = {
        userId: device.userId,
        deviceId: { "$ne": device._id }
    };

    if (device.version)
        query.clientPatchId = { "$gt": device.version };

    // send all the patches submitted later
    conditions.push(query);

    return db.findPatches({ $or: conditions }, { sort: ["clientPatchId"], lazy: false })
        .then(function (patches) {
            return patches.map(function (p) {
                    var res = _.extend({}, p);
                    delete res.deviceId;
                    delete res.userId;
                    delete res._applied;
                    return res;
                });
        });
}

function _mergePatches(userId)
{
    return db.findPatches({ userId: userId, _applied: false }, { lazy: false, sort: ["clientPatchId"] })
        .then(function (patches) {
            return mergeAll(patches)
                .then(function () { markAllDone(patches); });
        });

    function mergeAll(patches)
    {
        var taskMap = {},
            patchMap = _.object(["add", "edit", "remove"].map(function (operation) {
                return [operation, patches.filter(function(p) { return p.operation == operation; })];
            }));

        var inserts = patchMap["add"].map(function (p) { return insertTask(p); });
        var deletes = patchMap["remove"].map(function (p) { return deleteTask(p); });

        // do not apply updates on tasks we will delete
        var editPatches = patchMap["edit"].filter(function (p) {
            return !_.find(patchMap["remove"], function (removedP) {
                return removedP.taskId.equals(p.taskId);
            });
        });

        return Q.all(inserts)
            .then(function () {
                return Q.all(deletes);
            })
            .then(function () {
                var query = { $or: editPatches.map(function (p) { return { _id: p.taskId }; }) };

                if (query.$or.length == 0)
                    return [];

                return db.findTasks(query, { lazy: false });
            })
            .then(function (tasks){
                tasks.forEach(function (task) {
                    taskMap[task._id.toString()] = { task: task, patches: [] };
                });

                editPatches.forEach(function (patch) {
                    var o = taskMap[patch.taskId.toString()],
                        task = o.task;

                    if (task.lastClientPatchId && task.lastClientPatchId.getTimestamp() >= patch.clientPatchId.getTimestamp())
                        o.fullMerge = true;
                    else
                        o.patches.push(patch);
                });

                var merges = [];

                tasks.forEach(function (task) {
                    var o = taskMap[task._id.toString()];

                    if (o.fullMerge)
                        merges.push(fullMerge(task));
                    else
                        merges.push(simpleMerge(task, o.patches));
                });

                return Q.all(merges);
            });
    }
    
    function markAllDone(patches)
    {
        var updates = patches.map(function (patch) {
            return db.updatePatch({ _id: patch._id }, { $unset: { _applied: "" } });
        });
        
        return Q.all(updates);
    }
    
    function insertTask(patch)
    {
        var o = {
            _id: patch.taskId,
            userId: patch.userId,
            name: patch.body.name,
            categories: patch.body.categories,
            lastClientPatchId: patch.clientPatchId
        };

        if (patch.body.notes)
            o.notes = patch.body.notes;

        if (patch.body.reminder)
            o.reminder = patch.body.reminder;

        return db.getTask({ _id: patch.taskId })
            .then(function (task) {
                if (task) {
                    delete o._id;
                    return db.updateTask({ _id: patch.taskId }, { $set: o });
                }
                else
                    return db.insertTask(o);
            });
    }

    function deleteTask(patch)
    {
        return db.deleteTask({ _id: patch.taskId });
    }

    function simpleMerge(task, patches)
    {
        // apply the progression of patches onto the given task

        var update = {};

        if (patches.length == 0)
            return;

        patches.forEach(function (patch) {

            if (patch.body.name) {
                var name = patch.body.name,
                    currentName = update.name || task.name;
                update.name = textMerge.merge(name.old, currentName, name.new);
            }

            if (patch.body.notes) {
                var notes = patch.body.notes,
                    currentNotes = update.notes || task.notes;
                update.notes = textMerge.merge(notes.old, currentNotes, notes.new);
            }

            if (patch.body.reminder) {
                var reminder = patch.body.reminder;
                update.reminder = update.reminder || {};

                if ("important" in reminder)
                    update.reminder.important = reminder.important;
                if ("time" in reminder)
                    update.reminder.time = reminder.time;
            }

            if (patch.body.categories) {
                var categories = patch.body.categories;
                update.categories = update.categories || { add: [], remove: [] };

                if ("add" in categories) {
                    categories.add.forEach(function (toAdd) {
                        if (update.categories.add.indexOf(toAdd) < 0)
                            update.categories.add.push(toAdd);

                        var removedIndex = update.categories.remove.indexOf(toAdd);
                        if (removedIndex >= 0)
                            update.categories.remove.splice(removedIndex, 1);
                    });
                }

                if ("remove" in categories) {
                    categories.remove.forEach(function (toRemove) {
                        var addedIndex = update.categories.add.indexOf(toRemove);
                        if (addedIndex >= 0) {
                            update.categories.add.splice(addedIndex, 1);
                            return;
                        }

                        if (update.categories.remove.indexOf(toRemove) < 0)
                            update.categories.remove.push(toRemove);
                    })
                }
            }

        });

        var o = {}, $set = {};

        if ("name" in update)
            $set.name = update.name;
        if ("notes" in update)
            $set.notes = update.notes;
        if ("reminder" in update) {
            // removing the reminder
            if ("time" in update.reminder && update.reminder.time === null)
                o.$unset = { reminder: "" };
            else
            {
                $set.reminder = task.reminder || {};
                if ("important" in update.reminder)
                    $set.reminder.important = update.reminder.important;
                if ("time" in update.reminder)
                    $set.reminder.time = update.reminder.time;
            }
        }

        $set.lastClientPatchId = _.last(patches).clientPatchId;
        o.$set = $set;

        if ("categories" in update) {
            if ("add" in update.categories && update.categories.add.length > 0)
                o.$push = { categories: { $each: update.categories.add }};
            if ("remove" in update.categories && update.categories.remove.length > 0)
                o.$pullAll = { categories: update.categories.remove };
        }

        var task = { _id: task._id };

        // mongodb doesn't allow to push and pull in the same batch (for now)
        if (o.$push && o.$pullAll) {
            var $push = o.$push;
            delete o.$push;

            return db.updateTask(task, o)
                .then(function () {
                    return db.updateTask(task, { $push: $push });
                });
        }
        else
            return db.updateTask(task, o);
    }

    function fullMerge(task)
    {
        // recreate the task and apply all the patches from the database onto it
        
        return db.findPatches({ taskId: task._id }, { sort: [ "clientPatchId" ], lazy: false })
            .then(function (patches) {
                if (!patches)
                    throw new Error("Error loading patches.");

                if (patches[0].operation != "add")
                    throw new Error("Inconsistent history of a task.");

                return db.deleteTask({ _id: task._id })
                    .then(function () {
                        var insertPatch = patches.shift();
                        return insertTask(insertPatch);
                    })
                    .then(function () {
                        return simpleMerge(task, patches);
                    });
            });
    }
}