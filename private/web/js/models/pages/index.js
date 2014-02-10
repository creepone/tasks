var _ = require("underscore"),
    Backbone = require("backbone"),
    moment = require("moment"),
    ajax = require("../../services/ajax"),
    Notifications = require("../../services/notifications").Notifications,
    Task = require("../task").Task;

var _dateFormat = "DD.MM.YYYY HH:mm";

var Tasks = Backbone.Collection.extend({
    model: Task,
    url: "/sync/tasks",
    comparator: function (t) { return (t.reminder && t.reminder.time) || 0; },
    initialize: function() {
        this.listenTo(this, "change:reminder", this.sort);
    },
    getById: function(taskId) {
        return _.find(this.models, function (task) { return task._id === taskId });
    }
});

var IndexPageModel = Backbone.Model.extend({
    properties: "tasks,dueTasksCount",
    initialize: function () {
        var self = this;
        this.tasks = new Tasks(this.tasks || []);
        this.notifications = new Notifications({ tasks: this.tasks });

        this.dueTasksCount = this.notifications.dueTasksCount;
        this.listenTo(this.notifications, "change:dueTasksCount", function () {
            self.dueTasksCount = self.notifications.dueTasksCount;
        });
    },
    logout: function () {
        return ajax.logout()
            .then(function() {
                if (localStorage && localStorage.getItem("openid"))
                    localStorage.removeItem("openid");
            });
    },
    areNotificationsActive: function () {
        return this.notifications.isActive();
    },
    setNotificationsActive: function (active) {
        return this.notifications.setActive(active);
    },
    getDevices: function () {
        return ajax.getDeviceStats()
            .then(function (stats) {
                return stats.devices.map(function (device) {
                    var res = _.extend({}, device);
                    if (!res.version)
                        res.version = "never";
                    else
                        res.version = moment(new Date(res.version)).format(_dateFormat);
                    return res;
                });
            });
    }
});

_.extend(exports, {
    IndexPageModel: IndexPageModel
});