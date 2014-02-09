var db = require("../db"),
    Q = require("q"),
    ObjectID = require("mongodb").ObjectID;

exports.render = function (req, res) {
    return db.findTasks({ userId: new ObjectID(req.session.userId) }, { sort: [ "reminder.time" ], lazy: false })
        .then(function(tasks) {
            res.render("index", {
                username: req.session.username,
                data: {
                    tasks: tasks
                }
            });
        });
};

exports.renderError = function (req, res) {
    res.render("error");
}