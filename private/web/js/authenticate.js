var $ = require("./lib/jquery"),
    ko = require("./lib/knockout"),
    Q = require("./lib/q.min"),
    services = require("./model/services"),
    authentication = require("./model/authentication"),
    tools = require("./model/tools");

require("./lib/bootstrap");

var _viewModel;

$(function()
{
    var query = tools.parseUri(location).queryKey;
    var openid = query.openid || (localStorage && localStorage.getItem("openid"));

    _createViewModel();
    ko.applyBindings(_viewModel);

    _createView();

    if (openid) {
        $("body").hide();
        _start(openid);
    }
    else {
        services.getAuthInfo()
            .done(function (res) {
                if (res.logged)
                    window.location.href = '/';
            }, tools.reportError);
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
        }, tools.reportError);
}