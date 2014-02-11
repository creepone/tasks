var $ = require("jquery"),
    _ = require("underscore"),
    moment = require("moment"),
    Backbone = require("backbone"),
    tools = require("../services/tools");

require("typeahead");

var _dateFormat = "DD.MM.YYYY HH:mm";

var TaskModalView = Backbone.View.extend({
    initialize: function() {},
    events: {
        "click #saveTask": "onSaveTaskClick",
        "shown.bs.modal": "onModalShown",
        "hidden.bs.modal": "onModalHidden",
        "input [data-bind]": "onPropertyChange",
        "switch-change input[type='checkbox']": "onReminderImportantChange",
        "keydown .input-group.date input": "onDateInputKeydown",
        "change .input-group.date input": "onDateInputChange",
        "change.dp .input-group.date": "onDateChange",
        "focus .bootstrap-tagsinput input": "onCategoriesFocus",
        "blur .bootstrap-tagsinput input": "onCategoriesBlur",
        "change .categories": "onCategoriesChange",
        "typeahead:selected input": "onTypeaheadSelected",
        "typeahead:cursorchanged  input": "onTypeaheadCursorChanged",
        "input .twitter-typeahead": "onTypeaheadInput"
    },
    render: function() {
        var template = _.template($("#task-modal-template").html(), { task: this.model.task });
        var $el = $(template);
        $el.appendTo(document.body);
        this.setElement($el[0]);

        $el.find('input[type="checkbox"]').bootstrapSwitch();

        // hack to convince moment english week starts on Monday
        moment()._lang._week.dow = 1;
        $el.find(".input-group.date").datetimepicker({
            format: _dateFormat
        });

        var $categories = $el.find(".categories");
        $categories.tagsinput({
            tagClass: function() { return "label label-default"; }
        });

        $categories.tagsinput("input").typeahead({ highlight: true }, {
            source: this.model.typeaheadSource()
        });
    },

    show: function () {
        this.render();
        this.$el.modal("show");
    },
    hide: function () {
        this.$el.modal("hide");
    },
    transformDate: function (input) {
        var val = $(input).val();
        var transformed = this.model.task.transformDate(val);
        if (!transformed)
            return;

        var date = moment(transformed);
        this.onDateChange({ date: date });
        this.$el.find(".input-group.date").data("DateTimePicker").setDate(date);
    },

    onSaveTaskClick: function (event) {
        var self = this;
        this.model.save()
            .done(function () {
                self.hide();
            }, tools.reportError);
    },
    onModalShown: function (event) {
        this.$el.find("input:first").focus();
    },
    onModalHidden: function (event) {
        // todo: destroy all the widgets used in the modal here
        this.remove();
    },
    onPropertyChange: function (event) {
        var $el = $(event.currentTarget);
        var property = $el.attr("data-bind");
        var value = $el.val();
        this.model.task.set(property, value);

        if (property == "name")
            this.$el.find("#saveTask").prop({ disabled: !value });
    },
    onReminderImportantChange: function (event, data) {
        var reminder = this.model.task.reminder || {};
        _.extend(reminder, { important: data.value });
        this.model.task.reminder = reminder;
    },
    onDateInputKeydown: function (event) {
        if (event.keyCode == 13) {
            event.stopPropagation();
            this.transformDate(event.currentTarget);
        }
        else if (event.keyCode == 9)
            this.transformDate(event.currentTarget);
    },
    onDateInputChange: function (event) {
        if (!$(event.currentTarget).val()) {
            this.onDateChange({ date: null });
            this.$el.find(".input-group.date").data("DateTimePicker").setDate(null);
        }
    },
    onDateChange: function (event) {
        if (!("date" in event))
            return;

        var reminder = this.model.task.reminder || {};
        _.extend(reminder, { time: event.date && +event.date });
        this.model.task.reminder = reminder;
    },
    onCategoriesFocus: function (event) {
        this.$el.find(".bootstrap-tagsinput").addClass("focus");
    },
    onCategoriesBlur: function (event) {
        this.$el.find(".bootstrap-tagsinput").removeClass("focus");
        var $categories = this.$el.find(".categories");

        var $el = $(event.currentTarget);

        if ($el.val()) {
            $categories.tagsinput("add", $el.val());
            $el.val("");
        }
    },
    onCategoriesChange: function (event) {
        var value = $(event.currentTarget).val();
        var placeholder = value ? "" : "Categories";
        var $input = this.$el.find(".bootstrap-tagsinput input");
        $input.attr({ placeholder: placeholder });
        $input.typeahead("val", "");

        this.model.task.categories = value ? value.split(",") : [];
    },
    onTypeaheadSelected: function (event, selected) {
        var $categories = this.$el.find(".categories");
        $categories.tagsinput("add", selected.value);
    },
    onTypeaheadCursorChanged: function (event) {
        this.$el.find(".bootstrap-tagsinput input").attr({ placeholder: "" });
    },
    onTypeaheadInput: function (event) {
        var typeaheadVal = $(event.currentTarget).find(".tt-input").val();
        var $categories = this.$el.find(".categories");
        var placeholder = ($categories.val() || typeaheadVal) ? "" : "Categories";
        this.$el.find(".bootstrap-tagsinput input").attr({ placeholder: placeholder });
    }
});

_.extend(exports, {
    TaskModalView: TaskModalView
});