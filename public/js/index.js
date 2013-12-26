(function () {
	
	$(function() {		
		_getAuthInfo(function (res) {
			if (!res.logged)
				window.location.href = '/authenticate';
		
			$("#logout").show().click(_logout);
			$("#username").text(res.name);
			
			// todo: bootup
		});
	});
	
	function _getAuthInfo(callback)
	{
		$.ajax({
		    type: "GET",
		    url: "/authenticate/info",
		    dataType: "json",
		    success: function(data) {
				if (data.error)
					return _reportError(data.error);
				
				callback(data);
			},
		    failure: _reportError
		});
	}
	
	function _logout(callback)
	{
		$.ajax({
		    type: "GET",
		    url: "/logout",
		    dataType: "json",
		    success: function(data) {
				if (data.error)
					return _reportError(data.error);
				
				window.location.reload();
			},
		    failure: _reportError
		});
	}
	
	function _reportError(error)
	{
		$("#alert").html("<div class=\"alert alert-error fade in\">" +
		  "<button type=\"button\" class=\"close\" data-dismiss=\"alert\">&times;</button>" +
		  "Error occured when communicating with the server. </div>");
		
		setTimeout(function () { $("#alert .alert").alert("close"); }, 2000);
		console.log(error);
	}

}());