var $ = require("../lib/jquery"),
    Q = require("../lib/q.min"),
    ko = require("../lib/knockout");

var dueTasksCount = ko.observable(0);

function showNotification(task) {
    var imageUrl = 'https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRS5s9iV9cTYdvz5d8OM4-W6q4JW2t0V_WZ1BVhUbD7RNWGeIHTRA';
    webkitNotifications.createNotification(imageUrl, "Tasks", task.name).show();
    task.__shownReminder = true;
}

function schedule(tasks) {

    // mark all past notifications as shown
    forEachDueTask(function (task) { task.__shownReminder = true; });

    tasks.subscribe(updateNotifications);
    setInterval(updateNotifications, 20000);
    
    function updateNotifications()
    {
        if (!isActive())
            return;

        forEachDueTask(showNotification);
    }

    function forEachDueTask(callback)
    {
        var count = 0,
            currentTime = +new Date();

        tasks().forEach(function (task) {

            if (task.reminder && task.reminder.time > currentTime)
                return;

            task.isDue(true);
            count++;

            if (!task.__shownReminder && (task.reminder && task.reminder.important))
                callback(task);
        });
        
        dueTasksCount(count);
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
    setActive: setActive,
    dueTasksCount: dueTasksCount
});