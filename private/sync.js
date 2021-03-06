var _ = require("underscore"),
    db = require("./db"),
    Q = require("q"),
    ObjectID = require("mongodb").ObjectID,
    apn = require("apn"),
    textMerge = require("./tools/textMerge");

exports.device =
{
    sync: function (req, res)
    {
        var device = req.device;

        return _insertPatches(device, req.body.patches)
            .then(function () {
                return _mergePatches(device.userId);
            })
            .then(function () {
                return _getDevicePatches(device);
            })
            .then(function (patches){
                res.json({ patches: patches, toAcknowledge: device.toSync });
            });
    },

    acknowledge: function (req, res)
    {
        var device = req.device;

        var syncedIds = req.body.syncedIds.map(function (i) { return new ObjectID(i); });
        var version = req.body.lastPatchId && new ObjectID(req.body.lastPatchId);

        return db.updateDevice({ _id: device._id },
            {
                $pullAll: { toSync: syncedIds },
                $set: { version: version }
            })
            .then(function () {
                res.json({});
            });
    },

    setApnToken: function (req, res)
    {
        var device = req.device;

        return db.updateDevice({ _id: device._id },
            {
                $set: { apnToken: req.body.apnToken }
            })
            .then(function() {
                res.json({});
            });
    },
    
    monitor: _monitorDevices
};

exports.web =
{
    submit: function (req, res)
    {
        var userId = new ObjectID(req.session.userId),
            patch = req.body.patch;
        
        return _insertPatches({ userId: userId }, [ patch ])
            .then(function () {
                return _mergePatches(userId);
            })
            .then(function () {
                if (patch.operation == "delete")
                    return { _id: patch.taskId };
                else
                    return db.getTask({ _id: patch.taskId });
            })
            .then(function (task) {
                res.json({ task: _taskToClient(task) });
            });
    },

    getTasks: function (req, res)
    {
        return db.findTasks({ userId: new ObjectID(req.session.userId) }, { sort: [ "reminder.time" ], lazy: false })
            .then(function(tasks) {
                res.send(tasks.map(_taskToClient));
            });
    },
    
    notifyAll: function (req, res) {
        return db.findDevices({ userId: new ObjectID(req.session.userId) }, { lazy: false })
            .then(function (devices) {
                var devicesToNotify = (devices || []).filter(function (device) {
                    return !!device.apnToken;
                });

                if (devicesToNotify.length > 0)
                    _notifyDevices(devicesToNotify);
                    
                res.json({});
            });
    }
};


function _insertPatches(device, patches)
{
    var devices;
    var userId = device.userId;

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


    if (!patches.length)
        return Q();

    return db.findDevices({ userId: userId }, { lazy: false })
        .then(function (foundDevices) {
            if (!foundDevices)
                throw new Error("Error loading devices.");

            devices = foundDevices;
        })
        .then(function () {
            return Q.all(patches.map(function (patch) {
                return insertPatch(patch);
            }));
        })
        .then(function () {
            var devicesToNotify = devices.filter(function (otherDevice) {
                if (device._id && otherDevice._id.equals(device._id))
                    return false;
                return !!otherDevice.apnToken;
            });

            if (devicesToNotify.length > 0)
                return _notifyDevices(devicesToNotify);
        })
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
                        task = o && o.task;

                    if (!o) return;

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
            categories: patch.body.categories || [],
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

function _notifyDevices(devices)
{
    var apnConn = new apn.Connection({
        cert: new Buffer(process.env.CERT_PEM, "base64"),
        key: new Buffer(process.env.KEY_PEM, "base64")
    });

    devices.forEach(function (device) {
        console.log("notifying device " + device.apnToken);
        
        var apnDevice = new apn.Device(device.apnToken);
        var note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // valid for 1 hour
        note.contentAvailable = true;
        note.sound = "";
        apnConn.pushNotification(note, apnDevice);
    });
}

function _monitorDevices() {
    var options = {
        batchFeedback: true,
        interval: 300,
        cert: new Buffer(process.env.CERT_PEM, "base64"),
        key: new Buffer(process.env.KEY_PEM, "base64")
    };

    var feedback = new apn.Feedback(options);
    feedback.on("feedback", function(devices) {
        console.log("notification feedback");
        
        devices.forEach(function(item) {
            console.log("notification feedback received for " + item.device);
        });
    });
}


function _taskToClient(task)
{
    var clientTask = _.extend({}, task);
    delete clientTask.userId;
    delete clientTask.lastClientPatchId;
    clientTask.reminder = clientTask.reminder || null;
    return clientTask;
}