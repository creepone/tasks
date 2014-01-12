var $ = require("../lib/jquery"),
    Q = require("../lib/q.min"),
    ko = require("../lib/knockout");

function showNotification(task) {
    var imageUrl = 'https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRS5s9iV9cTYdvz5d8OM4-W6q4JW2t0V_WZ1BVhUbD7RNWGeIHTRA';
    webkitNotifications.createNotification(imageUrl, "Tasks", task.name).show();
    task.__shownReminder = true;
}

function schedule(tasks) {

    // mark all past notifications as shown
    forEachDueTask(function (task) { task.__shownReminder = true; })

    setInterval(function () {
        if (!isActive())
            return;

        forEachDueTask(showNotification);

    }, 30000);


    function forEachDueTask(callback)
    {
        var currentTime = +new Date();

        tasks().forEach(function (task) {

            if (!task.reminder || !task.reminder.important || task.__shownReminder)
                return;

            if (task.reminder.time > currentTime)
                return;

            callback(task);
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
}

$.extend(exports, {
    schedule: schedule,
    isActive: isActive,
    setActive: setActive
});