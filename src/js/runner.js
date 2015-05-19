/* Author: André Roberge
   License: MIT
 */

/*jshint browser:true, devel:true, indent:4, white:false, plusplus:false */
/*globals $, RUR, editor, library, editorUpdateHints,
  translate_python, CoffeeScript */

RUR.runner = {};

RUR.runner.interpreted = false;

RUR.runner.run = function (playback) {
    var src, fatal_error_found = false;
    if (!RUR.runner.interpreted) {
        RUR.vis_world.select_initial_values();
        src = editor.getValue();
        fatal_error_found = RUR.runner.eval(src); // jshint ignore:line
        RUR.current_world = RUR.world.clone_world(RUR.world.saved_world);
    }
    if (!fatal_error_found) {
        try {
            localStorage.setItem(RUR.settings.editor, editor.getValue());
            localStorage.setItem(RUR.settings.library, library.getValue());
        } catch (e) {}
        // "playback" is afunction called to play back the code in a sequence of frames
        // or a "null function", f(){} can be passed if the code is not
        // dependent on the robot world.
        if (playback() === "stopped") {
            RUR.ui.stop();
        }
    }
};

RUR.runner.check_semicolons = function(src) {
    var lines = src.split('\n');
    var l = lines.length;

    var tokens = [  'if ', 'if(',
                    'else',
                    'elif ','elif(',
                    'while ','while(',
                    'for ','for(',
                    'def '];
    var n = tokens.length;

    var semicolon_error = false;
    var i = 0;
    var error_line = 0;
    while (!semicolon_error && i<l) {
        var j = 0;
        while (!semicolon_error && j<n){
            var token = tokens[j];
            var pos = lines[i].indexOf(token);
            if (pos != -1){
                var colon_pos = lines[i].indexOf(":");
                if (colon_pos == -1){
                    semicolon_error = true;
                    error_line = i+1;
                }
            }
            j = j + 1;
        }
        i = i + 1;
    }
    return error_line;
};

RUR.runner.check_func_parentheses = function(src) {
    var lines = src.split('\n');
    var l = lines.length;

    var def_parentheses_error = false;
    var i = 0;
    var error_line = 0;
    while (!def_parentheses_error && i<l) {
        var pos = lines[i].indexOf('def ');
        if (pos != -1){
            var parentheses_pos = lines[i].indexOf("(");
            if (parentheses_pos == -1){
                def_parentheses_error = true;
                error_line = i+1;
            }
        }
        i = i + 1;
    }
    return error_line;
}

RUR.runner.Python_lint = function(src) {
    var err_line = RUR.runner.check_semicolons(src);
    if (err_line != 0){
        var e = new Error;
        e.__name__ = "Syntax Error";
        e.message = "line " + String(err_line) + ": semicolon missing";
        throw e;
    }

    var err_line = RUR.runner.check_func_parentheses(src);
    if (err_line != 0){
        var e = new Error;
        e.__name__ = "Syntax Error";
        e.message = "line " + String(err_line) + ": function definition is missing parentheses";
        throw e;
    }
};

RUR.runner.eval = function(src) {  // jshint ignore:line
    var error_name, info, new_message, line_no, tmp;
    try {
        if (RUR.programming_language === "javascript") {
            RUR.runner.eval_javascript(src);
        } else if (RUR.programming_language === "python") {
            RUR.runner.Python_lint(src);
            RUR.runner.eval_python(src);
        } else if (RUR.programming_language === "coffee") {
            RUR.runner.eval_coffee(src);
        } else {
            alert("Unrecognized programming language.");
            return true;
        }
    } catch (e) {
        if (RUR.programming_language === "python") {
            error_name = e.__name__;
            console.log(e);
            if (e.reeborg_says === undefined) {
                e.message = e.message.replace("\n", "<br>");
                if (e.info){
                    info = RUR.simplify_python_traceback(e.info);
                    if (info == "Highlight Problem"){
                        error_name = RUR.translate("Unexplained Error");
                        e.message = RUR.translate("Please turn highlighting off") +
                            "<img src='src/images/highlight.png'>" +
                            "<img src='src/images/not_ok.png'><br>" +
                            RUR.translate("and try running your program again.");
                    } else {
                        e.message += "<br>&#8594;" + info;
                    }
                }
            } else {
                e.message = e.reeborg_says;
            }
        } else {
            error_name = e.name;
        }
        if (error_name === "ReeborgError"){
            RUR.rec.record_frame("error", e);
        } else {
            new_message = e.message.split("line ");
            new_message = new_message[new_message.length-1];
            if (RUR._highlight) {
                tmp = new_message.split("\n");
                line_no = parseInt(tmp[0], 10)/2;
                new_message = new_message.replace(tmp[0], line_no.toString());
            }
            new_message = "near or at line " + new_message.replace("\n", "<br>");
            $("#Reeborg-shouts").html("<h3>" + error_name + "</h3><h4>" + new_message + "</h4>").dialog("open");
            RUR.ui.stop();
            return true;
        }
    }
    RUR.runner.interpreted = true;
    return false;
};

RUR.simplify_python_traceback = function(info) {
    if (info.indexOf("RUR.set_lineno_highlight") !== -1){
        return "Highlight Problem";
    }
    info = info.replace("undefined", "undefined:");
    info = info.replace("\n", "<br>");
    info = info.replace("Traceback (most recent call last):<br>", '');
    info = info.replace(/module '*__main__'* line \d+\s/,"" );
    info = info.replace(/\s*RUR.set_lineno_highlight\(\d+\)/, "");
    info = info.replace(/\s*\^$/, "");
    return info;
};

RUR.runner.eval_javascript = function (src) {
    // do not "use strict"
    RUR.reset_definitions();
    eval(src); // jshint ignore:line
};

RUR.runner.eval_python = function (src) {
    // do not  "use strict"
    var pre_code = '', post_code = ''
    RUR.reset_definitions();
    if (RUR.current_world.pre_code){
        pre_code = RUR.current_world.pre_code;
    }
    if (RUR.current_world.post_code){
        post_code = RUR.current_world.post_code;
    }
    translate_python(src, RUR._highlight, pre_code, post_code);
};


RUR.runner.eval_coffee = function (src) {
    // do not  "use strict"
    RUR.reset_definitions();
    eval(CoffeeScript.compile(src)); // jshint ignore:line
};

RUR.runner.compile_coffee = function() {
    if (RUR.programming_language !== "coffee") {
        return;
    }
    var js_code = CoffeeScript.compile(editor.getValue());
    $("#stdout").html(js_code);
    $("#Reeborg-writes").dialog("open");
};