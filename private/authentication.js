var openid = require('openid'),
	querystring = require('querystring'),
	uuid = require('node-uuid'),
	db = require('./db');

exports.device = {
	/*
		Handler for the iOS authentication request. Authentication is only performed if the device does not yet have
		a valid device id assigned. In that case, we first let him authenticate with openid before we assign him one.
	*/
	authenticate: function (req, res)
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
	},
	
	/*
		Handler for the iOS verification request. This is called after the user has been authenticated (succesfully or not)
		by one of the OpenID providers. If the user does not exist yet in our database, we give him the choice of registering.
		Otherwise, we assign him a device id.
	*/
	verify: function (req, res)
	{
		var relyingParty = new openid.RelyingParty("", null, false, false, []);
		relyingParty.verifyAssertion(req, function(error, result)
		{
			if (error || !result.authenticated)
				return _reportError(res);

			var claimedIdentifier = result.claimedIdentifier;

			db.findUser({ openid: claimedIdentifier }, function (error, result) 
			{
				if (error)
					return _reportError(res);

				if (result)
				{
					_registerDevice({
						name: req.query.device,
						userId: result._id
					}, onRegistered);
				}
				else
				{
					res.render('ios/register', {
						openid: req.query.openid,
						claimedIdentifier: claimedIdentifier,
						device: req.query.device
					});
				}
			});
		});

		function onRegistered(error, result)
		{
			res.render('ios/redirect', {
				url: 'http://done?' + querystring.stringify({ token: result.token })
			});
		}
	},
	
	/*
		Handler for the iOS registration request. This is called if a user does not have an account in our database yet and wants to
		register.
	*/
	register: function (req, res)
	{
		var o = {
			openid: req.body.claimedIdentifier
		};

		db.insertUser(o, function (error)
		{
			if (error)
				return _reportError(res);

			// reauthenticate to acquire device id
			var authenticateUrl = 'http://' + req.headers.host + '/ios/authenticate?' + querystring.stringify({ device: req.body.device, openid: req.body.openid });

			res.writeHead(302, { Location : authenticateUrl });
			res.end();
		});
	}
}

// helper methods

function _registerDevice(o, callback)
{	
	o.token = uuid.v4();
	
	db.insertDevice(o, function (err) {
		if (err)
			return callback(err);
			
		callback(null, o);
	});
}

function _reportError(res)
{
	res.render('ios/error', { url: 'http://error' });
}
