(function () {

    var _viewModel,
        _dateFormat = "DD.MM.YYYY HH:mm";

	$(function() {		
		_getAuthInfo(function (res) {
			if (!res.logged)
				window.location.href = '/authenticate';
		
			$("#logout").show().click(_logout);
			$("#username").text(res.name);

            $("#addTask").focus();

            $('input[type="checkbox"]').bootstrapSwitch();

            // hack to convince moment english week starts on Monday
            moment()._lang._week.dow = 1;
            $(".input-group.date").datetimepicker({
                format: _dateFormat
            });
            $(".categories").tagsinput({
                tagClass: function() { return "label label-default"; }
            });

            $(".modal").on("shown.bs.modal", function () {
                $(".modal input:first").focus();
            });

            $(document).on("focus", ".bootstrap-tagsinput input", function () {
                $(".bootstrap-tagsinput").addClass("focus");
            });

            $(document).on("blur", ".bootstrap-tagsinput input", function () {
                $(".bootstrap-tagsinput").removeClass("focus");
            });

            $("#addTask").on("click", _onAddTaskClick);
            $("#saveTask").on("click", _onSaveTaskClick);

			_viewModel = _createViewModel();
            ko.applyBindings(_viewModel);
            _setupManualBindings();
		});
	});


    function _createViewModel()
    {
        var tasks = JSON.parse($(".tasks").html());

        tasks.forEach(function (task) {
            if (task.reminder)
                task.reminder.timeText = moment().format(_dateFormat, new Date(task.reminder.time));
        });

        var editedTask = {
            name: ko.observable(),
            notes: ko.observable(),
            categories: ko.observable([]),
            reminderImportant: ko.observable(false),
            reminderTime: ko.observable(null)
        };

        return {
            tasks: tasks,
            editedTask: editedTask
        };
    }

    function _onAddTaskClick()
    {
        var task = _viewModel.editedTask;

        task.name("");
        task.notes("");
        task.categories([]);
        task.reminderImportant(false);
        task.reminderTime(null);

        $(".modal").modal("show");
    }

    function _onSaveTaskClick()
    {
        var task = ko.toJS(_viewModel.editedTask);

        var patch = {
            operation: "add",
            body: {
                name: task.name,
                notes: task.notes,
                categories: task.categories
            }
        };

        if (task.reminderTime) {
            patch.body.reminder = {
                time: +task.reminderTime.toDate(),
                important: task.reminderImportant
            };
        }

        $.ajax({
            type: "POST",
            url: "/sync/submit",
            dataType: "json",
            data: JSON.stringify({ patch: patch }),
            contentType: "application/json; charset=utf-8",
            success: function(data) {
                if (data.error)
                    return _reportError(data.error);

                $(".modal").modal("hide");

                // todo: update the local model instead
                setTimeout(function () { window.location.reload(); }, 500);
            },
            failure: function(error) {
                _reportError(error);
                $(".modal").modal("hide");
            }
        });
    }

    function _setupManualBindings()
    {
        // because of using custom controls, we can't bind automatically in some cases

        var setting;

        _viewModel.editedTask.reminderImportant.subscribe(function (value) {
            if (!setting)
                $('input[type="checkbox"]').bootstrapSwitch("setState", value);
        });

        _viewModel.editedTask.reminderTime.subscribe(function (value) {
            if (!setting) {
                $(".input-group.date").data("DateTimePicker").setDate(value);
                if (!value)
                    $(".input-group.date input").val("");
            }
        });

        _viewModel.editedTask.categories.subscribe(function (value) {
            value = value || [];

            if (!setting) {
                $(".categories").tagsinput("removeAll");
                value.forEach(function (category) { $(".categories").tagsinput("add", category); });
            }
        });

        $('input[type="checkbox"]').on("switch-change", function (e, data) {
            setting = true;
            _viewModel.editedTask.reminderImportant(data.value);
            setting = false;
        });

        $(".input-group.date input").on("change", function () {
            setTimeout(function () {
                setting = true;
                var value = $(".input-group.date").data("DateTimePicker").getDate();
                _viewModel.editedTask.reminderTime(value);
                setting = false;
            }, 1);
        });

        $(".input-group.date").on("change.dp", function (e) {
            setting = true;
            _viewModel.editedTask.reminderTime(e.date);
            setting = false;
        });

        $(".categories").on("change", function () {
            var value = $(this).val();
            var placeholder = value ? "" : "Categories";
            $(".bootstrap-tagsinput input").attr({ placeholder: placeholder });

            var categories = value ? value.split(",") : [];
            setting = true;
            _viewModel.editedTask.categories(categories);
            setting = false;
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