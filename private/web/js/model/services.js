var $ = require("../lib/jquery"),
    URI = require("../lib/URI/URI"),
    Q = require("../lib/q.min"),
    authentication = require("./authentication");

function ajax(o) {
    return Q($.ajax(o))
        .then(function (data) {
            if (data.error === "SessionExpired" && o.retryAuthenticate) {
                return authentication.assertAuthenticated()
                    .then(function () {
                        o.retryAuthenticate = false;
                        return ajax(o);
                    });
            }
            else if (data.error)
                throw new Error(data.error);
            else
                return data;
        });
}

$.extend(exports, {
    authenticate: function (openid) {
        var url = URI("/authenticate/init").addSearch({ openid: openid }).toString();
        return ajax({
            type: "GET",
            url: url,
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