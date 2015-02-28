/*jslint vars: true, plusplus: true*/
/*global console, chrome, COMMON, g_cmdList, cmdManager, window, $*/
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
    var loginBonus = null;
    var test = null;

    var setting = null;
    var data = null;

    function buildContentsData() {
        return {
            block: blockBattle !== null ? {
                statusText: "実行中！ - " + blockBattle.counterStr,
                state: blockBattle.cmd.state
            } : {
                statusText: "いぐー",
                state: COMMON.CMD_STATUS.END
            },
            map: mapBattle !== null ? {
                statusText: "実行中！",
                state: mapBattle.cmd.state
            } : {
                statusText: "いぐー",
                state: COMMON.CMD_STATUS.END
            },
            dystopia: dystopia !== null ? {
                statusText: "実行中！",
                state: dystopia.cmd.state
            } : {
                state: COMMON.CMD_STATUS.END,
                statusText: "いぐー"
            },
            test: test !== null ? {
                statusText: "実行中！",
                state: test.cmd.state
            } : {
                state: COMMON.CMD_STATUS.END,
                statusText: "いぐー"
            },
            log: logBuffer.join("\n"),
            loginBonus: loginBonus === null ? "" : loginBonus.statusMsg
        };
    }

    $(function () {
        window.setTimeout(function () {
            loginBonus = new cmdManager.CmdLoginBonus();
        }, 5000);

        window.setInterval(function () {
            chrome.runtime.sendMessage({
                "op": "get"
            }, function (response) {
                setting = JSON.parse(response.storage);
                data = response.data;
            });
        }, COMMON.INTERVAL.SETTING);
    });

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

        if (request.op === COMMON.OP.MAP) {
            var mapid = request.args.map + request.args.level;
            if (request.args.mapid) {
                mapid = request.args.mapid;
            }

            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                mapBattle = new cmdManager.CmdMapBattle(mapid, function () {
                    mapBattle = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                mapBattle.cmd.state = COMMON.CMD_STATUS.END;
                mapBattle = null;
            }

        } else if (request.op === COMMON.OP.ALLDYSTOPIA) {
            allDystopia = new cmdManager.CmdAllDystopia();

        } else if (request.op === COMMON.OP.DYSTOPIA) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                dystopia = new cmdManager.CmdDystopia(request.args.dystopia, request.args.dystopiaMode, function () {
                    dystopia = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                dystopia.cmd.state = COMMON.CMD_STATUS.END;
                dystopia = null;
            }
        } else if (request.op === COMMON.OP.BLOCK) {
            if (request.ctrl === COMMON.OP_CTRL.PAUSE) {
                if (blockBattle !== null) {
                    blockBattle.cmd.state = COMMON.CMD_STATUS.PAUSE;
                }
            } else if (request.ctrl === COMMON.OP_CTRL.RUN) {
                if (blockBattle !== null) {
                    blockBattle.cmd.state = COMMON.CMD_STATUS.RUN;
                } else {
                    var blockid;
                    if (request.args.blockid === undefined || request.args.blockid === "") {
                        blockid = request.args.map;
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
                    });
                }
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                if (blockBattle !== null) {
                    blockBattle.cmd.state = COMMON.CMD_STATUS.END;
                    blockBattle = null;
                }
            }

        } else if (request.op === COMMON.OP.CONTENTS_DATA) {
            sendResponse(buildContentsData());

        } else if (request.op === COMMON.OP.TEST) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                dystopia = new cmdManager.CmdTest(request.args.testData, function () {
                    test = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                test.cmd.state = COMMON.CMD_STATUS.END;
                test = null;
            }
        }
    });
}());
