var _ = require("underscore"),
    moment = require("moment"),
    Backbone = require("backbone");

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
    }
});

_.extend(exports, {
    Task: Task
});