var $ = require("../lib/jquery"),
    Q = require("../lib/q.min"),
    services = require("./services");

exports.providers = {
    google: { openid: "https://www.google.com/accounts/o8/id", image: "/img/openid-google.png" },
    yahoo: { openid: "http://me.yahoo.com/", image: "/img/openid-yahoo.png" },
    aol: { openid: function (account) { return "http://openid.aol.com/" + account; }, image: "/img/openid-aol.png" },
    myopenid: { openid: function (account) { return "http://" + account + ".myopenid.com/"; }, image: "/img/openid-myopenid.png" },
    openid: { openid: function (account) { return account; }, image: "/img/openid.png" }
};

$.extend(exports, {
    /**
     Ensures that the current session is authenticated. If necessary, attempts to re-authenticate or redirects to the authenticate page.
    */
    assertAuthenticated: function(autoReauthenticate) {
        return services.getAuthInfo()
            .then(function (authInfo) {
                if (authInfo.logged)
                    return authInfo;

                if (autoReauthenticate === false)
                {
                    window.location.href = "/authenticate";
                    throw new Error("The session expired, redirecting...");
                }

                return autoAuthenticate()
                    .then(function (authInfo) {
                        if (authInfo)
                            return authInfo;
                        else
                        {
                            window.location.href = "/authenticate";
                            throw new Error("The session expired, redirecting...");
                        }
                    },
                    function (err) {
                        window.location.href = "/authenticate";
                        throw err;
                    });
            });
    }
})

function autoAuthenticate()
{
    var openid = localStorage && localStorage.getItem("openid");
    if (!openid)
        return Q(false);

    return services.authenticate(openid)
        .then(function (result)
        {
            if (result.logged)
                return result.authInfo;

            return authenticateInIframe(result.url)
                .then(function () {
                    return services.getAuthInfo()
                        .then(function (authInfo) {
                            return authInfo.logged ? authInfo : false;
                        });
                });
        });

    function authenticateInIframe(url)
    {
        var deferred = Q.defer();
        $("<iframe />").hide().attr({ src: url }).on("load", function () {
            $(this).remove();
            deferred.resolve();
        }).appendTo("body");
        return deferred.promise.timeout(2000);
    }
}



