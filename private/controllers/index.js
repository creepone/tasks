exports.render = function (req, res) {
    res.render("index");
};

exports.renderError = function (req, res) {
    res.render("error");
}