var $ = require("jquery"),
    Q = require("q"),
    authentication = require("./authentication");

function ajax(o) {
    return Q($.ajax(o))
        .then(function (data) {
            return data;
        },
        function (res) {
            if (res.status == 403 && o.retryAuthenticate)
                return authentication.assertAuthenticated()
                    .then(function () {
                        o.retryAuthenticate = false;
                        return ajax(o);
                    });
            else if (res.status == 403)
                window.location.href = "/authenticate";
            else
                throw new Error(res.responseText || "Unknown error");
        });
}

$.extend(exports, {
    ajax: ajax,
    authenticate: function (openid) {
        return ajax({
            type: "GET",
            url: "/authenticate/init",
            data: { openid: openid },
            dataType: "json"
        });
    },
    getAuthInfo: function () {
        return ajax({
            type: "GET",
            url: "/authenticate/info",
            dataType: "json"
        });
    },
    getDeviceStats: function () {
        return ajax({
            type: "GET",
            url: "/devices/stats",
            dataType: "json",
            retryAuthenticate: true
        });
    },
    notifyAllDevices: function () {
        return ajax({
            type: "POST",
            url: "/sync/notifyAll",
            dataType: "json",
            retryAuthenticate: true
        })
    },
    getTasks: function () {
        return ajax({
            type: "GET",
            url: "/sync/tasks",
            dataType: "json",
            retryAuthenticate: true
        });
    },
    logout: function () {
        return ajax({
            type: "GET",
            url: "/logout",
            dataType: "json"
        });
    },
    submitPatch: function (patch) {
        return ajax({
            type: "POST",
            url: "/sync/submit",
            dataType: "json",
            data: JSON.stringify({ patch: patch }),
            contentType: "application/json; charset=utf-8",
            retryAuthenticate: true
        });
    }
});