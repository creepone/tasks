var $ = require("jquery");

$(function() {
    $("input[name='name']").keyup(checkInput).change(checkInput);

    function checkInput() {
        var val = $(this).val().replace(/\s/g, "");
        $(".btn-primary").prop("disabled", !val);
    }
});