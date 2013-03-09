(function () {
	
	$(function() {
		/*var query = URI(window.location.href).search(true);
		
		// we are being called from dropbox, notify server and refresh
		if (query.oauth_token) {
			notifyAuthorized(function() {
				window.location.href = URI(window.location.href).search("");
			})
			return;
		}*/
		
		_getAuthInfo(function (res) {
			if (!res.logged)
				window.location.href = '/authenticate.html';
		
			// todo: bootup
		});
	});
	
	function _getAuthInfo(callback)
	{
		$.ajax({
		    type: "GET",
		    url: "/auth-info",
		    dataType: "json",
		    success: function(data) {
				if (data.error)
					return _reportError(data.error);
				
				callback(data);
			},
		    failure: _reportError
		});
	}
	
	function _reportError(error)
	{
		// todo: show error notification
		console.log(error);
	}
	
}());