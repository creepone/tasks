var $ = require("jquery"),
    Q = require("q"),
    ko = require("knockout"),
    moment = require("moment"),
    ajax = require("./model/ajax"),
    authentication = require("./model/authentication"),
    tools = require("./model/tools"),
    Backbone = require("backbone"),
    IndexPageModel = require("./models/pages/index").IndexPageModel,
    Task = require("./models/task").Task,
    TaskView = require("./views/task").TaskView,
    TaskModalView = require('./views/taskModal').TaskModalView;

require("bootstrap");
require("bootstrap-switch");
require("bootstrap-tagsinput");
require("bootstrap-datetimepicker");

/*var _data, _viewModel,
    _dateFormat = "DD.MM.YYYY HH:mm";*/

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

    // _data = JSON.parse($(".data").html());

    _createView();
    // _createViewModel();
    // ko.applyBindings(_viewModel);
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

        this.$el.find("#tasks").empty();

        var tasks = this.model.tasks;
        tasks.each(function (task) {
            self.onTaskAdd(task, tasks);
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

function _createView()
{
    // reveal all the user-dependent UI
    // $("#loader").hide();

    // $('input[type="checkbox"]').bootstrapSwitch();

    // hack to convince moment english week starts on Monday
    /*moment()._lang._week.dow = 1;
    $(".input-group.date").datetimepicker({
        format: _dateFormat
    });
    $(".categories").tagsinput({
        tagClass: function() { return "label label-default"; }
    });

    $(".modal").on("shown.bs.modal", function () {
        $(".modal input:first").focus();
    });

    $(document).on("keydown", ".input-group.date input", function (event) {
        if (event.keyCode == 13) {
            event.stopPropagation();
            _transformDate(this);
        }
        else if (event.keyCode == 9)
            _transformDate(this);
    });

    $(document).on("focus", ".bootstrap-tagsinput input", function () {
        $(".bootstrap-tagsinput").addClass("focus");
    });

    $(document).on("blur", ".bootstrap-tagsinput input", function () {
        $(".bootstrap-tagsinput").removeClass("focus");

        if ($(this).val()) {
            $(".categories").tagsinput("add", $(this).val());
            $(this).val("");
        }
    });


    $(document).on("click", function (e) {
        $(".has-popover").each(function () {
            if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $(".popover").has(e.target).length === 0) {
                $(this).popover("destroy");
            }
        });
    });

    

    $(document).on("click", ".task .removeTask", function () {
        $(this).popover({
            html: true,
            content: $("#deleteTemplate").html(),
            placement: "left",
            trigger: "manual"
        }).popover("show");
    });

    $(document).on("click", '.popoverDelete .buttons button[type="button"]', function () {
        $(this).closest(".task").find(".removeTask").popover("hide");
    });

    $(document).on("mouseleave", ".task", function () {
       if ($(this).find(".popover").length > 0)
           $(this).find(".removeTask").popover("destroy");
    });
    */
    // $(document).on("click", '.popoverDelete .buttons button[type="submit"]', _onRemoveTaskClick);

    // $(document).on("click", ".actions .editTask", _onEditTaskClick);

    // $("#logout").click(_onLogoutClick);
    $("#devices").click(_onDevicesClick);
    // $("#notifications").click(_onNotificationsClick);
    // $("#addTask").on("click", _onAddTaskClick);
    // $("#saveTask").on("click", _onSaveTaskClick);

    // $("#addTask").focus();
}

/*function _createViewModel()
{
    var editedTask = {
        _id: ko.observable(),
        name: ko.observable(),
        notes: ko.observable(),
        categories: ko.observable([]),
        reminderImportant: ko.observable(false),
        reminderTime: ko.observable(null),
        modalHeader: function () { return this._id() ? "Edit Task" : "Add New Task" }
    };

    _viewModel = {
        username: _data.username,
        tasks: tasks.init(_data.tasks),
        editedTask: editedTask
    };
    
    _setupManualBindings();
}

function _setupManualBindings()
{
    // because of using custom controls, we can't bind automatically in some cases

    var setting;

    _viewModel.editedTask.reminderImportant.subscribe(function (value) {
        if (!setting)
            $('input[type="checkbox"]').bootstrapSwitch("setState", value);
    });

    _viewModel.editedTask.reminderTime.subscribe(function (value) {
        if (!setting) {
            $(".input-group.date").data("DateTimePicker").setDate(value);
            if (!value)
                $(".input-group.date input").val("");
        }
    });

    _viewModel.editedTask.categories.subscribe(function (value) {
        value = value || [];

        if (!setting) {
            $(".categories").tagsinput("removeAll");
            value.forEach(function (category) { $(".categories").tagsinput("add", category); });
        }
    });

    $('input[type="checkbox"]').on("switch-change", function (e, data) {
        setting = true;
        _viewModel.editedTask.reminderImportant(data.value);
        setting = false;
    });

    $(".input-group.date input").on("change", function () {
        setTimeout(function () {
            setting = true;
            var value = $(".input-group.date").data("DateTimePicker").getDate();
            _viewModel.editedTask.reminderTime(value);
            setting = false;
        }, 1);
    });

    $(".input-group.date").on("change.dp", function (e) {
        setting = true;
        _viewModel.editedTask.reminderTime(e.date);
        setting = false;
    });

    $(".categories").on("change", function () {
        var value = $(this).val();
        var placeholder = value ? "" : "Categories";
        $(".bootstrap-tagsinput input").attr({ placeholder: placeholder });

        var categories = value ? value.split(",") : [];
        setting = true;
        _viewModel.editedTask.categories(categories);
        setting = false;
    });
    

    updateNotificationsCount(notifications.dueTasksCount());
    notifications.dueTasksCount.subscribe(updateNotificationsCount);

    function updateNotificationsCount(count) {
        if (count === 0)
            document.title = "Tasks";
        else
            document.title = "Tasks (" + count + ")";
    }
}
*/

/*function _createPatch(editedTask, task)
{
    var patch = {};

    if (!task) {
        patch.operation = "add";
        patch.body = {
            name: editedTask.name,
            notes: editedTask.notes,
            categories: editedTask.categories
        };

        if (editedTask.reminderTime) {
            patch.body.reminder = {
                time: +editedTask.reminderTime.toDate(),
                important: editedTask.reminderImportant
            };
        }
    }
    else {
        patch.operation = "edit";
        patch.taskId = task._id;
        patch.body = {};

        if (editedTask.name !== task.name)
            patch.body.name = { old: task.name, new: editedTask.name };

        if (editedTask.notes !== task.notes)
            patch.body.notes = { old: task.notes, new: editedTask.notes };

        var categoriesDiff = _arrayDiff(task.categories, editedTask.categories);
        if (categoriesDiff)
            patch.body.categories = categoriesDiff;

        if (editedTask.reminderTime) {
            var editedTime = +editedTask.reminderTime.toDate();
            var editedImportant = editedTask.reminderImportant;

            var time = task.reminder && task.reminder.time;
            var important = !!(task.reminder && task.reminder.important);

            if (editedTime !== time || editedImportant !== important)
                patch.body.reminder = {};

            if (editedTime !== time)
                patch.body.reminder.time = editedTime;
            if (editedImportant !== important)
                patch.body.reminder.important = editedImportant;
        }
        else if (task.reminder) {
            patch.body.reminder = { time: null }
        }
    }

    // nothing has changed => no need to submit a patch
    if (Object.keys(patch.body).length == 0)
        return undefined;

    return patch;
}

function _arrayDiff(oldArray, newArray)
{
    var toAdd = newArray.filter(function (i) { return oldArray.indexOf(i) < 0; });
    var toRemove = oldArray.filter(function(i) { return newArray.indexOf(i) < 0; });

    if (toAdd.length == 0 && toRemove.length == 0)
        return undefined;

    var res = {};
    if (toAdd.length > 0)
        res.add = toAdd;
    if (toRemove.length > 0)
        res.remove = toRemove;
    return res;
}
*/

function _convertDeviceFromServer(device)
{
    device = $.extend({}, device);
    if (!device.version)
        device.version = "never";
    else
        device.version = moment(new Date(device.version)).format(_dateFormat);
    return device;
}

function _renderTemplate(name, data)
{
    var temp = $("<div>");
    ko.applyBindingsToNode(temp[0], { template: { name: name, data: data } });
    var html = temp.html();
    temp.remove();
    return html;
}

/*
function _transformDate(input)
{ 
	var patterns = {
		offsetMinutes: /^\+\d+$/,
		offsetHoursMinutes: /^\+(\d){1,2}:\d\d$/,
		todayHoursMinutes: /^(today\s+)?(\d){1,2}:\d\d$/,
        tomorrowHoursMinute: /^tomorrow\s+(\d){1,2}:\d\d$/i
	};
	
    var val = $(input).val();
    if (!val || !Object.keys(patterns)
		.some(function (k) { return patterns[k].test(val); }))
        return;

    var shiftedVal = val;

    if (patterns.offsetMinutes.test(val))
    {
        var minutes = parseInt(val, 10);
        shiftedVal = moment()
            .add({ minutes: minutes });
    }
    else if (patterns.offsetHoursMinutes.test(val))
    {
        var parsed = moment(val, "HH:mm");
        shiftedVal = moment()
            .add({ hours: parsed.hours(), minutes: parsed.minutes() });
    }
    else if (patterns.todayHoursMinutes.test(val))
	{
		shiftedVal = moment(val, "HH:mm");
	}
    else if (patterns.tomorrowHoursMinute.test(val))
    {
        var parsed = moment(val, "HH:mm");
        shiftedVal = moment()
            .add({ days: 1 })
            .startOf("day")
            .add({ hours: parsed.hours(), minutes: parsed.minutes() });
    }

    _viewModel.editedTask.reminderTime(shiftedVal);
}



function _onAddTaskClick()
{
    var task = _viewModel.editedTask;

    task._id("");
    task.name("");
    task.notes("");
    task.categories([]);
    task.reminderImportant(false);
    task.reminderTime(null);

    authentication.assertAuthenticated().done(function () {
        $("#oldModal").modal("show");
    });
}

function _onEditTaskClick()
{
    var $task = $(this).closest(".task");
    var taskId = $task.attr("data-id");

    var task = _viewModel.tasks.getById(taskId);
    var taskVm = _viewModel.editedTask;

    taskVm._id(taskId);
    taskVm.name(task.name);
    taskVm.notes(task.notes);
    taskVm.categories(task.categories);
    taskVm.reminderImportant(task.reminder && task.reminder.important);

    if (task.reminder)
        taskVm.reminderTime(moment(new Date(task.reminder.time)));
    else
        taskVm.reminderTime(null);

    authentication.assertAuthenticated().done(function () {
        $("#oldModal").modal("show");
    });
}

function _onSaveTaskClick()
{
    var editedTask = ko.toJS(_viewModel.editedTask);
    var task = _viewModel.tasks.getById(editedTask._id);

    var patch = _createPatch(editedTask, task);

    // nothing to save
    if (!patch)
    {
        $(".modal").modal("hide");
        return;
    }

    ajax.submitPatch(patch)
        .done(function(data) {
            $(".modal").modal("hide");

            if (task)
                _viewModel.tasks.remove(task);

            if (data.task)
                _viewModel.tasks.insert(data.task);

        }, tools.reportError);
}

function _onRemoveTaskClick()
{
    var $task = $(this).closest(".task");
    var taskId = $task.attr("data-id");

    var patch = {
        operation: "remove",
        taskId: taskId
    };

    ajax.submitPatch(patch)
        .done(function () {
            $task.find(".removeTask").popover("hide");
            $task.fadeOut(function () {
                _viewModel.tasks.removeById(taskId);
            });
        }, tools.reportError);
}


function _onLogoutClick(event)
{
    event.preventDefault();

    ajax.logout()
        .done(function() {
            if (localStorage && localStorage.getItem("openid"))
                localStorage.removeItem("openid");
            window.location.href = "/";
        }, tools.reportError);
}

*/

function _onDevicesClick(event)
{
    var that = this;
    event.preventDefault();

    ajax.getDeviceStats()
        .then(function (stats) {
            stats.devices = stats.devices.map(_convertDeviceFromServer);

            $(that).popover({
                html: true,
                content: function () { return _renderTemplate("devicesTemplate", stats); },
                placement: "auto",
                trigger: "manual"
            }).popover("show");
        });
}

/*
function _onNotificationsClick(event)
{
    event.preventDefault();

    $(this).popover({
        html: true,
        content: $("#notificationsTemplate").html(),
        placement: "auto",
        trigger: "manual"
    }).popover("show");

    $('.popoverNotifications input[type="checkbox"]')
        .prop("checked", notifications.isActive())
        .on("change", function () {
            var that = this;

            notifications.setActive(this.checked)
                .then(function () {
                    that.checked = notifications.isActive();
                });
        });
}
*/