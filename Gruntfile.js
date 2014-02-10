var build = require("./build/build");

module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        build: {
            scripts: { files: [{ src: "./private/web/js/views/pages/*.js", dest: "./public/js" }] },
            stylesheets: { files: [{ src: "./private/web/styles/*.less", dest: "./public/styles" }] }
        },
        watch: {
            scripts: {
                files: ["./private/web/js/**"],
                tasks: ["build:scripts:debug"]
            },
            stylesheets: {
                files: ["./private/web/styles/**"],
                tasks: ["build:stylesheets:debug"]
            }
        }
    });

    grunt.registerMultiTask("build", build.build);
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.registerTask("default", ["build:scripts", "build:stylesheets"]);
    grunt.registerTask("debug", ["build:scripts:debug", "build:stylesheets:debug"]);

    grunt.registerTask("heroku", ["default"]);
};