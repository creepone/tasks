var $ = require("jquery"),
    Q = require("q"),
    ko = require("knockout");

var dueTasksCount = ko.observable(0),
    _obsoleteReminders = [];

function showNotification(task) {
    var imageUrl = 'https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRS5s9iV9cTYdvz5d8OM4-W6q4JW2t0V_WZ1BVhUbD7RNWGeIHTRA';
    webkitNotifications.createNotification(imageUrl, "Tasks", task.name).show();
    console.log("Showing notification at " + new Date(), task);
    _obsoleteReminders.push(task);
}

function schedule(tasks) {

    markAllDueAsShown();

    tasks.subscribe(onTasksModified);

    updateNotifications();
    setInterval(updateNotifications, 20000);

    function onTasksModified()
    {
        markAllDueAsShown();
        updateNotifications();
    }

    function updateNotifications()
    {
        var active = isActive();

        var count = 0,
            currentTime = +new Date();

        tasks().forEach(function (task) {

            if (task.reminder && task.reminder.time > currentTime)
                return;

            task.isDue(true);
            count++;

            if (active && !isReminderObsolete(task) && task.reminder && task.reminder.important)
                showNotification(task);
        });

        dueTasksCount(count);
    }

    function markAllDueAsShown()
    {
        // mark all past notifications as shown

        var timeBorder = +new Date() - 60000;

        tasks().forEach(function (task) {
            if (task.reminder && task.reminder.time > timeBorder)
                return;

            if (!isReminderObsolete(task) && (task.reminder && task.reminder.important))
                _obsoleteReminders.push(task);
        });
    }
}

function isActive() {
    if (!localStorage || !webkitNotifications)
        return false;

    return !!localStorage.getItem("useNotifications") && webkitNotifications.checkPermission() == 0;
}

function setActive(active) {
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
}

function isReminderObsolete(task) {
    return _obsoleteReminders.some(function (obsoleteTask) {
        return obsoleteTask._id === task._id
            && obsoleteTask.reminder && task.reminder
            && obsoleteTask.reminder.time === task.reminder.time;
    });
}


$.extend(exports, {
    schedule: schedule,
    isActive: isActive,
    setActive: setActive,
    dueTasksCount: dueTasksCount
});