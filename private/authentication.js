var openid = require('openid'),
	querystring = require('querystring');

/*
	Handler for the iOS authentication request. Authentication is only performed if the device does not yet have
	a valid device id assigned. In that case, we first let him authenticate with openid before we assign him one.
*/
function authenticateDevice(req, res) 
{
	var verifyUrl = 'http://' + req.headers.host + '/ios/verify?' 
		+ querystring.stringify({ device: req.query.device, openid: req.query.openid });
	
	var relyingParty = new openid.RelyingParty(verifyUrl, null, false, false, []);
	relyingParty.authenticate(req.query.openid, false, function(error, authUrl)
	{
		if (error || !authUrl)
			return _reportError(res);

		res.writeHead(302, { Location: authUrl });
		res.end();
	});
}

/*
	Handler for the iOS verification request. This is called after the user has been authenticated (succesfully or not)
	by one of the OpenID providers. If the user does not exist yet in our database, we give him the choice of registering.
	Otherwise, we assign him a device id.
*/
function verifyDevice(req, res)
{
	var relyingParty = new openid.RelyingParty("", null, false, false, []);
	relyingParty.verifyAssertion(req, function(error, result)
	{
		if (error || !result.authenticated)
			return _reportError(res);
			
		var claimedIdentifier = result.claimedIdentifier;
		
		_findUser({ openid: claimedIdentifier }, function (error, result) 
		{
			if (error)
				return _reportError(res);
				
			if (result)
			{
				_registerDevice({
					name: req.query.device,
					username: result.username
				}, onRegistered);
			}
			else
			{
				// todo: return registration page (form with action /ios/register)
				res.writeHead(200);
				
				res.write('<!doctype html><html><body><form method="POST" action="/ios/register">');
				res.write('<input name="openid" type="hidden" value="' + req.query.openid +  '" />');
				res.write('<input name="claimedIdentifier" type="hidden" value="' + claimedIdentifier +  '" />');
				res.write('<input name="device" type="hidden" value="' + req.query.device +'" />');
				res.write('<input name="username" type="text" />');
				res.write('<input type="submit" value="Register" />');
				res.end('</body></html>');
			}
		});
	});
	
	function onRegistered(error, result)
	{
		res.writeHead(200);
		
		var tokenUrl = 'http://done?' + querystring.stringify({ token: result._id, username: result.username });
		res.end('<!doctype html><html><head><script> window.onload=function() { document.location.href = "' + tokenUrl + '" } </script></head></html>');
	}
}

/*
	Handler for the iOS registration request. This is called if a user does not have an account in our database yet and wants to
	register.
*/
function registerDevice(req, res)
{
	var o = {
		username: req.body.username,
		openid: req.body.claimedIdentifier
	};
	
	_createUser(o, function (error, result)
	{
		if (error)
			return _reportError(res);
			
		// reauthenticate to acquire device id
		var authenticateUrl = 'http://' + req.headers.host + '/ios/authenticate?' + querystring.stringify({ device: req.body.device, openid: req.body.openid });
			
		res.writeHead(302, { Location : authenticateUrl });
		res.end();
	});
}


// helper methods

function _registerDevice(o, callback)
{
	// todo: insert o = { name: "device name", username: "username" } into devices
	// todo: retrieve id, return it	in the callback
	callback(null, { _id: "kapodaster", username: o.username });
}

var user;

function _findUser(o, callback)
{
	// todo: find user with o = { openid: "..." }, return him in the callback
	
	// todo: testing code, remove
	if (user)
		return callback(null, user);
	else
		return callback();
}

function _createUser(o, callback)
{
	user = o;
	return callback(null, o);
	// todo: create the given user o = { openid: "...", username: "..." }
}

function _reportError(res)
{
	// todo: show error page
	res.writeHead(200);
	res.end('Authentication failed');
}


exports.authenticateDevice = authenticateDevice;
exports.verifyDevice = verifyDevice;
exports.registerDevice = registerDevice;