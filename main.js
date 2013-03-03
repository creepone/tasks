var express = require('express');
var app = express();

var authentication = require('./private/authentication');

app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

app.get('/ios/authenticate', authentication.authenticateDevice);
app.get('/ios/verify', authentication.verifyDevice);
app.post('/ios/register', authentication.registerDevice);

app.listen(process.env.PORT || 8081);