var $ = require("jquery"),
    _ = require("underscore"),
    moment = require("moment"),
    Backbone = require("backbone");

var _dateFormat = "DD.MM.YYYY HH:mm";

var TaskModalView = Backbone.View.extend({
    initialize: function() {},
    events: {
        "shown.bs.modal": "onModalShown",
        "hidden.bs.modal": "onModalHidden",
        "input [data-bind]": "onPropertyChange",
        "switch-change input[type='checkbox']": "onReminderImportantChange",
        "keydown .input-group.date input": "onDateInputKeydown",
        "change .input-group.date input": "onDateInputChange",
        "change.dp .input-group.date": "onDateChange",
        "focus .bootstrap-tagsinput input": "onCategoriesFocus",
        "blur .bootstrap-tagsinput input": "onCategoriesBlur",
        "change .categories": "onCategoriesChange"
    },
    render: function() {
        var template = _.template($("#task-modal-template").html(), { task: this.model });
        var $el = $(template);
        $el.appendTo(document.body);
        this.setElement($el[0]);

        $el.find('input[type="checkbox"]').bootstrapSwitch();

        // hack to convince moment english week starts on Monday
        moment()._lang._week.dow = 1;
        $el.find(".input-group.date").datetimepicker({
            format: _dateFormat
        });

        $el.find(".categories").tagsinput({
            tagClass: function() { return "label label-default"; }
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
        var transformed = this.model.transformDate(val);
        if (!transformed)
            return;

        var date = moment(transformed);
        this.onDateChange({ date: date });
        this.$el.find(".input-group.date").data("DateTimePicker").setDate(date);
    },

    onModalShown: function (event) {
        this.$el.find("input:first").focus();
    },
    onModalHidden: function (event) {
        this.remove();
    },
    onPropertyChange: function (event) {
        var $el = $(event.currentTarget);
        var property = $el.attr("data-bind");
        var value = $el.val();
        this.model.set(property, value);
    },
    onReminderImportantChange: function (event, data) {
        var reminder = this.model.reminder || {};
        _.extend(reminder, { important: data.value });
        this.model.reminder = reminder;
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

        var reminder = this.model.reminder || {};
        _.extend(reminder, { time: event.date && +event.date });
        this.model.reminder = reminder;
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
        this.$el.find(".bootstrap-tagsinput input").attr({ placeholder: placeholder });

        this.model.categories = value ? value.split(",") : [];
    }
});

_.extend(exports, {
    TaskModalView: TaskModalView
});