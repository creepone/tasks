var _ = require("underscore"),
    Backbone = require("backbone"),
    moment = require("moment"),
    tools = require("../services/tools");

var Categories = Backbone.Collection.extend({
    model: Category,
    comparator: "name"
});

var Category = Backbone.Model.extend({
    properties: "name,count,selected"
});

var CategoriesService = Backbone.Model.extend({
    properties: "tasks,categories",

    initialize: function () {
        this.categories = new Categories();

        this.listenTo(this.tasks, "add", this.onTaskAdd);
        this.listenTo(this.tasks, "remove", this.onTaskRemove);
        this.listenTo(this.tasks, "change:categories", this.onTaskModified);

        this.tasks.forEach(this.onTaskAdd.bind(this));
    },

    onTaskAdd: function (task) {
        task.categories.forEach(this.onCategoryAddToTask.bind(this));
    },
    onTaskRemove: function (task) {
        task.categories.forEach(this.onCategoryRemoveFromTask.bind(this));
    },
    onTaskModified: function (task) {
        var diff = tools.arrayDiff(task.previous("categories"), task.categories);
        if (!diff)
            return;

        if (diff.add)
            diff.add.forEach(this.onCategoryAddToTask.bind(this));
        if (diff.remove)
            diff.remove.forEach(this.onCategoryRemoveFromTask.bind(this));
    },

    onCategoryAddToTask: function (name) {
        var category = this.categories.findWhere({ name: name });
        if (category) {
            category.count++;
        }
        else {
            category = new Category({ name: name, count: 1 });
            this.categories.add(category);
        }
    },
    onCategoryRemoveFromTask: function (name) {
        var category = this.categories.findWhere({ name: name });
        category.count--;
        if (category.count === 0)
            this.categories.remove(category);
    }
});

_.extend(exports, {
    Categories: CategoriesService
});