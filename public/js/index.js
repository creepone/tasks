(function () {

    var _viewModel,
        _dateFormat = "DD.MM.YYYY HH:mm";

	$(function() {		
		_services.getAuthInfo(function (authInfo) {
			if (!authInfo.logged) {
				window.location.href = '/authenticate';
                return;
            }

            _createView();

            _createViewModel(authInfo);
            ko.applyBindings(_viewModel);
		});
	});

    function _createView()
    {
        // reveal all the user-dependent UI
        $(".needs-user").show();

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

        $(document).on("click", ".task .removeTask", function () {
            $(this).popover({
                html: true,
                content: '<p>Sure to delete the selected task ?</p>' +
                    '<div class="delete-buttons">' +
                    '<button class="btn btn-xs btn-danger" type="submit">Delete</button>' +
                    '<button class="btn btn-xs" type="button">Cancel</button>' +
                    '</div>',
                placement: "left",
                trigger: "manual"
            }).popover("show");
        });

        $(document).on("click", '.delete-buttons button[type="button"]', function () {
            $(this).closest(".task").find(".removeTask").popover("hide");
        });

        $(document).on("click", '.delete-buttons button[type="submit"]', _onRemoveTaskClick);

        $("#logout").click(_onLogoutClick);
        $("#addTask").on("click", _onAddTaskClick);
        $("#saveTask").on("click", _onSaveTaskClick);

        $("#addTask").focus();
    }

    function _createViewModel(authInfo)
    {
        var tasks = JSON.parse($(".tasks").html());

        tasks.forEach(function (task) {
            if (task.reminder)
                task.reminder.timeText = moment(new Date(task.reminder.time)).format(_dateFormat);
        });

        var editedTask = {
            name: ko.observable(),
            notes: ko.observable(),
            categories: ko.observable([]),
            reminderImportant: ko.observable(false),
            reminderTime: ko.observable(null)
        };

        _viewModel = {
            username: authInfo.name,
            tasks: tasks,
            editedTask: editedTask
        };

        _setupManualBindings();
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

        _services.submitPatch(patch, function () {
            $(".modal").modal("hide");

            // todo: update the local model instead
            setTimeout(function () { window.location.reload(); }, 500);
        });
    }

    function _onRemoveTaskClick()
    {
        var $task = $(this).closest(".task");
        var taskId = $task.attr("data-id");

        var patch = {
            operation: "remove",
            taskId: taskId
        };

        _services.submitPatch(patch, function () {
            $task.find(".removeTask").popover("hide");
            $task.fadeOut();
        });
    }

    function _onLogoutClick()
    {
        _services.logout(function () {
            window.location.reload();
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

    var _services = {
        getAuthInfo: function (callback) {
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
        },
        logout: function (callback) {
            $.ajax({
                type: "GET",
                url: "/logout",
                dataType: "json",
                success: function(data) {
                    if (data.error)
                        return _reportError(data.error);

                    callback();
                },
                failure: _reportError
            });
        },
        submitPatch: function (patch, callback) {
            $.ajax({
                type: "POST",
                url: "/sync/submit",
                dataType: "json",
                data: JSON.stringify({ patch: patch }),
                contentType: "application/json; charset=utf-8",
                success: function(data) {
                    if (data.error)
                        return _reportError(data.error);

                    callback();
                },
                failure: _reportError
            });
        }
    }

}());