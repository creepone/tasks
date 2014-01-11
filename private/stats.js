var _ = require("underscore"),
    db = require("./db"),
    ObjectID = require("mongodb").ObjectID;

exports.deviceStats = function (req, res) {
    if (!req.session.userId)
        return res.send({ error: "Session expired."});

    var userId = new ObjectID(req.session.userId);

    db.findDevices({ userId: userId }, { lazy: false })
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
        .done(function (result) {
            res.json(result);
        },
        function (err) {
            console.log(err);
            res.send({ error: "Could not get the device info." });
        });
}