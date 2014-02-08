var openid = require("openid"),
    _ = require("underscore"),
    Q = require("q"),
	querystring = require("querystring"),
	uuid = require("node-uuid"),
	db = require("./db");
	
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

        return Q.ninvoke(relyingParty, "authenticate", req.query.openid, false)
            .then(function (authUrl) {
                if (!authUrl)
                    throw new Error("Failed to initiate authentication");

                res.redirect(authUrl);
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

        return Q.ninvoke(relyingParty, "verifyAssertion", req)
            .then(function (result) {
                if (!result.authenticated)
                    throw new Error("Failed to verify the authentication assertion.");

                var claimedIdentifier = result.claimedIdentifier;

                return db.getUser({ openid: claimedIdentifier })
                    .then(function (user) {
                        if (user) {
                            return _registerDevice({
                                name: req.query.device,
                                userId: user._id
                            })
                            .then(function (device) {
                                res.render("ios/redirect", {
                                    url: "http://done?" + querystring.stringify({ token: device.token })
                                });
                            });
                        }
                        else  {
                            return res.render("ios/register", {
                                openid: req.query.openid,
                                claimedIdentifier: claimedIdentifier,
                                device: req.query.device,
                                codeRequired: !!process.env.APP_REGISTRATION_CODE
                            });
                        }
                    });
            });
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

        var registrationCode = process.env.APP_REGISTRATION_CODE || "";
        if (registrationCode && req.body.registrationCode !== registrationCode)
            throw new Error("Wrong registration code");

        return db.insertUser(o)
            .then(function () {
                // reauthenticate to acquire device id
                var authenticateUrl = 'http://' + req.headers.host + '/ios/authenticate?' + querystring.stringify({ device: req.body.device, openid: req.body.openid });
                res.redirect(authenticateUrl);
            });
	}
}

exports.web = {
	/*
		Handler for the web authentication info request. Sends back the info whether the current session is authenticated.
	*/
	info: function (req, res)
	{
        res.json({ logged: !!req.session.openid, name: req.session.username });
	},
	
	/*
		Handler for the web logout request. Kills the user session.
	*/
	logout: function(req, res)
	{
        return Q.ninvoke(req.session, "destroy")
            .then(function () {
                res.json({});
            });
	},
	
	/*
		Handler for the web authentication request. Used for the initial login for a new session.
	*/
	authenticate: function (req, res)
	{
		if (req.session.openid)
			return res.json({ logged: true, authInfo: { logged: true, name: req.session.username } });

		var verifyUrl = 'http://' + req.headers.host + '/authenticate/verify?'
			+ querystring.stringify({ openid: req.query.openid });
		
		var relyingParty = new openid.RelyingParty(verifyUrl, realm, false, false, []);

        return Q.ninvoke(relyingParty, "authenticate", req.query.openid, false)
            .then(function (authUrl) {
                if (!authUrl)
                    throw new Error("Failed to initiate authentication");

                res.json({ url: authUrl });
            });
	},
	
	/*
		Handler for the web verification request. Called after the user has been authenticated (succesfully or not)
		by one of the OpenID providers. If the user does not exist yet in our database, we give him the choice of registering.
	*/
	verify: function (req, res)
	{
		var relyingParty = new openid.RelyingParty("", null, false, false, []);

        return Q.ninvoke(relyingParty, "verifyAssertion", req)
            .then(function (result) {
                if (!result.authenticated)
                    throw new Error("Failed to verify the authentication assertion.");

                var claimedIdentifier = result.claimedIdentifier;

                return db.getUser({ openid: claimedIdentifier })
                    .then(function (user) {
                        if (user) {
                            req.session.openid = claimedIdentifier;
                            req.session.username = user.name;
                            req.session.userId = user._id;
                            res.redirect("/");
                        }
                        else  {
                            res.render("register", {
                                openid: req.query.openid,
                                claimedIdentifier: claimedIdentifier,
                                codeRequired: !!process.env.APP_REGISTRATION_CODE
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

        var registrationCode = process.env.APP_REGISTRATION_CODE || "";
        if (registrationCode && req.body.registrationCode !== registrationCode)
            throw new Error("Wrong registration code");

        return db.insertUser(o)
            .then(function() {
                var authenticateUrl = '/authenticate?' + querystring.stringify({ openid: req.body.openid });
                res.redirect(authenticateUrl);
            });
	},

    /*
        Renders the authentication web page.
     */
    render: function (req, res)
    {
        res.render("authenticate");
    }
}

// helper methods

function _registerDevice(o)
{
    return db.insertDevice(_.extend(o, {
        token: uuid.v4(),
        toSync: []
    }))
    .then(function () {
        return o;
    });
}
