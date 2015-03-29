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
    var battleBuff = null;
    var blockBattle = null;
    var mapBattle = null;
    var allDystopia = null;
    var dystopia = null;
    var gift = null;
    var recruit = null;
    var loginBonus = null;
    var test = null;

    /* Flag */
    var trans = false;
    var sudden = false;

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
            gift: gift !== null ? {
                statusText: "実行中！ - " + gift.stateStr,
                state: gift.cmd.state
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
            test: test !== null ? {
                statusText: "実行中！",
                state: test.cmd.state
            } : {
                state: COMMON.CMD_STATUS.END,
                statusText: "いぐー"
            },
            trans: trans !== false ? {
                state: COMMON.CMD_STATUS.ON
            } : {
                state: COMMON.CMD_STATUS.OFF
            },
            sudden: sudden !== false ? {
                state: COMMON.CMD_STATUS.ON
            } : {
                state: COMMON.CMD_STATUS.OFF
            },
            log: logBuffer.join("\n"),
            loginBonus: loginBonus === null ? "" : loginBonus.statusMsg
        };
    }

    $(function () {
        window.setTimeout(function () {
            loginBonus = new cmdManager.CmdLoginBonus();
        }, 5000);

        //cfgManager.InitTrans();
        var camp = new cmdManager.CmdCamp(function () {
            camp = null;
        });

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
        var giftConfig = {};
        var recruitConfig = {};

        if (request.op === COMMON.OP.MAP) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                /*var mapid = request.args.map + request.args.level;
                if (request.args.mapid) {
                    mapid = request.args.mapid;
                }*/

                battleConfig = {};
                battleConfig.mapid = request.args.mapid || request.args.map + request.args.level;
                battleConfig.count = request.args.map_count;
                battleConfig.isFirst = request.args.isFirst;
                battleConfig.time = request.args.time;
                mapBattle = new cmdManager.CmdMapBattle(battleConfig, function () {
                    mapBattle = null;
                });
                if (!battleBuff) {
                    battleBuff = new cmdManager.CmdBattleBuff(function () {
                        battleBuff = null;
                    });
                }
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
                if (!battleBuff) {
                    battleBuff = new cmdManager.CmdBattleBuff(function () {
                        battleBuff = null;
                    });
                }
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
                } else if (request.args.blockid === "" && request.args.map === "0") {
                    battleConfig.time = request.args.time;
                    blockBattle = new cmdManager.CmdAllBossBlock(battleConfig, function () {
                        blockBattle = null;
                    });
                    if (!battleBuff) {
                        battleBuff = new cmdManager.CmdBattleBuff(function () {
                            battleBuff = null;
                        });
                    }
                } else {
                    var blockid;
                    if (request.args.blockid === "") {
                        blockid = request.args.map;
                    } else {
                        blockid = request.args.blockid;
                    }
                    blockid = blockid.toString().split(",").map(parseFloat);
                    var blockidList = [];
                    var i;
                    for (i = 0; i < request.args.block_count; i++) {
                        blockidList.push.apply(blockidList, blockid);
                    }
                    battleConfig = {};
                    battleConfig.blockidList = blockidList;
                    battleConfig.time = request.args.time;
                    blockBattle = new cmdManager.CmdBlockBattle(battleConfig, function () {
                        blockBattle = null;
                    });
                    if (!battleBuff) {
                        battleBuff = new cmdManager.CmdBattleBuff(function () {
                            battleBuff = null;
                        });
                    }
                }
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                if (blockBattle !== null) {
                    blockBattle.cmd.state = COMMON.CMD_STATUS.END;
                    blockBattle = null;
                }
            }

        } else if (request.op === COMMON.OP.GIFT) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                giftConfig.maidName = request.args.maid;
                giftConfig.itemList = request.args.itemList.split(",").map(function (s) { return s.trim(); });
                gift = new cmdManager.CmdGiftToMaid(giftConfig, function () {
                    gift = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                gift.cmd.state = COMMON.CMD_STATUS.END;
                gift = null;
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

        } else if (request.op === COMMON.OP.TEST) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                test = new cmdManager.CmdTest(request.args.testData, function () {
                    test = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                test.cmd.state = COMMON.CMD_STATUS.END;
                test = null;
            }

        } else if (request.op === COMMON.OP.TRANS) {
            if (request.ctrl === COMMON.OP_CTRL.FLAG) {
                trans = !trans;
                if (request.args.ratio < 0 || request.args.ratio > 100 ||
                        request.args.threshold < 0 || request.args.threshold > 100) {
                    log("変換の設定値がおかしいので確認しろばか");
                    trans = false;
                } else {
                    COMMON.TRANS.RATIO = request.args.ratio * 0.01;
                    COMMON.TRANS.THRESHOLD = request.args.threshold * 0.01;
                }
                COMMON.TRANS.ENABLE = trans;
                sendResponse(trans);
                if (trans) {
                    log("[Flag]変換ON");
                } else {
                    log("[Flag]変換OFF");
                }
            } else if (request.ctrl === COMMON.OP_CTRL.CHANGE && trans === true) {
                log("[Flag]変換OFF");
                trans = false;
                COMMON.TRANS.ENABLE = trans;
                sendResponse(trans);
            }

        } else if (request.op === COMMON.OP.SUDDEN) {
            if (request.ctrl === COMMON.OP_CTRL.FLAG) {
                sudden = !sudden;
                if (!request.args.minhp) {
                    log("サドンの設定値がおかしいので確認しろばか");
                    sudden = false;
                } else {
                    COMMON.SUDDEN.MINHP = request.args.minhp;
                }
                COMMON.SUDDEN.ENABLE = sudden;
                sendResponse(sudden);
                if (sudden) {
                    log("[Flag]サドンON");
                } else {
                    log("[Flag]サドンOFF");
                }
            } else if (request.ctrl === COMMON.OP_CTRL.CHANGE && sudden === true) {
                log("[Flag]サドンOFF");
                sudden = false;
                COMMON.SUDDEN.ENABLE = sudden;
                sendResponse(sudden);
            }

        } else if (request.op === COMMON.OP.CONTENTS_DATA) {
            sendResponse(buildContentsData());

        } else if (request.op === COMMON.OP.INIT) {
            trans = request.args[COMMON.OP.TRANS].enable;
            if (request.args[COMMON.OP.TRANS].ratio < 0 || request.args[COMMON.OP.TRANS].ratio > 100 ||
                    request.args[COMMON.OP.TRANS].threshold < 0 || request.args[COMMON.OP.TRANS].threshold > 100) {
                log("変換の設定値がおかしいので確認しろばか");
                trans = false;
            } else {
                COMMON.TRANS.RATIO = request.args[COMMON.OP.TRANS].ratio * 0.01;
                COMMON.TRANS.THRESHOLD = request.args[COMMON.OP.TRANS].threshold * 0.01;
            }
            COMMON.TRANS.ENABLE = trans;

            sudden = request.args[COMMON.OP.SUDDEN].enable;
            if (!request.args[COMMON.OP.SUDDEN].minhp) {
                log("サドンの設定値がおかしいので確認しろばか");
                sudden = false;
            } else {
                COMMON.SUDDEN.MINHP = request.args[COMMON.OP.SUDDEN].minhp;
            }
            COMMON.SUDDEN.ENABLE = sudden;
        }
    });
}());
