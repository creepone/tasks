var _ = require("underscore"),
    moment = require("moment"),
    Backbone = require("backbone"),
    Q = require("q"),
    ajax = require("../model/ajax");

var _dateFormat = "DD.MM.YYYY HH:mm";

var Task = Backbone.Model.extend({
    properties: "_id,name,notes,categories,reminder",
    idAttribute: "_id",

    timeText: function () {
        if (!this.reminder)
            return "";
        return moment(new Date(this.reminder.time)).format(_dateFormat);
    },
    transformDate: function (value) {
        var patterns = {
            offsetMinutes: /^\+\d+$/,
            offsetHoursMinutes: /^\+(\d){1,2}:\d\d$/,
            todayHoursMinutes: /^(today\s+)?(\d){1,2}:\d\d$/,
            tomorrowHoursMinute: /^tomorrow\s+(\d){1,2}:\d\d$/i
        };

        if (!value || !Object.keys(patterns)
            .some(function (k) { return patterns[k].test(value); }))
            return;

        var shiftedVal;

        if (patterns.offsetMinutes.test(value))
        {
            var minutes = parseInt(value, 10);
            shiftedVal = moment()
                .add({ minutes: minutes });
        }
        else if (patterns.offsetHoursMinutes.test(value))
        {
            var parsed = moment(value, "HH:mm");
            shiftedVal = moment()
                .add({ hours: parsed.hours(), minutes: parsed.minutes() });
        }
        else if (patterns.todayHoursMinutes.test(value))
        {
            shiftedVal = moment(value, "HH:mm");
        }
        else if (patterns.tomorrowHoursMinute.test(value))
        {
            var parsed = moment(value, "HH:mm");
            shiftedVal = moment()
                .add({ days: 1 })
                .startOf("day")
                .add({ hours: parsed.hours(), minutes: parsed.minutes() });
        }

        return +shiftedVal;
    },
    save: function (tasks) {
        var exTask = tasks.getById(this._id);
        var patch = this._createPatch(exTask);
        if (!patch)
            return Q();

        return ajax.submitPatch(patch)
            .then(function(data) {
                if (exTask)
                    exTask.set(data.task);
                else
                    tasks.add(new Task(data.task));
            });
    },
    remove: function () {
        var patch = {
            operation: "remove",
            taskId: this._id
        };

        return ajax.submitPatch(patch);
    },
    clone: function () {
        var cloned = JSON.parse(JSON.stringify(this));
        return new Task(cloned);
    },
    _createPatch: function (exTask) {
        var patch = {};

        if (!this._id) {
            patch.operation = "add";
            patch.body = {
                name: this.name,
                notes: this.notes,
                categories: this.categories
            };

            if (this.reminder && this.reminder.time) {
                patch.body.reminder = this.reminder;
            }
        }
        else {
            patch.operation = "edit";
            patch.taskId = this._id;
            patch.body = {};

            if (this.name !== exTask.name)
                patch.body.name = { old: exTask.name, new: this.name };

            if (this.notes !== exTask.notes)
                patch.body.notes = { old: exTask.notes, new: this.notes };

            var categoriesDiff = this._arrayDiff(exTask.categories, this.categories);
            if (categoriesDiff)
                patch.body.categories = categoriesDiff;

            if (this.reminder && this.reminder.time) {
                var editedTime = this.reminder.time;
                var editedImportant = !!this.reminder.important;

                var time = exTask.reminder && exTask.reminder.time;
                var important = !!(exTask.reminder && exTask.reminder.important);

                if (editedTime !== time || editedImportant !== important)
                    patch.body.reminder = {};

                if (editedTime !== time)
                    patch.body.reminder.time = editedTime;
                if (editedImportant !== important)
                    patch.body.reminder.important = editedImportant;
            }
            else if (exTask.reminder) {
                patch.body.reminder = { time: null };
            }
        }

        // nothing has changed => no need to submit a patch
        if (Object.keys(patch.body).length == 0)
            return undefined;

        return patch;
    },
    _arrayDiff: function(oldArray, newArray) {
        oldArray = oldArray || [];
        newArray = newArray || [];

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
});

_.extend(exports, {
    Task: Task
});