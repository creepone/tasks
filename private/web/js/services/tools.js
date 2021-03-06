var $ = require("jquery"),
    Q = require("q");

exports.arrayDiff = function (oldArray, newArray) {
    oldArray = oldArray || [];
    newArray = newArray || [];

    var toAdd = newArray.filter(function (i) { return oldArray.indexOf(i) < 0; });
    var toRemove = oldArray.filter(function (i) { return newArray.indexOf(i) < 0; });

    if (toAdd.length == 0 && toRemove.length == 0)
        return undefined;

    var res = {};
    if (toAdd.length > 0)
        res.add = toAdd;
    if (toRemove.length > 0)
        res.remove = toRemove;
    return res;
};

exports.getSelection = function () {
    if (window.getSelection)
        return window.getSelection();
    else if (document.selection)
        return document.selection.createRange();
};

exports.parseUri = function(str) {

    // parseUri 1.2.2
    // (c) Steven Levithan <stevenlevithan.com>
    // MIT License

    var o = {
        strictMode: false,
        key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
        q:   {
            name:   "queryKey",
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        parser: {
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
            loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        }
    };

    var m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;

    while (i--) uri[o.key[i]] = m[i] || "";

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) uri[o.q.name][decodeURIComponent($1)] = decodeURIComponent($2);
    });

    return uri;
};

exports.reportError = function(error, $container) {
    $container = $container || $(".container");

    var message;
    if (typeof error == "string")
        message = error;
    else if (error.message)
        message = error.message;
    else
        message = "Error occured when communicating with the server.";

    var $alert = $("<div />").addClass("alert alert-danger fade in");
    $("<button />").attr({ type: "button", "data-dismiss": "alert" }).addClass("close").html("&times;").appendTo($alert);
    $("<span />").text(message).appendTo($alert);

    $container.prepend($alert);
    $alert.alert();
    $alert.click(function () { $alert.alert("close"); });

    setTimeout(function () { $alert.alert("close"); }, 5000);
    console.log(error);
};

exports.reportSuccess = function(title, message, $container) {
    $container = $container || $(".container");

    var $alert = $("<div />").addClass("alert alert-success fade in");
    $("<button />").attr({ type: "button", "data-dismiss": "alert" }).addClass("close").html("&times;").appendTo($alert);
    $("<b />").text(title).appendTo($alert);
    $("<br />").appendTo($alert);
    $("<span />").text(message).appendTo($alert);

    $container.prepend($alert);
    $alert.alert();
    $alert.click(function () { $alert.alert("close"); });
};