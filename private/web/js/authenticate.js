var $ = require("./lib/jquery"),
    URI = require("./lib/URI/URI"),
    ko = require("./lib/knockout"),
    Q = require("./lib/q.min");

require("./lib/bootstrap");

var services = require("./model/services"),
    authentication = require("./model/authentication");

var _viewModel;

$(function()
{
    _createViewModel();
    ko.applyBindings(_viewModel);

    _createView();

    var query = URI(window.location.href).search(true);

    if (query.openid) {
        $("body").hide();
        _start(query.openid);
    }
    else {
        services.getAuthInfo()
            .done(function (res) {
                if (res.logged)
                    window.location.href = '/';
            }, _reportError);
    }
});

function _createView()
{
    $("button[data-provider]").click(function () {

        // toggle the selected button
        $(".btn-info").each(function() { $(this).removeClass("btn-info"); });
        $(this).addClass("btn-info");

        var providerId = $(this).data("provider"),
            provider = authentication.providers[providerId];

        $(".with-account").hide();

        if (typeof provider.openid === "string")
            return _start(provider.openid);

        $(".with-account").show();
        $("#account").focus();
    });

    $("form").submit(function (evt) {
        var providerId = $(".btn-info").data("provider"),
            account = $("#account").val(),
            provider = authentication.providers[providerId];

        // do not submit the form
        evt.preventDefault();

        if (!account)
            return;

        return _start(provider.openid(account));
    });
}

function _createViewModel()
{
    var providers = Object.keys(authentication.providers).map(function (provider) {
        return { provider: provider, image: authentication.providers[provider].image };
    });

    _viewModel = {
        providers: providers
    };
}

function _start(openid)
{
    $(".with-account").hide();
    $("#loader").show();

    if (localStorage)
        localStorage.setItem("openid", openid);

    services.authenticate(openid)
        .done(function (res) {
            if (res.logged)
                window.location.href = '/';

            if (res.url)
                window.location.href = res.url;
        }, _reportError);
}

function _reportError(error)
{
    $("#alert").html("<div class=\"alert alert-error fade in\">" +
      "<button type=\"button\" class=\"close\" data-dismiss=\"alert\">&times;</button>" +
      "Error occured when communicating with the server. </div>");

    setTimeout(function () { $("#alert .alert").alert("close"); }, 2000);
    console.log(error);
}