var authentication = require("./authentication"),
    sync = require("./sync"),
    index = require("./controllers/index");

var routes = [
    // device services
    { path: "/ios/authenticate", method: authentication.device.authenticate },
    { path: "/ios/verify", method: authentication.device.verify },
    { path: "/ios/register", method: authentication.device.register, verb: "POST" },
    { path: "/ios/sync", method: sync.device.sync, verb: "POST" },
    { path: "/ios/sync/acknowledge", method: sync.device.acknowledge, verb: "POST" },

    // web services
    { path: "/authenticate/init", method: authentication.web.authenticate },
    { path: "/authenticate/verify", method: authentication.web.verify },
    { path: "/authenticate/info", method: authentication.web.info },
    { path: "/logout", method: authentication.web.logout },
    { path: "/sync/submit", method: sync.web.submit, verb: "POST" },
    { path: "/register", method: authentication.web.register, verb: "POST" },
    
    // web pages
    { path: "/", method: index.render },
    { path: "/authenticate", method: authentication.web.render },
    { path: "/error", method: index.renderError }
];

exports.init = function(app, session)
{
    app.use(function(req, res, next) {
        if (req.url.match(/\/ios/))
            next();
        else
            session(req, res, next);
    });
    app.use(app.router);
    
    routes.forEach(function(route) {
        var verb = (route.verb || "GET").toLowerCase();
        app[verb](route.path, route.method);
    });
};