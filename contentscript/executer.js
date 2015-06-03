/*jslint vars: true, plusplus: true*/
/*global console, chrome, COMMON, config, g_cmdList, cmdManager, window, $*/
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
    var init = null;
    var battleBuff = null;
    var blockBattle = null;
    var mapBattle = null;
    var allDystopia = null;
    var dystopia = null;
    var gift = null;
    var recruit = null;
    var loginBonus = null;
    var townBattle = null;
    var townLvup = null;
    var test = null;

    /* Flag */
    var trans = false;
    var sudden = false;
    var battleDamage = false;
    var lvup = false;

    var item = null;        // Command用(Flagはconfig.itemを直接参照)

    /* background */
    var setting = {};
    var data = {};

    var townList = null;

    // ポップアップ表示用情報
    function buildContentsData() {
        return {
            // Command
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
            townBattle: townBattle !== null ? {
                statusText: "実行中！ - " + townBattle.counterStr,
                state: townBattle.cmd.state
            } : {
                statusText: "いぐー",
                state: COMMON.CMD_STATUS.END
            },
            townLvup: townList !== null ? townLvup !== null ? {
                townLvupDataList: townLvup.townLvupDataList,
                statusText: "実行中！",
                state: townLvup.cmd.state
            } : {
                statusText: "いぐー",
                state: COMMON.CMD_STATUS.END
            } : {
                statusText: "都市情報取得中",
                state: COMMON.CMD_STATUS.DISABLE
            },
            test: test !== null ? {
                statusText: "実行中！",
                state: test.cmd.state
            } : {
                state: COMMON.CMD_STATUS.END,
                statusText: "いぐー"
            },
            // Flag
            trans: trans !== false ? {
                fstate: COMMON.CMD_STATUS.ON
            } : {
                fstate: COMMON.CMD_STATUS.OFF
            },
            sudden: sudden !== false ? {
                fstate: COMMON.CMD_STATUS.ON
            } : {
                fstate: COMMON.CMD_STATUS.OFF
            },
            battleDamage: battleDamage !== false ? {
                fstate: COMMON.CMD_STATUS.ON
            } : {
                fstate: COMMON.CMD_STATUS.OFF
            },
            lvup: lvup !== false ? {
                statusText: COMMON.STATUSLIST + "を設定してください",
                fstate: COMMON.CMD_STATUS.ON
            } : {
                statusText: COMMON.STATUSLIST + "を設定してください",
                fstate: COMMON.CMD_STATUS.OFF
            },
            item: config.item.enable !== false ? item !== null ? {
                statusText: "実行中！",
                state: item.cmd.state,
                fstate: COMMON.CMD_STATUS.ON
            } : {
                statusText: "いぐー",
                state: COMMON.CMD_STATUS.END,
                fstate: COMMON.CMD_STATUS.ON
            } : {
                statusText: "いぐー",
                state: COMMON.CMD_STATUS.END,
                fstate: COMMON.CMD_STATUS.OFF
            },
            log: logBuffer.join("\n"),
            loginBonus: loginBonus === null ? "" : loginBonus.statusMsg,
            townList: townList
        };
    }

    var parseLvupCond = function (lvupCond) {
        var operator = {"<=": -1, "==": 0, ">=": 1};
        var ret = [[], [], [], [], [], []];

        var s = lvupCond.condstr;
        var n = lvupCond.point;
        var type = lvupCond.type;
        var elem = s.split(",");
        if (s === null || s.trim() === "") {
            return ret;
        }

        var total = 0;
        var i, j, k;
        for (i = 0; i < elem.length; i++) {
            var opFound = false;
            var op;
            for (op in operator) {
                if (operator.hasOwnProperty(op)) {
                    var x = elem[i].split(op);
                    if (x.length === 2) {
                        if (type === "vip" && operator[op] !== 0) {
                            throw "Syntax Error: 演算子は == のみ指定可能です: " + op;
                        }
                        opFound = true;
                        var key = x[0].trim();
                        var value = x[1].trim();
                        if (isNaN(value) || value > n || value < 0) {
                            throw "Illegal Value: 右辺は0から" + n + "の範囲で指定してください: " + value + " (Ex:DEF == 0, HP <= 3)";
                        }
                        value = Number(value);
                        var statusFound = false;
                        for (j = 0; j < COMMON.STATUSLIST.length; j++) {
                            if (key === COMMON.STATUSLIST[j]) {
                                if (operator[op] === 0) {
                                    total += value;
                                    if (total > n) {
                                        throw "Illegal Value: 合計値は" + n + "にしてください: " + total;
                                    }
                                    ret[j].push(value);
                                } else {
                                    if (operator[op] > 0) {
                                        total += value;
                                    }
                                    if (total > n) {
                                        throw "Illegal Value: 合計値は" + n + "以下にしてください: " + total;
                                    }
                                    for (k = value; k >= 0 && k <= n; k += operator[op]) {
                                        ret[j].push(k);
                                    }
                                }
                                statusFound = true;
                                break;
                            }
                        }
                        if (!statusFound) {
                            throw "Syntax Error: 左辺は " + COMMON.STATUSLIST + "のいずれかを指定してください: " + key + " (Ex:DEF == 0, HP <= 3)";
                        }
                        break;
                    }
                }
            }
            if (!opFound) {
                if (type === "dice") {
                    throw "Syntax Error: 演算子は <=, ==, >= のいずれかを指定してください (Ex:DEF == 0, HP <= 3)";
                } else if (type === "dice") {
                    throw "Syntax Error: 演算子は == のみを指定してください (Ex:DEF == 0, HP == 3)";
                }
            }
        }
        if (type === "vip" && total !== n) {
            throw "Illegal Value: 合計値は" + n + "ちょうどにしてください: " + total;
        }
        return ret;
    };

    var getConditionMsg = function (cond, maxPoint) {
        var s = "";
        var found = false;
        var i;
        for (i = 0; i < COMMON.STATUSLIST.length; i++) {
            if (cond[i].length === 0) {
                s += "";
            } else if (cond[i].length === 1) {
                found = true;
                s += COMMON.STATUSLIST[i] + "が" + cond[i][0] + ", ";
            } else {
                found = true;
                s += COMMON.STATUSLIST[i] + "が" + cond[i][0];
                if (cond[i][0] > cond[i][1]) {
                    s += "以下, ";
                } else {
                    s += "以上, ";
                }
            }
        }
        if (found) {
            s += "合計が" + maxPoint;
            return s;
        } else {
            return "合計が" + maxPoint;
        }
    };

    var saveSetting = function () {
        console.log(setting);
        var jsonString =  JSON.stringify(setting, null, 4);
        chrome.runtime.sendMessage({
            "op": COMMON.OP.SET_STORAGE_CONTENT,
            "storage": jsonString
        });
    };

    $(function () {
        window.setTimeout(function () {
            loginBonus = new cmdManager.CmdLoginBonus();
        }, 5000);

        init = new cmdManager.CmdInit(function () {
            townList = init.result.townlist;
            init = null;
        });

        var camp = new cmdManager.CmdCamp(function () {
            camp = null;
        });

        window.setInterval(function () {
            if (init === null) {
                chrome.runtime.sendMessage({
                    "op": COMMON.OP.GET_STORAGE_CONTENT
                }, function (response) {
                    setting = JSON.parse(response.storage);
                    data = response.data;
                });
            }
        }, COMMON.INTERVAL.SETTING);
    });

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        var battleConfig = {};
        var giftConfig = {};
        var recruitConfig = {};
        var townLvupConfig = [];
        var itemConfig = {};
        var i, args;

        if (request.op === COMMON.OP.MAP) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                battleConfig = {};
                if (request.args.map === -1) {
                    battleConfig.mapid = request.args.mapid;
                } else {
                    battleConfig.mapid = request.args.map + request.args.level;
                }
                battleConfig.count = request.args.map_count;
                battleConfig.isFirst = request.args.isFirst;
                battleConfig.time = request.args.time;
                battleConfig.sudden = request.args.sudden;
                battleConfig.maid = request.args.maid;
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
                    battleConfig.maid = request.args.maid;
                    battleConfig.time_hell = request.args.time_hell;
                    battleConfig.maid_hell = request.args.maid_hell;
                    dystopia = new cmdManager.CmdAllDystopia(battleConfig, function () {
                        dystopia = null;
                    });
                } else {
                    battleConfig.mapid = request.args.dystopia;
                    battleConfig.rank = request.args.dystopiaMode;
                    battleConfig.time = request.args.time;
                    battleConfig.maid = request.args.maid;
                    battleConfig.time_hell = request.args.time_hell;
                    battleConfig.maid_hell = request.args.maid_hell;
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
                } else {
                    battleConfig = {};
                    battleConfig.time = request.args.time;
                    battleConfig.sudden = request.args.sudden;
                    battleConfig.maid = request.args.maid;
                    var blockid;
                    if (request.args.map === "0") {
                        blockBattle = new cmdManager.CmdAllBossBlock(battleConfig, function () {
                            blockBattle = null;
                        });
                    } else if (request.args.map === "-1") {
                        blockid = request.args.blockid;
                    } else {
                        blockid = request.args.map;
                    }
                    if (request.args.map !== "0") {
                        blockid = blockid.toString().split(",").map(parseFloat);
                        var blockidList = [];
                        for (i = 0; i < request.args.block_count; i++) {
                            blockidList.push.apply(blockidList, blockid);
                        }
                        battleConfig.blockidList = blockidList;
                        blockBattle = new cmdManager.CmdBlockBattle(battleConfig, function () {
                            blockBattle = null;
                        });
                    }
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

        } else if (request.op === COMMON.OP.TOWNBATTLE) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                if (townBattle !== null) {
                    townBattle.cmd.state = COMMON.CMD_STATUS.RUN;
                } else {
                    battleConfig = {};
                    battleConfig.player = (request.args.player).split(",").map(function (s) { return s.trim(); });
                    battleConfig.time = request.args.time;
                    //battleConfig.sudden = request.args.sudden;
                    //battleConfig.maid = request.args.maid;
                    townBattle = new cmdManager.CmdTownBattle(battleConfig, function () {
                        townBattle = null;
                    });
                    if (!battleBuff) {
                        battleBuff = new cmdManager.CmdBattleBuff(function () {
                            battleBuff = null;
                        });
                    }
                }
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                if (townBattle !== null) {
                    townBattle.cmd.state = COMMON.CMD_STATUS.END;
                    townBattle = null;
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
                recruitConfig.isSpBhv = request.args.isSpBhv;
                recruitConfig.isStriker = request.args.isStriker;
                recruitConfig.isGoldBhv = request.args.isGoldBhv;
                recruit = new cmdManager.CmdRecruit(recruitConfig, function () {
                    recruit = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                recruit.cmd.state = COMMON.CMD_STATUS.END;
                recruit = null;
            }

        } else if (request.op === COMMON.OP.TOWNLVUP && townList) {
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                townLvupConfig = {};
                townLvupConfig.data = [];
                townLvupConfig.data = request.args.data;
                townLvupConfig.isLowest = request.args.isLowest;
                townLvup = new cmdManager.CmdTownLvup(townLvupConfig, function () {
                    townLvup = null;
                });
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                townLvup.cmd.state = COMMON.CMD_STATUS.END;
                townLvup = null;
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
                    config.trans.ratio = request.args.ratio * 0.01;
                    config.trans.threshold = request.args.threshold * 0.01;
                }
                config.trans.enable = trans;
                args = request.args;
                args.enable = trans;
                sendResponse(args);
                if (trans) {
                    log("[Flag]変換ON");
                } else {
                    log("[Flag]変換OFF");
                }
            } else if (request.ctrl === COMMON.OP_CTRL.CHANGE && trans === true) {
                log("[Flag]変換OFF");
                trans = false;
                config.trans.enable = trans;
                args = request.args;
                args.enable = trans;
                sendResponse(args);
            }

        } else if (request.op === COMMON.OP.SUDDEN) {
            if (request.ctrl === COMMON.OP_CTRL.FLAG) {
                sudden = !sudden;
                if (!request.args.minhp) {
                    log("サドンの設定値がおかしいので確認しろばか");
                    sudden = false;
                } else {
                    config.sudden.minhp = request.args.minhp;
                }
                config.sudden.assist = request.args.assist;
                config.sudden.enable = sudden;
                args = request.args;
                args.enable = sudden;
                sendResponse(args);
                if (sudden) {
                    log("[Flag]サドンON");
                } else {
                    log("[Flag]サドンOFF");
                }
            } else if (request.ctrl === COMMON.OP_CTRL.CHANGE && sudden === true) {
                log("[Flag]サドンOFF");
                sudden = false;
                config.sudden.enable = sudden;
                args = request.args;
                args.enable = sudden;
                sendResponse(args);
            }

        } else if (request.op === COMMON.OP.BATTLEDAMAGE) {
            if (request.ctrl === COMMON.OP_CTRL.FLAG) {
                battleDamage = !battleDamage;
                if (request.args.minhp < 0 || request.args.minhp > 100) {
                    log("ダメージの設定値がおかしいので確認しろばか");
                    battleDamage = false;
                } else {
                    config.battleDamage.minhp = request.args.minhp * 0.01;
                }
                config.battleDamage.enable = battleDamage;
                args = request.args;
                args.enable = battleDamage;
                sendResponse(args);
                if (battleDamage) {
                    log("[Flag]戦闘後ダメージON");
                } else {
                    log("[Flag]戦闘後ダメージOFF");
                }
            } else if (request.ctrl === COMMON.OP_CTRL.CHANGE && battleDamage === true) {
                log("[Flag]戦闘後ダメージOFF");
                battleDamage = false;
                config.battleDamage.enable = battleDamage;
                args = request.args;
                args.enable = battleDamage;
                sendResponse(args);
            }

        } else if (request.op === COMMON.OP.LVUP) {
            var cond;
            if (request.ctrl === COMMON.OP_CTRL.FLAG) {
                lvup = !lvup;

                args = request.args;
                for (i = 0; i < args.data.length; i++) {
                    try {
                        cond = parseLvupCond(args.data[i]);
                        args.data[i].status = getConditionMsg(cond, args.data[i].point);
                        args.data[i].cond = cond;
                        args.data[i].judge = true;
                    } catch (e1) {
                        args.data[i].status = e1;
                        args.data[i].judge = false;
                        lvup = false;
                    }
                    if (args.data[i].name === "") {
                        args.data[i].judge = false;
                        lvup = false;
                    }
                }
                args.enable = lvup;
                sendResponse(args);

                config.lvup.enable = lvup;
                if (lvup) {
                    config.lvup.data = args.data;
                    log("[Flag]ストライカーレベルアップON");
                } else {
                    log("[Flag]ストライカーレベルアップOFF");
                }
            } else if (request.ctrl === COMMON.OP_CTRL.CHANGE) {
                //log("[Flag]ストライカーレベルアップOFF");
                lvup = false;

                args = request.args;
                for (i = 0; i < args.data.length; i++) {
                    try {
                        cond = parseLvupCond(args.data[i]);
                        args.data[i].status = getConditionMsg(cond, args.data[i].point);
                        args.data[i].cond = cond;
                        args.data[i].judge = true;
                    } catch (e2) {
                        args.data[i].status = e2;
                        args.data[i].judge = false;
                    }
                    if (args.data[i].name === "") {
                        args.data[i].judge = false;
                    }
                }
                args.enable = lvup;
                sendResponse(args);

                config.lvup.enable = lvup;
            }

        } else if (request.op === COMMON.OP.ITEM) {
            // Command
            if (request.ctrl === COMMON.OP_CTRL.RUN) {
                // 強制的にON
                if (!config.item.enable) {
                    if (config.setItemConfig(request.args)) {
                        config.item.enable = true;
                        log("[Flag]アイテム整理ON");
                    }
                }
                if (config.item.enable) {
                    item = new cmdManager.CmdCleanBag(function () {
                        item = null;
                    });
                } else {
                    log("アイテム整理実行に失敗 設定を確認してください");
                }
            } else if (request.ctrl === COMMON.OP_CTRL.ABORT) {
                item.cmd.state = COMMON.CMD_STATUS.END;
                item = null;

            // Flag
            } else if (request.ctrl === COMMON.OP_CTRL.FLAG) {
                // ON/OFFボタンが押されたら、enableを切り替える
                // configの値を書き換えるのはOFF->ONの時のみ
                // configのenble

                // OFF->ON
                if (!config.item.enable) {
                    if (config.setItemConfig(request.args)) {
                        config.item.enable = true;
                        log("[Flag]アイテム整理ON");
                    }
                // ON->OFF
                } else {
                    config.item.enable = false;
                    log("[Flag]アイテム整理OFF");
                }
            } else if (request.ctrl === COMMON.OP_CTRL.CHANGE) {
                // 何か入力されたら、enableをfalseにする
                config.item.enable = false;
            }

            args = request.args;
            args.enable = config.item.enable;
            sendResponse(request.args);

        } else if (request.op === COMMON.OP.CONTENTS_DATA) {
            sendResponse(buildContentsData());

        // sotrageに保存されたポップアップ上の入力情報($scope.args)をconfigへ反映する
        // 各Flagのenableもstorageに保存されるため、configdata, storage, $scope.argsのenableを常に一致させておく必要がある
        } else if (request.op === COMMON.OP.INIT) {
            trans = request.args[COMMON.OP.TRANS].enable;
            if (request.args[COMMON.OP.TRANS].ratio < 0 || request.args[COMMON.OP.TRANS].ratio > 100 ||
                    request.args[COMMON.OP.TRANS].threshold < 0 || request.args[COMMON.OP.TRANS].threshold > 100) {
                log("変換の設定値がおかしいので確認しろばか");
                trans = false;
            } else {
                config.trans.ratio = request.args[COMMON.OP.TRANS].ratio * 0.01;
                config.trans.threshold = request.args[COMMON.OP.TRANS].threshold * 0.01;
            }
            config.trans.enable = trans;

            sudden = request.args[COMMON.OP.SUDDEN].enable;
            if (!request.args[COMMON.OP.SUDDEN].minhp) {
                log("サドンの設定値がおかしいので確認しろばか");
                sudden = false;
            } else {
                config.sudden.minhp = request.args[COMMON.OP.SUDDEN].minhp;
            }
            config.sudden.assist = request.args[COMMON.OP.SUDDEN].assist;
            config.sudden.enable = sudden;

            battleDamage = request.args[COMMON.OP.BATTLEDAMAGE].enable;
            if (request.args[COMMON.OP.BATTLEDAMAGE].minhp < 0 || request.args[COMMON.OP.BATTLEDAMAGE].minhp > 100) {
                log("ダメージの設定値がおかしいので確認しろばか");
                battleDamage = false;
            } else {
                config.battleDamage.minhp = request.args[COMMON.OP.BATTLEDAMAGE].minhp * 0.01;
            }
            config.battleDamage.enable = battleDamage;

            lvup = request.args[COMMON.OP.LVUP].enable;
            config.lvup.data = request.args[COMMON.OP.LVUP].data;
            config.lvup.enable = lvup;

            config.setItemConfig(request.args[COMMON.OP.ITEM]);
            config.item.enable = request.args[COMMON.OP.ITEM].enable;
        }
    });
}());
