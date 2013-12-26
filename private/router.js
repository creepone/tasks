var authentication = require("./authentication"),
    sync = require("./sync"),
    index = require("./controllers/index");

exports.init = function (app) {
    app.get("/ios/authenticate", authentication.device.authenticate);
    app.get("/ios/verify", authentication.device.verify);
    app.post("/ios/register", authentication.device.register);
    app.post("/ios/sync", sync.device.sync);

    app.get("/", index.render);
    app.get("/authenticate", authentication.web.render);
    app.get("/authenticate/init", authentication.web.authenticate);
    app.get("/authenticate/verify", authentication.web.verify);
    app.get("/authenticate/info", authentication.web.info);
    app.get("/logout", authentication.web.logout);
    app.post("/register", authentication.web.register);

    app.get("/error", index.renderError);
};