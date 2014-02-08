var _ = require("underscore"),
    db = require("./db"),
    ObjectID = require("mongodb").ObjectID;

exports.deviceStats = function (req, res) {
    var userId = new ObjectID(req.session.userId);

    return db.findDevices({ userId: userId }, { lazy: false })
        .then(function (devices) {
            return db.getLastPatch({ userId: userId })
                .then(function (patch) {

                    var devicesToSend = devices.map(function (device) {
                        var needsSync = patch &&
                            (!device.version || device.toSync.length > 0 || !device.version.equals(patch.clientPatchId));

                        return {
                            name: device.name,
                            version: device.version && +device.version.getTimestamp(),
                            needsSync: needsSync
                        };
                    });

                    return { devices: devicesToSend };
                });
        })
        .then(function (result) {
            res.json(result);
        });
}