var express = require('express'),
    jade = require("jade"),
	authentication = require('./private/authentication');
	
var app = express();

app.configure(function () {
	app.set("view engine", "jade");
    app.set("views", __dirname + "/views");
    app.engine("html", jade.__express);

    app.use(express.static(__dirname + '/public'));
    app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.session({ secret: process.env.MONGOHQ_URL || 'secret' }));
	app.use(app.router);
});

// initialize all the routes
require("./private/router").init(app);

app.listen(process.env.PORT || 8081);