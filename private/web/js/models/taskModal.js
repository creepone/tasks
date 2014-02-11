var _ = require("underscore"),
    Backbone = require("backbone");

var TaskModal = Backbone.Model.extend({
    properties: "task,tasks,categories",

    save: function () {
        return this.task.save(this.tasks);
    },
    typeaheadSource: function () {
        var self = this;

        return function (term, callback) {
            var values = self.categories
            .filter(function (cat) {
                return cat.name.indexOf(term) >= 0;
            })
            .map(function (cat) {
                return { value: cat.name };
            });

            return callback(values);
        }
    }
});

_.extend(exports, {
    TaskModal: TaskModal
});