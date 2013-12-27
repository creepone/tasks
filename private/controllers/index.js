var db = require("../db"),
    Q = require("q"),
    ObjectID = require("mongodb").ObjectID;

exports.render = function (req, res)
{
    if (!req.session.userId)
        return res.render("index");

    db.findTasks({ userId: new ObjectID(req.session.userId) })
        .then(function(cursor) {
            var deferred = Q.defer();
            cursor.toArray(deferred.makeNodeResolver());
            return deferred.promise;
        })
        .then(function(tasks) {
            res.render("index", {
                tasks: tasks
            });
        })
        .fail(function (err) {
            console.log(err);
            res.render("error");
        })
};

exports.renderError = function (req, res) {
    res.render("error");
}