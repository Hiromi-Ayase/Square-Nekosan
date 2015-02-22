/*jslint vars: true, plusplus: true*/
/*global $, console, log, chrome, COMMON, task, DystopiaMapList,
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
                if (!cmdList[i].cmd.endHandler) {
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
                        task.funcState = "OK";
                        task.result = result;
                    }, function (result) {
                        task.funcState = "NG";
                        task.result = result;
                    })
                    .always(function () {
                        cmdList[i].setNextTask();
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
    }

    Command.prototype.reset = function () {
        this.time = null;
        this.func = null;
        this.param = null;
        this.result = null;
        this.funcState = null;
    };

    /* Command : 指定されたマップの初めから順にすべてのマスで手動戦闘する */
    cmdManager.CmdMapBattle = function (mapid, handler) {
        this.mapid = mapid;
        this.blockidList = null;
        this.battleCount = 0;

        this.cmd = new Command("CmdMapBattle", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdMapBattle.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === "NG") {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null) {
            cmd.reset();

            cmd.time = now;
            cmd.func = task.GetBlockid;
            cmd.param = {
                mapid: this.mapid
            };

        } else if (cmd.func === task.GetBlockid || cmd.func === task.Battle) {
            if (cmd.func === task.GetBlockid) {
                this.blockidList = cmd.result.blockidList;
            }
            var blockid = (this.blockidList).shift();
            cmd.reset();

            if (blockid) {
                cmd.time = now;
                cmd.func = task.Battle;
                cmd.param = {
                    blockid: blockid
                };
            } else {
                cmd.state = COMMON.CMD_STATUS.END;
            }
        }
    };

    /* Command : 指定された1つ以上のマスで手動戦闘する */
    cmdManager.CmdBlockBattle = function (blockidList, handler) {
        this.blockidList = blockidList;
        this.battleCount = blockidList.length;
        this.counterStr = "";

        this.cmd = new Command("CmdBlockBattle", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdBlockBattle.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (this.funcState === "NG") {
            cmd.state = COMMON.CMD_STATUS.END;
            return;
        }

        if (cmd.func === null || cmd.func === task.Battle) {
            var blockid = (this.blockidList).shift();
            cmd.reset();

            if (blockid) {
                this.counterStr = (this.battleCount - (this.blockidList).length) + "回目/" + this.battleCount + "回中";
                cmd.time = now;
                cmd.func = task.Battle;
                cmd.param = {
                    blockid: blockid
                };
            } else {
                cmd.state = COMMON.CMD_STATUS.END;
            }
        }
    };

    /* Command : 入場可能な魔界戦マップすべてで手動戦闘する（攻略済みがあってもOK） */
    cmdManager.CmdAllDystopia = function (handler) {
        this.mapno = 0;     // DystopiaMapListのうち何番目のマップか
        this.rank = 0;      // 0:Heaven, 1:Hell
        this.blockidList = null;
        this.battleCount = 0;

        this.cmd = new Command("CmdAllDystopia", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdAllDystopia.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === "NG") {
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
                // Hellは攻略に時間をかける
                if (this.rank === 1) {
                    cmd.time = now.setMinutes(now.getMinutes() + 5);
                } else {
                    cmd.time = now;
                }
                cmd.func = task.Battle;
                cmd.param = {
                    blockid: blockid
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
    cmdManager.CmdDystopia = function (mapid, rank, handler) {
        this.mapid = mapid;
        this.rank = rank;      // 0:Heaven, 1:Hell
        this.blockidList = null;
        this.battleCount = 0;

        this.cmd = new Command("CmdDystopia", handler);
        this.setNextTask();
        cmdList.push(this);
    };

    cmdManager.CmdDystopia.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            return;
        } else if (cmd.funcState === "NG") {
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
                // Hellは攻略に時間をかける
                if (this.rank === 1) {
                    cmd.time = now.setMinutes(now.getMinutes() + COMMON.HELLWAIT);
                } else {
                    cmd.time = now;
                }
                cmd.func = task.Battle;
                cmd.param = {
                    blockid: blockid
                };
            } else {
                cmd.state = COMMON.CMD_STATUS.END;
            }
        }
    };

    /* Command : ログインボーナスを獲得する */
    /* スクリプト開始時にトリガーされる */
    cmdManager.CmdLoginBonus = function (handler) {
        this.statusMsg = "";

        this.cmd = new Command("CmdLoginBonus", handler);

        // ログインボーナス獲得までの残り時間を取得しタスクをセットする
        var now = new Date();
        var targetTime = now;   // 次回ログインボーナス獲得時刻 (本来の予定時刻+5分)

        var $iframe = $('#main');
        var ifrmDoc = $iframe[0].contentWindow.document;

        var timeStr = $("#logintime", ifrmDoc).text();
        if (timeStr === "00:00:00") {
            targetTime = now;

        // エラーで取得できなかった場合と判別できない気がする
        } else if (timeStr  === "") {
            console.log("ログインボーナス完了済み");
            // targetTimeを次の3時にセット
            if (now.getHours() >= 3) {
                targetTime.setDate(now.getDate() + 1);
            }
            targetTime.setHours(3);
            targetTime.setMinutes(5);
            targetTime.setSeconds(0);
        } else {
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
                targetTime.setMinutes(now.getMinutes() + m + 5);    // 余裕を持って5分後に
                targetTime.setSeconds(now.getSeconds() + s);

                // ログインボーナス獲得時刻が3時を過ぎていたら、targetTimeを3時にする
                // # ログインボーナス獲得までの時間は最大2ｈなのでこの判定でいけるはず
                if (now.getHours() < 3 && targetTime.getHours() >= 3) {
                    targetTime.setHours(3);
                    targetTime.setMinutes(5);
                    targetTime.setSeconds(0);
                }
            }
        }

        this.cmd.time = targetTime;
        this.cmd.func = task.getLoginBonus;
        this.statusMsg = "次のログインボーナス獲得予定時刻: " + COMMON.DATESTR(targetTime);

        cmdList.push(this);
    };

    cmdManager.CmdLoginBonus.prototype.setNextTask = function () {
        var now = new Date();
        var cmd = this.cmd;

        var targetTime = now;   // 次回ログインボーナス獲得時刻 (本来の予定時刻+5分)
        cmd.time = null;

        if (cmd.state === COMMON.CMD_STATUS.END) {
            this.statusMsg = "次のログインボーナス獲得予定時刻: " + "停止中";
            return;
        } else if (cmd.funcState === "NG") {

            if (cmd.result === undefined) {
                // 通信失敗or謎のエラー
                // 10分後にリトライ
                targetTime.setMinutes(now.getMinutes() + 10);
            } else if (cmd.result === -1) {
                // 日付をまたいだ
                // どうしよう・・・
                targetTime.setMinutes(now.getMinutes() + 10);
            } else if (cmd.result === -2) {
                // 獲得可能時間前
                // 10分後にリトライ
                targetTime.setMinutes(now.getMinutes() + 10);
            } else if (cmd.result === -3) {
                // ローグインボーナス終了
                // 次の3時
                if (now.getHours() >= 3) {
                    targetTime.setDate(now.getDate() + 1);
                }
                targetTime.setHours(3);
                targetTime.setMinutes(5);
                targetTime.setSeconds(0);
            } else {
                // 10分後にリトライ
                targetTime.setMinutes(now.getMinutes() + 10);
            }
        }

        if (cmd.funcState === "OK" && cmd.result.isNext === true) {
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
                targetTime.setMinutes(now.getMinutes() + m + 5);    // 余裕を持って5分後に
                targetTime.setSeconds(now.getSeconds() + s);

                // ログインボーナス獲得時刻が3時を過ぎていたら、targetTimeを3時にする
                // # ログインボーナス獲得までの時間は最大2ｈなのでこの判定でいけるはず
                if (now.getHours() < 3 && targetTime.getHours() >= 3) {
                    targetTime.setHours(3);
                    targetTime.setMinutes(5);
                    targetTime.setSeconds(0);
                }
            }
        } else if (cmd.funcState === "OK" && cmd.result.isNext === false) {
            if (now.getHours() >= 3) {
                targetTime.setDate(now.getDate() + 1);
            }
            targetTime.setHours(3);
            targetTime.setMinutes(5);
            targetTime.setSeconds(0);
        }

        cmd.reset();
        cmd.time = targetTime;
        cmd.func = task.getLoginBonus;
        this.statusMsg = "次のログインボーナス獲得予定時刻: " + COMMON.DATESTR(targetTime);
    };
}());
