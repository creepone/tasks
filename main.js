var express = require('express'),
	consolidate = require('consolidate'),
	authentication = require('./private/authentication');
	
var app = express();

app.engine('dust', consolidate.dust);

app.configure(function () {
	app.set('view engine', 'dust');
	app.set('views', __dirname + '/views');
	
	app.use(express.bodyParser());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

app.get('/ios/authenticate', authentication.device.authenticate);
app.get('/ios/verify', authentication.device.verify);
app.post('/ios/register', authentication.device.register);

app.listen(process.env.PORT || 8081);