/*jslint vars: true, plusplus: true*/
/*global $, console, log, chrome, COMMON, task, DystopiaMapList, TRANS,
waitTime, executeTask*/

/*
コマンド：ユーザの入力単位、cmd*
タスク：コマンドが実行する処理単位、中身は1つ以上の関数、
       タスク実行中に他のタスクが割り込むことはできない、ユーザ入力による中断も不可
*/
/* --- タスクリスト ---
GetDystopiaMap : 指定マップが魔界戦入場可能マップか判定し、入場可能であれば全blockidを取得
GetBlockid : 指定マップ内の全blockidを取得
Battle : 1blockで戦闘（最大攻略可能PT数取得～資源量更新）
GetLvupChara : レベルアップ可能なキャラを取得する
LvupChara : キャラをレベルアップさせる

Translations : 資源の変換
AttackSudden : サドンボスを叩く
GetLoginBonus : ログインボーナスを取得
CampBattle : 拠点戦に参加
Inventory : 荷物整理
ReportQuest : 任務報告
（ジュールズベルグ、ゼクスタワー）
*/

/* --- タスク管理用変数 --- */

var cmdManager = {};
var cfgManager = {};
(function () {
    'use strict';

    var cmdList = [];

    var sendMessage = function (op, key) {
        chrome.runtime.sendMessage({
            "op": op,
            "key": key
        }, function (response) {
            return response;
        });
    };

    function waitTime(time) {
        var defer = $.Deferred();
        setTimeout(function () {
            defer.resolve();
        }, time);
        return defer.promise();
    }

    /* タスクの実行および終了コマンドの削除 */
    // これ非同期処理にする必要ないかも
    function executeTask() {
        var defer = $.Deferred();

        // 終了済みのコマンドをリストから削除する
        var i = 0;
        for (i = 0; i < cmdList.length; i++) {
            if (cmdList[i].cmd.state === COMMON.CMD_STATUS.END) {
                if (cmdList[i].cmd.endHandler) {
                    cmdList[i].cmd.endHandler();
                }
                cmdList.splice(i, 1);
                i--;
            }
        }

        // コマンドリストを時間で並び替え、先頭のコマンドのタスクを実行する
        // 終わったら次のタスクをセットする
        if (cmdList.length !== 0) {
            cmdList.sort(function (a, b) {
                return a.cmd.time - b.cmd.time;
            });
            var now = new Date();
            for (i = 0; i < cmdList.length; i++) {
                if (cmdList[i].cmd.time < now && cmdList[i].cmd.state === COMMON.CMD_STATUS.RUN) {
                    break;
                }
            }
            if (i < cmdList.length) {
                var task = cmdList[i].cmd;
                task.func(task.param)
                    .then(function (result) {
                        task.funcState = COMMON.CMD_RESULT.OK;
                        task.result = result;
                    }, function (result) {
                        task.funcState = COMMON.CMD_RESULT.NG;
                        task.result = result;
                    })
                    .always(function () {
                        if (cmdList[i].setNextTask() === null) {
                            cmdList.splice(i, 1);
                        }
                        defer.resolve();
                    });
            } else {
                defer.resolve();
            }
        } else {
            defer.resolve();
        }

        return defer.promise();
    }

    /* 一定時間ごとに実行するタスクがあるかチェックする */
    cmdManager.pollTask = function () {
        var defer = $.Deferred();

        waitTime(1000)
            .then(executeTask)
            .then(cmdManager.pollTask);

        return defer.promise();
    };

    /**
     * Check if Battle commands are running or not
     * @returns {Boolean} If running, return true
     */
    cmdManager.IsBattleCmd = function () {
        var battleCmdList = [
            "CmdMapBattle",
            "CmdBlockBattle",
            "CmdDystopia",
            "CmdAllDystopia"
        ];
        var i;
        for (i = 0; i < cmdList.length; i++) {
            if ($.inArray(cmdList[i].cmd.name, battleCmdList) !== -1) {
                return true;
            }
        }
        return false;
    };

    /* 共通のコマンドオブジェクト */
    function Command(name, handler) {
        this.name = name;
        this.state = COMMON.CMD_STATUS.RUN; // RUN, PAUSE, ABORT, END

        this.time = null;
        this.func = null;
        this.param = null;
        this.result = null;
        this.funcState = null;

        this.endHandler = handler;

        var now = new Date();
        this.time = now;
    }

    Command.prototype.reset = function () {
        this.time = null;
        this.func = null;
        this.param = null;
        this.result = null;
        this.funcState = null;

        var now = new Date();
        this.time = now;
    };

    /* Command : 指定されたマップの初めから順にすべてのマスで手動戦闘する */
    cmdManager.CmdMapBattle = function (battleConfig, handler) {
        this.mapid = battleConfig.mapid;
        this.battleCount = battleConfig.count;
        this.isFirst = battleConfig.isFirst;
        this.time = battleConfig.time;

        this.blockid = null;
        //this.blockidList = null;

        this.round = 0;

        this.cmd = new Command("CmdMapBattle", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdMapBattle.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null) {
            cmd.reset();

            cmd.time = now;
            cmd.func = task.GetNextBlockid;
            cmd.param = {
                mapid: this.mapid,
                blockid: null,
                isFirst: this.isFirst
            };

        } else if (cmd.func === task.GetNextBlockid) {
            if (cmd.result.blockid) {
                if (cmd.result.isEnd) {
                    this.battleCount--;
                }
                if (this.battleCount <= 0) {
                    cmd.state = COMMON.CMD_STATUS.END;
                } else {
                    this.blockid = cmd.result.blockid;
                    this.round++;

                    cmd.reset();
                    cmd.time = now;
                    cmd.func = task.Battle;
                    cmd.param = {
                        blockid: this.blockid,
                        time: this.time,
                        round: this.round
                    };
                }
            } else {
                cmd.state = COMMON.CMD_STATUS.END;
            }

        } else if (cmd.func === task.Battle) {
            cmd.reset();

            cmd.time = now;
            cmd.func = task.GetNextBlockid;
            cmd.param = {
                mapid: this.mapid,
                blockid: this.blockid,
                isFirst: null
            };
        }
    };

    /* Command : 指定された1つ以上のマスで手動戦闘する */
    cmdManager.CmdBlockBattle = function (battleConfig, handler) {
        this.blockidList = battleConfig.blockidList;
        this.battleCount = battleConfig.blockidList.length;
        this.counterStr = "";
        this.time = battleConfig.time;

        this.round = 0;

        this.cmd = new Command("CmdBlockBattle", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdBlockBattle.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null || cmd.func === task.Battle) {
            var blockid = (this.blockidList).shift();
            cmd.reset();

            if (blockid) {
                this.round++;
                this.counterStr = this.round + "回目/" + this.battleCount + "回中";

                cmd.time = now;
                cmd.func = task.Battle;
                var battleData = {
                    blockid: blockid,
                    time: this.time,
                    round: this.round
                };
                cmd.param = battleData;
            } else {
                cmd.state = COMMON.CMD_STATUS.END;
            }
        }
    };

    /* Command : 全マップの攻略済みの最高難易度のボスのマスで手動戦闘する */
    cmdManager.CmdAllBossBlock = function (battleConfig, handler) {
        this.counterStr = "ボスのマスID取得中";

        this.battleConfig = battleConfig;
        this.handler = handler;

        this.cmd = new Command("CmdAllBossBlock");
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdAllBossBlock.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null || cmd.func === task.Battle) {
            cmd.reset();
            cmd.func = task.GetAllBossBlockid;
        } else if (cmd.func === task.GetAllBossBlockid) {
            console.log("Boss blockid = " + cmd.result);
            this.battleConfig.blockidList = cmd.result;
            var c = new cmdManager.CmdBlockBattle(this.battleConfig, this.handler);
            this.counterStr = c.counterStr;
            this.cmd = c.cmd;
            return null;
        }
    };

    /* Command : 入場可能な魔界戦マップすべてで手動戦闘する（攻略済みがあってもOK） */
    cmdManager.CmdAllDystopia = function (battleConfig, handler) {
        this.mapno = 0;     // DystopiaMapListのうち何番目のマップか
        this.rank = 0;      // 0:Heaven, 1:Hell
        this.blockidList = null;
        this.battleCount = 0;
        this.time = battleConfig.time;

        this.round = 0;

        this.cmd = new Command("CmdAllDystopia", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdAllDystopia.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null) {
            cmd.reset();

            cmd.time = now;
            cmd.func = task.GetDystopiaMap;
            cmd.param = {
                mapid: DystopiaMapList[0],
                rank: this.rank
            };

        } else if (cmd.func === task.GetDystopiaMap || cmd.func === task.Battle) {
            if (cmd.func === task.GetDystopiaMap) {
                this.blockidList = cmd.result.blockidList;
            }
            var blockid = (this.blockidList).shift();
            cmd.reset();

            if (blockid) {
                this.round++;
                var battleTime = this.time;
                // Hellは攻略に時間をかける
                if (this.rank === 1) {
                    battleTime = {
                        min: 180,
                        max: 240
                    };
                }
                cmd.time = now;
                cmd.func = task.Battle;
                cmd.param = {
                    blockid: blockid,
                    time: battleTime,
                    round: this.round
                };
            } else {
                this.mapno++;
                if (this.mapno < DystopiaMapList.length) {
                    cmd.time = now;
                    cmd.func = task.GetDystopiaMap;
                    cmd.param = {
                        mapid: DystopiaMapList[this.mapno],
                        rank: this.rank
                    };
                } else if (this.rank === 0) {
                    this.mapno = 0;
                    this.rank = 1;

                    cmd.time = now;
                    cmd.func = task.GetDystopiaMap;
                    cmd.param = {
                        mapid: DystopiaMapList[this.mapno],
                        rank: this.rank
                    };
                } else {
                    cmd.state = COMMON.CMD_STATUS.END;
                }
            }
        }
    };

    /* Command : 指定された魔界戦マップ・ランクで手動戦闘する */
    cmdManager.CmdDystopia = function (battleConfig, handler) {
        this.mapid = battleConfig.mapid;
        this.rank = battleConfig.rank;      // 0:Heaven, 1:Hell
        this.blockidList = null;
        this.battleCount = 0;
        this.time = battleConfig.time;

        this.round = 0;

        this.cmd = new Command("CmdDystopia", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdDystopia.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null) {
            cmd.reset();

            cmd.time = now;
            cmd.func = task.GetDystopiaMap;
            cmd.param = {
                mapid: this.mapid,
                rank: this.rank
            };

        } else if (cmd.func === task.GetDystopiaMap || cmd.func === task.Battle) {
            if (cmd.func === task.GetDystopiaMap) {
                this.blockidList = cmd.result.blockidList;
            }
            var blockid = (this.blockidList).shift();
            cmd.reset();

            if (blockid) {
                this.round++;
                var battleTime = this.time;
                // Hellは攻略に時間をかける
                if (this.rank === 1) {
                    battleTime = {
                        min: 180,
                        max: 300
                    };
                }
                cmd.time = now;
                cmd.func = task.Battle;
                cmd.param = {
                    blockid: blockid,
                    time: battleTime
                };
            } else {
                cmd.state = COMMON.CMD_STATUS.END;
            }
        }
    };

    /* Command : 戦闘用バフを付ける */
    cmdManager.CmdBattleBuff = function (handler) {
        this.techList = [
            { techtype: "62", nt: "1", endtime: null },    // 遺跡研究（資源UP）
            { techtype: "63", nt: "1", endtime: null },    // 探索装置研究（ドロップUP）
            { techtype: "1", nt: "2", endtime: null }      // 高重変換装置
        ];

        this.cmd = new Command("CmdBattleBuff", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdBattleBuff.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null) {
            cmd.reset();

            cmd.func = task.SetAllBattleBuff;
            cmd.param = this.techList;

        } else {
            //this.techList = cmd.result;
            cmd.reset();

            var t = Math.min.apply(null, this.techList.map(function (o) {
                return o.endtime;
            }));
            var nextTime;
            if (t === 0) {
                nextTime = new Date();
            } else {
                nextTime = new Date(t);
            }
            // 直近のバフ終了時刻から2分後に設定する
            nextTime.setMinutes(nextTime.getMinutes() + 2);

            cmd.time = nextTime;
            cmd.func = task.SetAllBattleBuff;
            cmd.param = this.techList;
        }
    };

    /* Command : 指定されたアイテムを所持していたら側近へプレゼントする */
    cmdManager.CmdGiftToMaid = function (giftConfig, handler) {
        this.giftConfig = giftConfig;
        //this.counterStr = "";

        this.cmd = new Command("CmdGiftToMaid", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdGiftToMaid.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null || cmd.func === task.GiftToMaid) {
            if (cmd.result) { this.giftConfig = cmd.result; }
            cmd.reset();

            if (this.giftConfig.time) { cmd.time = this.giftConfig.time; }
            cmd.func = task.GiftToMaid;
            cmd.param  = this.giftConfig;
        }
    };

    /* Command : 指定された☆以上のキャラを召喚する */
    cmdManager.CmdRecruit = function (recruitConfig, handler) {
        this.recruitConfig = recruitConfig;
        this.recruitCount = 0;

        this.cmd = new Command("CmdRecruit", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdRecruit.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === task.Recruit) {
            this.recruitConfig = cmd.result;
        }

        if (this.recruitConfig.count <= 0 || this.recruitConfig.maxnum <= 0) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }
        cmd.reset();

        cmd.time = now;
        cmd.func = task.Recruit;
        cmd.param = this.recruitConfig;
    };

    /* Command : ログインボーナスを獲得する */
    /* スクリプト開始時にトリガーされる */
    cmdManager.CmdLoginBonus = function (handler) {
        this.statusMsg = "";

        this.cmd = new Command("CmdLoginBonus", handler);

        // ログインボーナス獲得までの残り時間を取得する
        var $iframe = $('#main');
        var ifrmDoc = $iframe[0].contentWindow.document;
        var timeStr = $("#logintime", ifrmDoc).text();
        if (timeStr === "") {
            console.log("ログインボーナス完了済み");
            this.cmd.result = {
                isNext: false,
                time: null
            };
        } else {
            this.cmd.result = {
                isNext: true,
                time: timeStr
            };
        }
        this.cmd.funcState = COMMON.CMD_RESULT.OK;

        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdLoginBonus.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        var targetTime = now;   // 次回ログインボーナス獲得時刻 (本来の予定時刻+2分)
        cmd.time = null;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            this.statusMsg = "次のログインボーナス獲得予定時刻: " + "停止中";
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            // 10分後にリトライ
            targetTime.setMinutes(now.getMinutes() + 10);
        }

        if (cmd.funcState === COMMON.CMD_RESULT.OK && cmd.result.isNext === true) {
            var timeStr = cmd.result.time;
            var timeArray = timeStr.split(":");
            if (timeArray.length !== 3) {
                log("ログインボーナス時間取得に失敗");
                // 10分後にリトライ
                targetTime.setMinutes(now.getMinutes() + 10);
            } else {
                var h = parseInt(timeArray[0], 10);
                var m = parseInt(timeArray[1], 10);
                var s = parseInt(timeArray[2], 10);

                targetTime.setHours(now.getHours() + h);
                targetTime.setMinutes(now.getMinutes() + m + 2);    // 余裕を持って2分後に
                targetTime.setSeconds(now.getSeconds() + s);

                // ログインボーナス獲得時刻が3時を過ぎていたら、targetTimeを3時にする
                // # ログインボーナス獲得までの時間は最大2ｈなのでこの判定でいけるはず
                if (now.getHours() < 3 && targetTime.getHours() >= 3) {
                    targetTime.setHours(3, 2, 0);
                }
            }
        } else if (cmd.funcState === COMMON.CMD_RESULT.OK && cmd.result.isNext === false) {
            if (now.getHours() >= 3) {
                targetTime.setDate(now.getDate() + 1);
            }
            targetTime.setHours(3, 2, 0);
        }

        cmd.reset();
        cmd.time = targetTime;
        cmd.func = task.getLoginBonus;
        this.statusMsg = "次のログインボーナス獲得予定時刻: " + COMMON.DATESTR(targetTime);
    };

    cfgManager.Set = function (setting) {
        TRANS.ENABLE = setting.args.trans;
        if (setting.args.trans.ratio) {
            TRANS.RATIO = setting.args.trans.ratio;
        }
        if (setting.args.trans.threshold) {
            TRANS.THRESHOLD = setting.args.trans.threshold;
        }
    };

    /* Config : 蒼変換 */
    cfgManager.InitTrans = function () {
        task.GetTownTransducer();
    };

    cfgManager.Trans = function (isEnable, transConfig) {
        TRANS.ENABLE = isEnable;
        if (transConfig) {
            TRANS.RATIO = transConfig.ratio;
            TRANS.THRESHOLD = transConfig.threshold;
        }
    };

    /* Command : 拠点戦に参加する */
    cmdManager.CmdCamp = function (handler) {
        var now = new Date();
        var days = 6 - now.getDay();
        if (days < 0) {
            days += 7;      // 指定が土曜日(6)なので、本来この処理は不要
        }
        now.setDate(now.getDate() + days);

        var i;
        for (i = 0; i < 3; i++) {
            if (i === 0) {
                now.setHours(9, 1, 0);
            } else if (i === 1) {
                now.setHours(13, 1, 0);
            } else if (i === 2) {
                now.setHours(17, 1, 0);
            }

            var camp = {};
            camp.cmd = new Command("CmdCamp" + i, handler);
            camp.cmd.time = new Date(now);
            camp.cmd.func = task.JoinCamp;
            camp.setNextTask = this.setNextTask;
            cmdList.push(camp);
        }
    };

    cmdManager.CmdCamp.prototype.setNextTask = function () {
        return null;
    };

    /* Command : テスト用 */
    cmdManager.CmdTest = function (testData, handler) {
        this.cmd = new Command("CmdTest", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdTest.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === COMMON.CMD_RESULT.NG) {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null) {
            cmd.reset();

            cmd.func = task.GetAllBossBlockid;
            //cmd.param = { current : 98000, limit: 100000 };

            //var $iframe = $('#main');
            //var ifrmDoc = $iframe[0].contentWindow.document;
            //$("#merc_title", ifrmDoc).click();
        /*} else if (cmd.func === task.GetBattleBuff) {
            var techList = cmd.result;

            cmd.reset();
            cmd.func = task.SetBattleBuff;
            cmd.param = techList;*/

        } else {
            console.log(cmd.result);
            cmd.state = COMMON.CMD_STATUS.END;
        }
    };
}());
