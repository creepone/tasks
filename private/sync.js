var _ = require("underscore"),
    db = require("./db"),
    Q = require("q"),
    ObjectID = require('mongodb').ObjectID;

exports.device =
{
    sync: function (req, res)
    {
        var device;

        db.getDevice({ token: req.body.token })
            .then(function (foundDevice) {
                if (!foundDevice)
                    throw new Error("Device not found.");

                device = foundDevice;
            })
            .then(function () {
                return _insertDevicePatches(device, req.body.patches);
            })
            .then(function () {
                return _getDevicePatches(device, req.body.lastPatchId);
            })
            .then(function (patches){
                // todo: start the merge process in the background
                res.json({ patches: patches });
            })
            .fail(function (err) {
                res.send(500);
            });
    }
};


function _insertDevicePatches(device, patches)
{
    var inserts = patches.map(function (patch) {
        return insertPatch(patch);
    });

    function insertPatch(patch)
    {
        _.extend(patch, {
            userId: device.userId,
            deviceId: device._id,
            clientPatchId: new ObjectID(patch.clientPatchId),
            taskId: new ObjectID(patch.taskId)
        });

        return db.getPatch({ clientPatchId: patch.clientPatchId })
            .then(function (duplicate)
            {
                if (duplicate)
                    return;

                return db.insertPatch(patch);
            });
    }

    return Q.all(inserts);
}

function _getDevicePatches(device, lastPatchId)
{
    var query = {
        userId: device.userId,
        deviceId: { "$ne": device._id }
    };

    if (lastPatchId)
        query.clientPatchId = { "$gt": lastPatchId };

    return db.findPatches(query)
        .then(function (cursor){
            var deferred = Q.defer();
            cursor.toArray(deferred.makeNodeResolver());
            return deferred.promise;
        });
}