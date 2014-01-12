var fs = require("fs"),
    Q = require("q"),
    _ = require("underscore"),
    path = require("path"),
    browserify = require("browserify"),
    uglify = require("uglify-js"),
    less = require("less"),
    grunt = require("grunt");

var targets =
{
    scripts: function (task) { createTransformTarget(task, transformScript); },
    stylesheets: function (task) { createTransformTarget(task, transformStylesheet); }
};

exports.build = function()
{
    var target = targets[this.target];
    if (!target)
        return grunt.log.error("Target " + target + " not found.");

    target(this);
};

function createTransformTarget(task, method)
{
    var transforms = [];

    task.files.forEach(function (file) {
        file.src.forEach(function (src) {
            transforms.push(
                method({ src: src, dest: file.dest, minify: !task.flags.debug })
                    .then(function () { grunt.log.writeln("Transformed " + src)})
            );
        });
    });

    Q.all(transforms).done(task.async());
}

function transformScript(o)
{
    var deferred = Q.defer();

    var src = o.src,
        dest = path.join(o.dest, path.basename(o.src));

    var b = browserify();
    b.add(src);
    var reader = b.bundle();
    var writer = fs.createWriteStream(dest);

    reader.on("error", function (err) { deferred.reject(err); });
    writer.on("error", function (err) { deferred.reject(err); });

    writer.on("finish", function () {
        if (!o.minify)
            return deferred.resolve();

        var min = uglify.minify(dest);
        fs.writeFile(dest, min.code, function (err) {
            if (err)
                deferred.reject(err);
            else
                deferred.resolve();
        });
    });

    reader.pipe(writer);

    return deferred.promise;
}

function transformStylesheet(o)
{
    var deferred = Q.defer();

    var src = o.src,
        dest = path.join(o.dest, path.basename(o.src, "less") + "css");

    var parser = new(less.Parser)({
        filename: src
    });

    fs.readFile(src, "utf8", function(err, srcContent) {
        if (err)
            return deferred.reject(err);

        parser.parse(srcContent, function (err, tree) {
            if (err)
                return deferred.reject(err);

            var css = tree.toCSS({ compress: o.minify });
            fs.writeFile(dest, css, function (err) {
                if (err)
                    deferred.reject(err);
                else
                    deferred.resolve();
            });
        });
    });

    return deferred.promise;
}