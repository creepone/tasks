var openid = require('openid');

function authenticateDevice(req, res) 
{
	var relyingParty = new openid.RelyingParty('http://tasks.iosapps.at/ios/verify', null, false, false, []);
	relyingParty.authenticate(req.query.openid, false, function(error, authUrl)
	{
		if (error || !authUrl)
		{
			// todo: show error page with a close button so that the user can exit the process
			res.writeHead(200);
			res.end('Authentication failed');
		}
		else
		{
			res.writeHead(302, { Location: authUrl });
			res.end();
		}
	});
}

exports.authenticateDevice = authenticateDevice;