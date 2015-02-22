/*jslint vars: true, plusplus: true*/
/*global console, chrome, COMMON, g_cmdList, cmdManager*/
var debugConsole = console;
var logBuffer = [];

function log(message) {
    'use strict';
    logBuffer.unshift("[" + COMMON.DATESTR() + "] " + message);
    if (logBuffer.length > COMMON.LOG.MAX) {
        logBuffer.splice(COMMON.LOG.MAX);
    }
    console.log(message);
}
/*
console.log = function (message) {
    log(message);
    //debugConsole(message);
};
*/
(function () {

    'use strict';
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

        if (request.op === COMMON.OP.MAP) {
            var mapid = request.args.map + request.args.level;
            var mapBattle = new cmdManager.CmdMapBattle(mapid);

        } else if (request.op === COMMON.OP.ALLDYSTOPIA) {
            var allDystopia = new cmdManager.CmdAllDystopia();

        } else if (request.op === COMMON.OP.DYSTOPIA) {
            var dystopia = new cmdManager.CmdDystopia(request.args.dystopia, request.args.dystopiaMode);

        } else if (request.op === COMMON.OP.LOG) {
            var log = logBuffer.join("\n");
            sendResponse({log: log});

        } else if (request.op === COMMON.OP.BLOCK) {
            var blockid;
            if (request.args.blockid === undefined) {
                blockid = request.args.block;
            } else {
                blockid = request.args.blockid;
            }
            var blockidList = [];
            var i;
            for (i = 0; i < request.args.block_count; i++) {
                blockidList.push(blockid);
            }
            var blockBattle = new cmdManager.CmdBlockBattle(blockidList);
        }

    });
}());
