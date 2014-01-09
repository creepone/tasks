(function () {
	
	$(function() 
	{
		var query = URI(window.location.href).search(true);
		
		if (query.openid) {
			$("body").hide();
			_start(query.openid);
		}
		else {
			_getAuthInfo(function (res) {
				if (res.logged)
					window.location.href = '/';
			});
		}

		$("button[data-provider]").click(function () {

			// toggle the selected button
		    $(".btn-info").each(function() { $(this).removeClass("btn-info"); });
			$(this).addClass("btn-info");
			
			var provider = $(this).data("provider");
			
			$(".with-account").hide();
			
			switch (provider)
			{
				case "google":
					return _start('https://www.google.com/accounts/o8/id');
				case "yahoo":
					return _start('http://me.yahoo.com/');
			}
				
			$(".with-account").show();
			$("#account").focus();
		});
		
		$("form").submit(function (evt) {
			var provider = $(".btn-info").data("provider");
			var account = $("#account").val();
			
			// do not submit the form
			evt.preventDefault();
			
			if (!account)
				return;
			
			switch (provider)
			{
				case "aol":
					return _start('http://openid.aol.com/' + account);
				case "myopenid":
					return _start('http://' + account + '.myopenid.com/');
				case "openid":
					return _start(account);
			}
		});
	});
	
	function _start(provider)
	{
		$(".with-account").hide();
		$("#loader").show();
	
		_authenticate({ provider: provider}, function (res) {
			if (res.logged)
				window.location.href = '/';
			
			if (res.url)
				window.location.href = res.url;
		});
	}
	
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
	
	function _authenticate(o, callback)
	{
		var url = URI('/authenticate/init').addSearch({ openid: o.provider }).toString();
		
		$.ajax({
		    type: "GET",
		    url: url,
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
		$("#alert").html("<div class=\"alert alert-error fade in\">" +
		  "<button type=\"button\" class=\"close\" data-dismiss=\"alert\">&times;</button>" +
		  "Error occured when communicating with the server. </div>");
		
		setTimeout(function () { $("#alert .alert").alert("close"); }, 2000);
		console.log(error);
	}
	
}());