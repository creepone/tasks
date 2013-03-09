var express = require('express'),
	consolidate = require('consolidate'),
	authentication = require('./private/authentication');
	
var app = express();

app.engine('dust', consolidate.dust);

app.configure(function () {
	app.set('view engine', 'dust');
	app.set('views', __dirname + '/views');
	
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.session({ secret: process.env.MONGOHQ_URL || 'secret' }));
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

app.get('/ios/authenticate', authentication.device.authenticate);
app.get('/ios/verify', authentication.device.verify);
app.post('/ios/register', authentication.device.register);

app.get('/auth-info', authentication.web.getInfo);
app.get('/authenticate', authentication.web.authenticate);
app.get('/verify', authentication.web.verify);
app.post('/register', authentication.web.register);

app.listen(process.env.PORT || 8081);