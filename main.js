var express = require('express');
var app = express();

var authentication = require('./private/authentication');

app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

app.get('/ios/authenticate', authentication.device.authenticate);
app.get('/ios/verify', authentication.device.verify);
app.post('/ios/register', authentication.device.register);

app.listen(process.env.PORT || 8081);