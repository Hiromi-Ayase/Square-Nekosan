/*jslint vars: true*/
/*global console, chrome, COMMON, g_mapid, GetBlockid, repeatBattle*/
var debugConsole = console;
var logBuffer = [];

function log (message) {
    'use strict';
    logBuffer.unshift("[" + COMMON.NOW() + "] " + message);
    if (logBuffer.length > COMMON.LOG.MAX) {
        logBuffer.splice(COMMON.LOG.MAX);
    }
}

console.log = function (message) {
    log(message);
    //debugConsole(message);
};

(function () {

    'use strict';
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

        if (request.op === COMMON.OP.MAP) {
            g_mapid = request.args.map + request.args.level;
            GetBlockid()
                .then(repeatBattle);
        } else if (request.op === COMMON.OP.DYSTOPIA) {
            isAvailableDystopia(request.args.dystopia, request.args.dystopiaMode)
                .then(getAllBlockidDystopia)
                .then(repeatBattle);
        } else if (request.op === COMMON.OP.LOG) {
            var log = logBuffer.join("\n");
            sendResponse({log: log});
        }
    });
}());
