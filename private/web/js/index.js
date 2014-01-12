var $ = require("./lib/jquery"),
    URI = require("./lib/URI/URI"),
    Q = require("./lib/q.min"),
    ko = require("./lib/knockout"),
    moment = require("./lib/moment");

require("./lib/bootstrap");
require("./lib/bootstrap-switch");
require("./lib/bootstrap-tagsinput");
require("./lib/bootstrap-datetimepicker");

var notifications = require("./model/notifications");

var _query = URI(window.location.href).search(true),
    _viewModel,
    _dateFormat = "DD.MM.YYYY HH:mm";

$(function() {
    _services.getAuthInfo()
        .done(function(authInfo) {
            if (!authInfo.logged)
                return _authenticate();

            _createView();
            _createViewModel(authInfo);

            ko.applyBindings(_viewModel);
        }, _reportError);
});

function _createView()
{
    // reveal all the user-dependent UI
    $("#loader").hide();
    $(".needs-user").show();

    $('input[type="checkbox"]').bootstrapSwitch();

    // hack to convince moment english week starts on Monday
    moment()._lang._week.dow = 1;
    $(".input-group.date").datetimepicker({
        format: _dateFormat
    });
    $(".categories").tagsinput({
        tagClass: function() { return "label label-default"; }
    });

    $(".modal").on("shown.bs.modal", function () {
        $(".modal input:first").focus();
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

    $(document).on("click", '.popoverDelete .buttons button[type="submit"]', _onRemoveTaskClick);
    $(document).on("click", ".actions .editTask", _onEditTaskClick);

    $("#logout").click(_onLogoutClick);
    $("#devices").click(_onDevicesClick);
    $("#notifications").click(_onNotificationsClick);
    $("#addTask").on("click", _onAddTaskClick);
    $("#saveTask").on("click", _onSaveTaskClick);

    $("#addTask").focus();
}

function _createViewModel(authInfo)
{
    var tasks = JSON.parse($(".tasks").html());
    tasks = ko.observableArray(tasks.map(_convertFromServer));

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
        username: authInfo.name,
        tasks: tasks,
        editedTask: editedTask
    };

    _setupManualBindings();
    notifications.schedule(tasks);
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
}

function _createPatch(editedTask, task)
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

function _convertFromServer(task)
{
    task = $.extend({}, task);
    if (task.reminder)
        task.reminder.timeText = moment(new Date(task.reminder.time)).format(_dateFormat);
    return task;
}

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


function _onAddTaskClick()
{
    var task = _viewModel.editedTask;

    task._id("");
    task.name("");
    task.notes("");
    task.categories([]);
    task.reminderImportant(false);
    task.reminderTime(null);

    $(".modal").modal("show");
}

function _onEditTaskClick()
{
    var $task = $(this).closest(".task");
    var taskId = $task.attr("data-id");

    var task = _viewModel.tasks().filter(function (t) { return t._id == taskId; })[0];
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

    $(".modal").modal("show");
}

function _onSaveTaskClick()
{
    var editedTask = ko.toJS(_viewModel.editedTask);
    var task = _viewModel.tasks().filter(function (t) { return t._id == editedTask._id; })[0];

    var patch = _createPatch(editedTask, task);

    // nothing to save
    if (!patch)
    {
        $(".modal").modal("hide");
        return;
    }

    _services.submitPatch(patch)
        .done(function(data) {
            $(".modal").modal("hide");

            if (task)
                _viewModel.tasks.remove(task);

            _viewModel.tasks.push(_convertFromServer(data.task));
            _viewModel.tasks.sort(function (a, b) { return ((a.reminder && a.reminder.time) || 0) - ((b.reminder && b.reminder.time) || 0); });
        }, _reportError);
}

function _onRemoveTaskClick()
{
    var $task = $(this).closest(".task");
    var taskId = $task.attr("data-id");

    var patch = {
        operation: "remove",
        taskId: taskId
    };

    _services.submitPatch(patch)
        .done(function () {
            $task.find(".removeTask").popover("hide");
            $task.fadeOut(function () {
                _viewModel.tasks.remove(function (t) { return t._id == taskId });
            });
        }, _reportError);
}

function _onLogoutClick(event)
{
    event.preventDefault();

    _services.logout()
        .done(function() {
            window.location.href = URI(window.location.href).addSearch({ autoAuth: 0 }).toString();
        }, _reportError);
}

function _onDevicesClick(event)
{
    var that = this;
    event.preventDefault();

    _services.getDeviceStats()
        .then(function (stats) {
            if (stats.devices.length == 0)
                return;

            stats.devices = stats.devices.map(_convertDeviceFromServer);

            $(that).popover({
                html: true,
                content: function () { return _renderTemplate("devicesTemplate", stats); },
                placement: "auto",
                trigger: "manual"
            }).popover("show");
        });
}

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


function _authenticate()
{
    if (_query.autoAuth === "0")
    {
        window.location.href = "/authenticate";
        return;
    }

    // try to auto-authenticate with Google and Yahoo if possible
    var providers = ["https://www.google.com/accounts/o8/id", "http://me.yahoo.com/"];

    Q.allSettled(providers.map(_services.authenticate))
        .then(function(results) {
            var toAuth = results
                .filter(function (r) { return r.value && r.value.url; })
                .map(function (r) { return authenticateInIframe(r.value.url); });

            return Q.allSettled(toAuth);
        })
        .then(function() {
            return _services.getAuthInfo();
        })
        .done(function(authInfo) {
            if (authInfo && authInfo.logged)
                window.location.reload();
            else
                window.location.href = "/authenticate";
        },
        function() {
             window.location.href = "/authenticate";
        });

    function authenticateInIframe(url)
    {
        var deferred = Q.defer();
        $("<iframe />").hide().attr({ src: url }).on("load", function () { deferred.resolve(); }).appendTo("body");
        return deferred.promise.timeout(2000);
    }
}

function _ajax(o)
{
    return Q($.ajax(o))
        .then(function(data) {
            if (data.error)
                throw new Error(data.error);
            else
                return data;
        });
}

function _reportError(error)
{
    $("#alert").html("<div class=\"alert alert-danger fade in\">" +
        "<button type=\"button\" class=\"close\" data-dismiss=\"alert\">&times;</button>" +
        "Error occured when communicating with the server. </div>");

    setTimeout(function () { $("#alert .alert").alert("close"); }, 2000);
    console.log(error);
}

var _services = {
    getAuthInfo: function () {
        return _ajax({
            type: "GET",
            url: "/authenticate/info",
            dataType: "json"
        });
    },
    logout: function () {
        return _ajax({
            type: "GET",
            url: "/logout",
            dataType: "json"
        });
    },
    submitPatch: function (patch) {
        return _ajax({
            type: "POST",
            url: "/sync/submit",
            dataType: "json",
            data: JSON.stringify({ patch: patch }),
            contentType: "application/json; charset=utf-8"
        });
    },
    authenticate: function (provider) {
        var url = URI('/authenticate/init').addSearch({ openid: provider }).toString();
        return _ajax({
            type: "GET",
            url: url,
            dataType: "json"
        });
    },
    getDeviceStats: function () {
        return _ajax({
            type: "GET",
            url: "/devices/stats",
            dataType: "json"
        });
    }
};