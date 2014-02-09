var $ = require("jquery"),
    ko = require("knockout"),
    moment = require("moment"),
    ajax = require("./ajax"),
    notifications = require("./notifications");

var _tasks,
    _dateFormat = "DD.MM.YYYY HH:mm";

exports.init = function (tasks)
{
    _tasks = ko.observableArray(tasks.map(convertFromServer));

    $.extend(_tasks, {
        getById: getById,
        removeById: removeById,
        insert: insert
    });

    scheduleRefresh();
    notifications.schedule(_tasks);

    return _tasks;

    function getById(taskId)
    {
        return this().filter(function (t) { return t._id == taskId; })[0];
    }

    function removeById(taskId)
    {
        this.remove(function (t) { return t._id == taskId });
    }

    function insert(task)
    {
        if (!task) return;

        this.push(convertFromServer(task));
        this.sort(function (a, b) { return ((a.reminder && a.reminder.time) || 0) - ((b.reminder && b.reminder.time) || 0); });
    }
}

function convertFromServer(task)
{
    task = $.extend({}, task);
    if (task.reminder) {
        task.reminder.timeText = moment(new Date(task.reminder.time)).format(_dateFormat);
    }
    task.isDue = ko.observable(false);
    return task;
}

function scheduleRefresh()
{
    // update every 5 minutes
    setInterval(updateTasks, 300000);

    function updateTasks()
    {
        ajax.getTasks()
            .done(function (o) {
                _tasks.removeAll();
                o.forEach(function (task) {
                    _tasks.push(convertFromServer(task));
                });
            })
    }
}