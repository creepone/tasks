var $ = require("../jquery");

$.fn.insertAt = function (index, element) {
    if (index === 0)
        this.prepend(element);
    else if (index > this.children().length)
        this.append(element);
    else
        this.children(":nth-child(" + index + ")").after(element);
    return this;
};

module.exports = $;
