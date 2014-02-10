var $ = require("jquery"),
    authentication = require("./../../services/authentication"),
    tools = require("./../../services/tools"),
    Backbone = require("backbone"),
    IndexPageModel = require("./../../models/pages/index").IndexPageModel,
    Task = require("./../../models/task").Task,
    TaskView = require("./../task").TaskView,
    TaskModalView = require('./../taskModal').TaskModalView;

require("bootstrap");
require("bootstrap-switch");
require("bootstrap-tagsinput");
require("bootstrap-datetimepicker");

$(function() {
    // we could be running in an iframe after a silent reauthentication. just do nothing in that case
    if (window !== window.top)
       return;

    var data = JSON.parse($(".data").html());

    var page = new Page({
        model: new IndexPageModel(data),
        el: document.body
    });

    page.render();
    window.page = page;
});

var Page = Backbone.View.extend({
    initialize: function () {
        var model = this.model;
        this.listenTo(model, "change", this.onModelChange);

        this.taskViews = [];
        this.listenTo(model.tasks, "add", this.onTaskAdd);
        this.listenTo(model.tasks, "remove", this.onTaskRemove);
        this.listenTo(model.tasks, "sort", this.onTasksSort);

        this.$el.find("#loader").hide();
        this.$el.find("#addTask").focus();
        setInterval(function () { model.tasks.fetch().catch(tools.reportError); }, 300000);

        this.onDueTasksCountChange();
        this.listenTo(model, "change:dueTasksCount", this.onDueTasksCountChange);
    },
    events: {
        "click": "onDocumentClick",
        "click #logout": "onLogoutClick",
        "click #notifications": "onNotificationsClick",
        "click #devices": "onDevicesClick",
        "click #addTask": "onAddTaskClick",
        "click .actions .editTask": "onEditTaskClick",
        "click .task .removeTask": "onRemoveTaskConfirmClick",
        "click .popoverDelete .buttons button[type='submit']": "onRemoveTaskClick",
        "click .popoverDelete .buttons button[type='button']": "onDismissRemoveTaskClick",
        "mouseleave .task": "onTaskMouseleave"
    },

    onTaskAdd: function (task, tasks) {
        var index = tasks.indexOf(task);

        var taskView = new TaskView({
            model: task
        });

        this.$el.find("#tasks").insertAt(index, taskView.el);
        this.taskViews.splice(index, 0, taskView);
        taskView.render();

        $(taskView.el).addClass("fade-in");
        setTimeout(function () { $(taskView.el).removeClass("fade-in"); }, 1000);
    },
    onTaskRemove: function (task, tasks) {
        var taskView = _.find(this.taskViews, function (v) { return v.model === task; });
        taskView.$el.fadeOut(function () { taskView.$el.remove(); });
        this.taskViews = _.without(this.taskViews, taskView);
    },
    onTasksSort: function (tasks) {
        var self = this,
            $tasks = this.$el.find("#tasks");

        this.taskViews = _.sortBy(this.taskViews, function (v) { return self.model.tasks.indexOf(v.model); });
        var elements = _.pluck(this.taskViews, "el");
        $(_.sortBy($tasks.children(), function (el) { return elements.indexOf(el); })).appendTo($tasks);
    },

    render: function (recreate) {
        var self = this;

        if (recreate === false) {
            this.taskViews.forEach(function (taskView) { taskView.render(); });
            return;
        }

        var $tasks = this.$el.find("#tasks");
        $tasks.empty();

        this.taskViews = this.model.tasks.map(function (task) {
            var taskView = new TaskView({ model: task });
            $tasks.append(taskView.el);
            taskView.render();
            return taskView;
        });
    },
    onModelChange: function () {
        this.render(false);
    },
    onDocumentClick: function (event) {
        this.$el.find(".has-popover").each(function () {
            if (!$(this).is(event.target) && $(this).has(event.target).length === 0 && $(".popover").has(event.target).length === 0) {
                $(this).popover("destroy");
            }
        });
    },
    onLogoutClick: function (event) {
        event.preventDefault();

        this.model.logout()
            .then(function () {
                window.location.href = "/";
            }, tools.reportError);
    },
    onNotificationsClick: function (event) {
        event.preventDefault();

        $(event.currentTarget).popover({
            html: true,
            content: $("#notificationsTemplate").html(),
            placement: "auto",
            trigger: "manual"
        }).popover("show");

        var self = this;

        this.$el.find('.popoverNotifications input[type="checkbox"]')
            .prop("checked", this.model.areNotificationsActive())
            .on("change", function () {
                var cbx = this;
                self.model.setNotificationsActive(cbx.checked)
                    .then(function () {
                        cbx.checked = self.model.areNotificationsActive();
                    });
            });
    },
    onDevicesClick: function (event) {
        event.preventDefault();
        var $el = $(event.currentTarget);

        this.model.getDevices()
            .done(function (devices) {

                $el.popover({
                    html: true,
                    content: function () { return _.template($("#devices-template").html(), { devices: devices }); },
                    placement: "auto",
                    trigger: "manual"
                }).popover("show");

            }, tools.reportError);
    },

    onAddTaskClick: function () {
        var self = this,
            editedTask = new Task();

        authentication.assertAuthenticated().done(function () {
            self.taskModal = new TaskModalView({ model: editedTask });
            self.taskModal.show();
            self.taskModal.on("save", self.onTaskSave, self);
        });
    },
    onEditTaskClick: function (event) {
        var $task = $(event.currentTarget).closest(".task");
        var taskId = $task.attr("data-id");

        var self = this,
            task = this.model.tasks.getById(taskId),
            editedTask = task.clone();

        authentication.assertAuthenticated().done(function () {
            self.taskModal = new TaskModalView({ model: editedTask });
            self.taskModal.show();
            self.taskModal.on("save", self.onTaskSave, self);
        });
    },
    onRemoveTaskConfirmClick: function (event) {
        $(event.currentTarget).popover({
            html: true,
            content: $("#deleteTemplate").html(),
            placement: "left",
            trigger: "manual"
        }).popover("show");
    },
    onRemoveTaskClick: function (event) {
        var $task = $(event.currentTarget).closest(".task");
        var taskId = $task.attr("data-id");

        var self = this,
            task = this.model.tasks.getById(taskId);

        authentication.assertAuthenticated().done(function () {
            task.remove().done(function () {
                $task.find(".removeTask").popover("hide");
                self.model.tasks.remove(task);
            }, tools.reportError);
        });
    },
    onDismissRemoveTaskClick: function (event) {
        $(event.currentTarget).closest(".task").find(".removeTask").popover("hide");
    },
    onTaskMouseleave: function (event) {
        var $el = $(event.currentTarget);

        if ($el.find(".popover").length > 0)
            $el.find(".removeTask").popover("destroy");
    },
    onTaskSave: function() {
        var self = this;
        this.taskModal.model.save(this.model.tasks)
            .done(function () {
                self.taskModal.hide();
                self.taskModal = null;
            }, tools.reportError);
    },
    onDueTasksCountChange: function () {
        var count = this.model.dueTasksCount;
        if (count === 0)
            document.title = "Tasks";
        else
            document.title = "Tasks (" + count + ")";
    }
});