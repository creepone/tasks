var $ = require("jquery"),
    _ = require("underscore"),
    Backbone = require("backbone");

var TaskView = Backbone.View.extend({
    initialize: function() {
        this.listenTo(this.model, "change", this.render);
    },
    events: {},
    render: function() {
        var template = _.template($("#task-template").html(), { task: this.model });
        var $el = $(template);

        this.$el.replaceWith($el);
        this.setElement($el[0]);
    }
});

_.extend(exports, {
    TaskView: TaskView
});