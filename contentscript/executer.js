/*jslint vars: true, plusplus: true*/
/*global console, chrome, COMMON, g_cmdList, cmdManager, cfgManager, window, $*/
var debugConsole = console;
var logBuffer = [];

function log(message) {
    'use strict';
    var dateStr = COMMON.DATESTR();
    dateStr = dateStr.slice(dateStr.indexOf(" ") + 1, dateStr.indexOf("."));
    logBuffer.unshift("[" + dateStr + "] " + message);
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
    var recruit = null;
    var loginBonus = null;
    var trans = false;
    var option = false;
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
            recruit: recruit !== null ? {
                statusText: "実行中！",
                state: recruit.cmd.state
            } : {
                state: COMMON.CMD_STATUS.END,
                statusText: "いぐー"
            },
            trans: trans !== false ? {
                statusText: "実行中！",
                state: COMMON.CMD_STATUS.ON
            } : {
                state: COMMON.CMD_STATUS.OFF,
                statusText: "いぐー"
            },
            option: option !== false ? {
                statusText: "実行中！",
                state: COMMON.CMD_STATUS.ON
            } : {
                state: COMMON.CMD_STATUS.OFF,
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

        cfgManager.InitTrans();

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
        var battleConfig = {};
        var recruitConfig = {};

        if (request.op === COMMON.OP.MAP) {
            var mapid = request.args.map + request.args.level;
            if (request.args.mapid) {
                mapid = request.args.mapid;
            }

            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                battleConfig = {};
                battleConfig.mapid = mapid;
                battleConfig.count = request.args.map_count;
                battleConfig.isFirst = request.args.isFirst;
                battleConfig.time = request.args.time;
                mapBattle = new cmdManager.CmdMapBattle(battleConfig, function () {
                    mapBattle = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                mapBattle.cmd.state = COMMON.CMD_STATUS.END;
                mapBattle = null;
            }

        } else if (request.op === COMMON.OP.DYSTOPIA) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                battleConfig = {};
                if (request.args.dystopia === 0) {
                    battleConfig.time = request.args.time;
                    dystopia = new cmdManager.CmdAllDystopia(battleConfig, function () {
                        dystopia = null;
                    });
                } else {
                    battleConfig.mapid = request.args.dystopia;
                    battleConfig.rank = request.args.dystopiaMode;
                    battleConfig.time = request.args.time;
                    dystopia = new cmdManager.CmdDystopia(battleConfig, function () {
                        dystopia = null;
                    });
                }
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                dystopia.cmd.state = COMMON.CMD_STATUS.END;
                dystopia = null;
            }

        } else if (request.op === COMMON.OP.RECRUIT) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                recruitConfig = {};
                recruitConfig.rarity = request.args.rarity;
                recruitConfig.maxnum = request.args.maxnum;
                recruitConfig.count = request.args.count;
                recruit = new cmdManager.CmdRecruit(recruitConfig, function () {
                    recruit = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                recruit.cmd.state = COMMON.CMD_STATUS.END;
                recruit = null;
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
                    battleConfig = {};
                    battleConfig.blockidList = blockidList;
                    battleConfig.time = request.args.time;
                    blockBattle = new cmdManager.CmdBlockBattle(battleConfig, function () {
                        blockBattle = null;
                    });
                }
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                if (blockBattle !== null) {
                    blockBattle.cmd.state = COMMON.CMD_STATUS.END;
                    blockBattle = null;
                }
            }

        } else if (request.op === COMMON.OP.TRANS) {
            if (request.ctrl === COMMON.OP_CTRL.ON) {
                log("変換ON");
                trans = true;
                var transConfig = {};
                transConfig.ratio = request.args.ratio;
                transConfig.threshold = request.args.threshold;
                cfgManager.Trans(true, transConfig);
            } else if (request.ctrl === COMMON.OP_CTRL.OFF) {
                log("変換OFF");
                trans = false;
                cfgManager.Trans(false, null);
            }

        } else if (request.op === COMMON.OP.TEST) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                test = new cmdManager.CmdTest(request.args.testData, function () {
                    test = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                test.cmd.state = COMMON.CMD_STATUS.END;
                test = null;
            }

        } else if (request.op === COMMON.OP.CONTENTS_DATA) {
            sendResponse(buildContentsData());
        }
    });
}());
