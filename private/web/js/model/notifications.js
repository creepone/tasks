var Q = require("q"),
    Backbone = require("backbone"),
    _ = require("underscore");

var Notifications = Backbone.Model.extend({
    properties: "tasks,dueTasksCount",
    initialize: function () {
        this._obsoleteReminders = [];
        this.dueTasksCount = 0;
        this._schedule();
    },

    isActive: function () {
        if (!localStorage || !webkitNotifications)
            return false;

        return !!localStorage.getItem("useNotifications") && webkitNotifications.checkPermission() == 0;
    },
    setActive: function (active) {
        if (!localStorage || !webkitNotifications)
            return;

        if (!active) {
            localStorage.removeItem("useNotifications");
        }
        else {
            if (webkitNotifications.checkPermission() == 0) {
                localStorage.setItem("useNotifications", "true");
            }
            else {
                var deferred = Q.defer();
                window.webkitNotifications.requestPermission(function () {
                    localStorage.setItem("useNotifications", "true");
                    deferred.resolve();
                });
                return deferred.promise;
            }
        }

        return Q(true);
    },

    _schedule: function () {

        var self = this,
            tasks = this.tasks;

        markAllDueAsShown();

        this.listenTo(this.tasks, "add", onTasksModified);
        this.listenTo(this.tasks, "remove", onTasksModified);
        this.listenTo(this.tasks, "change", onTasksModified);

        updateNotifications();
        setInterval(updateNotifications, 20000);

        function onTasksModified()
        {
            markAllDueAsShown();
            updateNotifications();
        }

        function updateNotifications()
        {
            var active = self.isActive();

            var count = 0,
                currentTime = +new Date();

            tasks.forEach(function (task) {

                if (task.reminder && task.reminder.time > currentTime) {
                    task.isDue = false;
                    return;
                }

                task.isDue = true;
                count++;

                if (active && !self._isReminderObsolete(task) && task.reminder && task.reminder.important)
                    self._showNotification(task);
            });

            self.dueTasksCount = count;
        }

        function markAllDueAsShown()
        {
            // mark all past notifications as shown

            var timeBorder = +new Date() - 60000;

            tasks.forEach(function (task) {
                if (task.reminder && task.reminder.time > timeBorder)
                    return;

                if (!self._isReminderObsolete(task) && (task.reminder && task.reminder.important))
                    self._obsoleteReminders.push(task);
            });
        }
    },
    _isReminderObsolete: function (task) {
        return this._obsoleteReminders.some(function (obsoleteTask) {
            return obsoleteTask._id === task._id
                && obsoleteTask.reminder && task.reminder
                && obsoleteTask.reminder.time === task.reminder.time;
        });
    },
    _showNotification: function (task) {
        var imageUrl = 'https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRS5s9iV9cTYdvz5d8OM4-W6q4JW2t0V_WZ1BVhUbD7RNWGeIHTRA';
        webkitNotifications.createNotification(imageUrl, "Tasks", task.name).show();
        console.log("Showing notification at " + new Date(), task);
        this._obsoleteReminders.push(task);
    }
});

_.extend(exports, {
    Notifications: Notifications
});