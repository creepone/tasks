var Q = require("q"),
    authentication = require("./authentication"),
    db = require("./db"),
    sync = require("./sync"),
    stats = require("./stats"),
    index = require("./controllers/index");

var routes = {
    device: {
        endpoints: [
            { path: "/ios/sync", method: sync.device.sync, verb: "POST" },
            { path: "/ios/sync/acknowledge", method: sync.device.acknowledge, verb: "POST" },
            { path: "/ios/sync/setApnToken", method: sync.device.setApnToken, verb: "POST" }
        ],
        pages: [
            { path: "/ios/authenticate", method: authentication.device.authenticate, anonymous: true },
            { path: "/ios/verify", method: authentication.device.verify, anonymous: true },
            { path: "/ios/register", method: authentication.device.register, verb: "POST", anonymous: true }
        ]
    },
    web: {
        endpoints: [
            { path: "/authenticate/init", method: authentication.web.authenticate, anonymous: true },
            { path: "/authenticate/info", method: authentication.web.info, anonymous: true },
            { path: "/logout", method: authentication.web.logout },
            { path: "/sync/submit", method: sync.web.submit, verb: "POST" },
            { path: "/sync/tasks", method: sync.web.getTasks },
            { path: "/sync/notifyAll", method: sync.web.notifyAll, verb: "POST" },
            { path: "/devices/stats", method: stats.deviceStats }
        ],
        pages: [
            { path: "/", method: index.render },
            { path: "/authenticate", method: authentication.web.render, anonymous: true },
            { path: "/authenticate/verify", method: authentication.web.verify, anonymous: true },
            { path: "/register", method: authentication.web.register, verb: "POST", anonymous: true },
            { path: "/error", method: index.renderError, anonymous: true }
        ]
    }
};

var authFilters = {
    device: {
        endpoints: function (req, res, next) {
            db.getDevice({ token: req.body.token })
                .done(function (device) {
                    if (!device)
                        return res.send(403, {});

                    req.device = device;
                    next();
                },
                function (err) {
                    console.log(err);
                    res.send({ error: err.toString() });
                });
        },
        pages: function (req, res, next) {
            // we do not have any pages that require authentication yet.
            // they would have to authenticate with a token like the services though.
            next();
        }
    },
    web: {
        endpoints: function (req, res, next) {
            if (req.session.userId)
                return next();
            else
                res.send(403);
        },
        pages: function (req, res, next) {
            if (req.session.userId)
                return next();
            else
                res.redirect("/authenticate");
        }
    }
};

var errorFilters = {
    device: {
        endpoints: function (req, res, err) {
            res.send({ error: err.toString() });
        },
        pages: function (req, res, err) {
            res.render("ios/error", { url: "http://error" });
        }
    },
    web: {
        endpoints: function (req, res, err) {
            res.send(500, err.toString());
        },
        pages: function (req, res, err) {
            res.status(500);
            res.render("error", { error: err.toString() });
        }
    }
}

exports.init = function(app, session) {
    app.use(function(req, res, next) {
        if (req.url.match(/\/ios/))
            next();
        else
            session(req, res, next);
    });
    app.use(app.router);

    ["device", "web"].forEach(function (agent) {
        ["endpoints", "pages"].forEach(function (resource) {
            routes[agent][resource].forEach(function (route) {
                var authFilter = authFilters[agent][resource];
                var errorFilter = errorFilters[agent][resource];
                register(route, authFilter, errorFilter);
            })
        })
    });

    function register(route, authFilter, errorFilter) {
        var verb = (route.verb || "GET").toLowerCase();
        var args = [route.path];
        if (!route.anonymous)
            args.push(authFilter);

        args.push(function (req, res, next) {
            Q.try(function () { return route.method(req, res); })
                .catch(function (err) {
                    console.log(route.path + ": " + err.toString());
                    errorFilter(req, res, err);
                });
        });

        app[verb].apply(app, args);
    }
};