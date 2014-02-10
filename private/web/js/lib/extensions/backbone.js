var Backbone = require("../backbone"),
    _ = require("underscore"),
    ajax = require("../../services/ajax").ajax;

Backbone.ajax = ajax;

Backbone.Model.extend = (function (extend) {
    return function (o) {
        // call base version
        var constructor = extend.apply(Backbone.Model, [].slice.apply(arguments));

        var properties = o.properties;
        if (typeof (properties) == "string")
            properties = properties.split(",");
        if (_.isArray(properties))
            properties = _.object(properties.map(function (p) { return [p, {}]; }));

        if (!properties)
            return constructor;

        Object.keys(properties).forEach(function (key) {
            $.extend(properties[key],
                {
                    get: _.partial(constructor.prototype.get, key),
                    set: _.partial(constructor.prototype.set, key)
                });
        });

        Object.defineProperties(constructor.prototype, properties);
        return constructor;
    };
})(Backbone.Model.extend);

module.exports = Backbone;
