var express = require('express'),
    jade = require("jade"),
    router = require("./private/router");
	
var app = express();

app.configure(function () {
	app.set("view engine", "jade");
    app.set("views", __dirname + "/private/web/views");
    app.engine("html", jade.__express);

    app.use(express.static(__dirname + "/public"));
    app.use(express.cookieParser());
	app.use(express.bodyParser());
    router.init(app, express.session({ secret: process.env.MONGOHQ_URL || "secret" }));
});

app.listen(process.env.PORT || 8081);