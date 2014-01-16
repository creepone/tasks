var $ = require("../lib/jquery"),
    URI = require("../lib/URI/URI"),
    Q = require("../lib/q.min");

function ajax(o) {
    return Q($.ajax(o))
        .then(function (data) {

            // todo: handle session expiration here - authenticate and retry if configured so

            if (data.error)
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
            dataType: "json"
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
            contentType: "application/json; charset=utf-8"
        });
    }
});