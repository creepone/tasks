var openid = require('openid'),
	querystring = require('querystring'),
	uuid = require('node-uuid'),
	db = require('./db');
	
var realm = process.env.OPENID_REALM;

exports.device = {
	/*
		Handler for the iOS authentication request. Authentication is only performed if the device does not yet have
		a valid device id assigned. In that case, we first let him authenticate with openid before we assign him one.
	*/
	authenticate: function (req, res)
	{
		var verifyUrl = 'http://' + req.headers.host + '/ios/verify?' 
			+ querystring.stringify({ device: req.query.device, openid: req.query.openid });

		var relyingParty = new openid.RelyingParty(verifyUrl, realm, false, false, []);
		relyingParty.authenticate(req.query.openid, false, function(error, authUrl)
		{
			if (error || !authUrl)
				return _reportDeviceError(res);

			res.writeHead(302, { Location: authUrl });
			res.end();
		});
	},
	
	/*
		Handler for the iOS verification request. Called after the user has been authenticated (succesfully or not)
		by one of the OpenID providers. If the user does not exist yet in our database, we give him the choice of registering.
		Otherwise, we assign him a device id.
	*/
	verify: function (req, res)
	{
		var relyingParty = new openid.RelyingParty("", null, false, false, []);
		relyingParty.verifyAssertion(req, function(error, result)
		{
			if (error || !result.authenticated)
				return _reportDeviceError(res);

			var claimedIdentifier = result.claimedIdentifier;

			db.findUser({ openid: claimedIdentifier }, function (error, result) 
			{
				if (error)
					return _reportDeviceError(res);

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
			openid: req.body.claimedIdentifier,
			name: req.body.name
		};

		db.insertUser(o, function (error)
		{
			if (error)
				return _reportDeviceError(res);

			// reauthenticate to acquire device id
			var authenticateUrl = 'http://' + req.headers.host + '/ios/authenticate?' + querystring.stringify({ device: req.body.device, openid: req.body.openid });

			res.writeHead(302, { Location : authenticateUrl });
			res.end();
		});
	}
}

exports.web = {
	/*
		Handler for the web auth-info request. Sends back the info whether the current session is authenticated.
	*/
	getInfo: function (req, res)
	{
		return _returnObject({ logged: !!req.session.openid, name: req.session.username }, res);
	},
	
	/*
		Handler for the web logout request. Kills the user session.
	*/
	logout: function(req, res)
	{
		req.session.destroy(function(error) {
		  	if (error)
				return _returnObject({ error: error }, res);
			return _returnObject({}, res);
		});
	},
	
	/*
		Handler for the web authentication request. Used for the initial login for a new session.
	*/
	authenticate: function (req, res)
	{
		if (req.session.openid)
			return _returnObject({ logged: true }, res);
		
		var verifyUrl = 'http://' + req.headers.host + '/verify?'
			+ querystring.stringify({ openid: req.query.openid });
		
		var relyingParty = new openid.RelyingParty(verifyUrl, realm, false, false, []);
		relyingParty.authenticate(req.query.openid, false, function(error, authUrl)
		{
			if (error || !authUrl)
				return _returnObject({ error: error || true }, res);

			_returnObject({ url: authUrl }, res);
		});
	},
	
	/*
		Handler for the web verification request. Called after the user has been authenticated (succesfully or not)
		by one of the OpenID providers. If the user does not exist yet in our database, we give him the choice of registering.
	*/
	verify: function (req, res)
	{
		var relyingParty = new openid.RelyingParty("", null, false, false, []);
		relyingParty.verifyAssertion(req, function(error, result)
		{
			if (error || !result.authenticated) {
				res.writeHead(302, { Location: "/error.html" });
				res.end();
			}

			var claimedIdentifier = result.claimedIdentifier;

			db.findUser({ openid: claimedIdentifier }, function (error, result) 
			{
				if (error)
					return _returnObject({ error: error }, res);

				if (result)
				{
					req.session.openid = claimedIdentifier;
					req.session.username = result.name;
					
					res.writeHead(302, { Location: "/" });
					res.end();
				}
				else
				{
					res.render('register', {
						openid: req.query.openid,
						claimedIdentifier: claimedIdentifier
					});
				}
			});
		});
	},
	
	/*
		Handler for the web registration request. This is called if a user does not have an account in our database yet and wants to
		register.
	*/
	register: function (req, res)
	{
		var o = {
			openid: req.body.claimedIdentifier,
			name: req.body.name
		};

		db.insertUser(o, function (error)
		{
			if (error) {
				res.writeHead(302, { Location: "/error.html" });
				res.end();
			}
			
			var authenticateUrl = '/authenticate.html?' + querystring.stringify({ openid: req.body.openid });
			res.writeHead(302, { Location: authenticateUrl });
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

function _returnObject(o, res)
{
	res.writeHead(200, { "Content-Type": "text/json" });
	res.end(JSON.stringify(o));
}

function _reportDeviceError(res)
{
	res.render('ios/error', { url: 'http://error' });
}
