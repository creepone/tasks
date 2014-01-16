var db = require("../db"),
    Q = require("q"),
    ObjectID = require("mongodb").ObjectID;

exports.render = function (req, res)
{
    if (!req.session.userId)
        return res.render("index", {
            data: {
                logged: false
            }
        });

    db.findTasks({ userId: new ObjectID(req.session.userId) }, { sort: [ "reminder.time" ], lazy: false })
        .done(function(tasks) {
            res.render("index", {
                data: {
                    logged: true,
                    username: req.session.username,
                    tasks: tasks
                }
            });
        },
        function (err) {
            console.log(err);
            res.render("error");
        });
};

exports.renderError = function (req, res) {
    res.render("error");
}