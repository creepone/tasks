var $ = require("jquery"),
    authentication = require("../../services/authentication"),
    tools = require("../../services/tools"),
    Backbone = require("backbone"),
    IndexPageModel = require("../../models/pages/index").IndexPageModel,
    Task = require("../../models/task").Task,
    TaskView = require("../task").TaskView,
    TaskModal = require("../../models/taskModal").TaskModal,
    TaskModalView = require("../taskModal").TaskModalView,
    CategoriesView = require("../categories").CategoriesView;

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

        this.listenTo(model.categories, "change:selected", this.onCategoriesSelectionChange);

        this.$("#loader").hide();
        this.$("#addTask").focus();
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

        this.$("#tasks").insertAt(index, taskView.el);
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
            $tasks = this.$("#tasks");

        this.taskViews = _.sortBy(this.taskViews, function (v) { return self.model.tasks.indexOf(v.model); });
        var elements = _.pluck(this.taskViews, "el");
        $(_.sortBy($tasks.children(), function (el) { return elements.indexOf(el); })).appendTo($tasks);
    },
    onCategoriesSelectionChange: function () {
        this.render(false);
    },

    render: function (recreate) {
        var self = this,
            filter = this.model.getTaskFilter();

        if (recreate === false) {
            this.taskViews.forEach(function (taskView) { 
                taskView.render();
                $(taskView.el).toggle(!!filter(taskView.model));
            });
            return;
        }

        this.$("#categories").empty();
        var categoriesView = new CategoriesView({ model: this.model.categories });
        this.$("#categories").append(categoriesView.el);
        categoriesView.render();
        this.categoriesView = categoriesView;

        var $tasks = this.$("#tasks");
        $tasks.empty();

        this.taskViews = this.model.tasks.map(function (task) {
            var taskView = new TaskView({ model: task });
            $(taskView.el).toggle(!!filter(task)).appendTo($tasks);
            taskView.render();
            return taskView;
        });
    },
    onModelChange: function () {
        this.render(false);
    },
    onDocumentClick: function (event) {
        this.$(".has-popover").each(function () {
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

        this.$('.popoverNotifications input[type="checkbox"]')
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
        var task = new Task();
        task.categories = this.model.getSelectedCategories();
        this._showTaskModal(task);
    },
    onEditTaskClick: function (event) {
        var $task = $(event.currentTarget).closest(".task");
        var taskId = $task.attr("data-id");
        var task = this.model.tasks.getById(taskId);

        this._showTaskModal(task.clone());
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
    onDueTasksCountChange: function () {
        var count = this.model.dueTasksCount;
        if (count === 0)
            document.title = "Tasks";
        else
            document.title = "Tasks (" + count + ")";
    },

    _showTaskModal: function (task) {
        var self = this;

        authentication.assertAuthenticated().done(function () {
            var model = new TaskModal({ task: task, tasks: self.model.tasks, categories: self.model.categories });
            var taskModal = new TaskModalView({ model: model });
            taskModal.show();
        });
    }
});