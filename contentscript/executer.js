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

    /* Command Instances */
    var blockBattle = null;
    var mapBattle = null;
    var allDystopia = null;
    var dystopia = null;

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

        if (request.op === COMMON.OP.MAP) {
            var mapid = request.args.map + request.args.level;
            mapBattle = new cmdManager.CmdMapBattle(mapid);

        } else if (request.op === COMMON.OP.ALLDYSTOPIA) {
            allDystopia = new cmdManager.CmdAllDystopia();

        } else if (request.op === COMMON.OP.DYSTOPIA) {
            dystopia = new cmdManager.CmdDystopia(request.args.dystopia, request.args.dystopiaMode);

        } else if (request.op === COMMON.OP.LOG) {
            var log = logBuffer.join("\n");
            sendResponse({log: log});

        } else if (request.op === COMMON.OP.BLOCK) {
            if (request.state === COMMON.OPCTRL.NEW) {
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
                blockBattle = new cmdManager.CmdBlockBattle(blockidList, function () {
                    blockBattle = null;
                    chrome.runtime.sendMessage({
                        "op": COMMON.OP.BLOCK,
                        "state": COMMON.OPCTRL.END
                    }, function (response) {});
                });
            } else if (request.state === COMMON.OPCTRL.PAUSE) {
                if (blockBattle !== null) {
                    blockBattle.cmd.state = "PAUSE";
                }
            } else if (request.state === COMMON.OPCTRL.RESUME) {
                if (blockBattle !== null) {
                    blockBattle.cmd.state = "RUN";
                }
            } else if (request.state === COMMON.OPCTRL.ABORT) {
                if (blockBattle !== null) {
                    blockBattle.cmd.state = "END";
                }
            }

        } else if (request.op === COMMON.OP.BLOCKBATTLECOUNTER) {
            if (blockBattle !== null) {
                sendResponse({msg: blockBattle.counterStr});
            } else {
                sendResponse({msg: ""});
            }
        }
    });
}());
