var fs = require("fs"),
    Q = require("q"),
    _ = require("underscore"),
    browserify = require("browserify"),
    uglify = require("uglify-js"),
    less = require("less");

var scripts = [
    {
        input: "./private/web/js/index.js",
        output: "./public/js/index.js"
    },
    {
        input: "./private/web/js/authenticate.js",
        output: "./public/js/authenticate.js"
    },
    {
        input: "./private/web/js/register.js",
        output: "./public/js/register.js"
    }
];

var stylesheets = [
    {
        input: "./private/web/styles/index.less",
        output: "./public/styles/index.css"
    },
    {
        input: "./private/web/styles/authenticate.less",
        output: "./public/styles/authenticate.css"
    },
    {
        input: "./private/web/styles/layout.less",
        output: "./public/styles/layout.css"
    }
];

module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json")
    });

    grunt.registerTask("default", build);
    grunt.registerTask("debug", function () { build.call(this, true); });

    function build(debug)
    {
        var done = this.async();

        Q.all(scripts.map(function (script) {
            return buildScript(script, !debug);
        }))
        .then(function () {
            return Q.all(stylesheets.map(function (stylesheet) {
                return buildStylesheet(stylesheet, !debug);
            }));
        })
        .done(done);
    }

    function buildScript(o, minify)
    {
        var deferred = Q.defer();

        var b = browserify();
        b.add(o.input);
        var reader = b.bundle();
        var writer = fs.createWriteStream(o.output);

        reader.on("error", function (err) { deferred.reject(err); });
        writer.on("error", function (err) { deferred.reject(err); });

        writer.on("finish", function () {
            if (!minify)
                return deferred.resolve();

            var min = uglify.minify(o.output);
            fs.writeFile(o.output, min.code, function (err) {
                if (err)
                    deferred.reject(err);
                else
                    deferred.resolve();
            });
        });

        reader.pipe(writer);

        return deferred.promise;
    }

    function buildStylesheet(o, minify)
    {
        var deferred = Q.defer();

        var parser = new(less.Parser)({
            filename: o.input
        });

        fs.readFile(o.input, "utf8", function(err, inputContent) {
            if (err)
                return deferred.reject(err);

            parser.parse(inputContent, function (err, tree) {
                if (err)
                    return deferred.reject(err);

                var css = tree.toCSS({ compress: !!minify });
                fs.writeFile(o.output, css, function (err) {
                    if (err)
                        deferred.reject(err);
                    else
                        deferred.resolve();
                });
            });
        });

        return deferred.promise;
    }
};