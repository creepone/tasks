var $ = require("jquery"),
    _ = require("underscore"),
    Backbone = require("backbone");

var CategoryView = Backbone.View.extend({
    tagName: "a",
    className: "list-group-item",
    events: {
        "click": "onLinkClick"
    },

    initialize: function () {
        this.listenTo(this.model, "change", this.render);
    },

    render: function () {
        this.$el.empty().attr({ href: "#" });
        $("<span />").addClass("badge").text(this.model.count).appendTo(this.$el);
        $("<span />").text(this.model.name).appendTo(this.$el);

        this.$el.toggleClass("active", !!this.model.selected);
    },
    onLinkClick: function (event) {
        this.model.selected = !this.model.selected;
    }
});


var CategoriesView = Backbone.View.extend({
    tagName: "div",
    className: "list-group",

    initialize: function() {
        this.listenTo(this.model, "add", this.onCategoryAdd);
        this.listenTo(this.model, "remove", this.onCategoryRemove);
    },
    events: {},
    render: function() {
        var $el = this.$el;
        $el.empty();

        this.categoryViews = this.model.map(function (category) {
            var categoryView = new CategoryView({ model: category });
            $el.append(categoryView.el);
            categoryView.render();
            return categoryView;
        });
    },
    onCategoryAdd: function (category, categories) {
        var index = categories.indexOf(category);
        var categoryView = new CategoryView({ model: category });

        this.$el.insertAt(index, categoryView.el);
        this.categoryViews.splice(index, 0, categoryView);
        categoryView.render();
    },
    onCategoryRemove: function (category) {
        var categoryView = _.find(this.categoryViews, function (v) { return v.model === category; });
        categoryView.$el.fadeOut(function () { categoryView.$el.remove(); });
        this.categoryViews = _.without(this.categoryViews, categoryView);
    }
});

_.extend(exports, {
    CategoriesView: CategoriesView
});