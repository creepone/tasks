var _ = require("underscore"),
    Backbone = require("backbone"),
    ajax = require("../../model/ajax"),
    Task = require("../task").Task;

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
    properties: "tasks",
    initialize: function() {
        this.tasks = new Tasks(this.tasks || []);
    },
    logout: function () {
        return ajax.logout()
            .then(function() {
                if (localStorage && localStorage.getItem("openid"))
                    localStorage.removeItem("openid");
            });
    }
});

_.extend(exports, {
    IndexPageModel: IndexPageModel
});