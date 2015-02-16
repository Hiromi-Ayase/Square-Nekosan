/*jslint vars: true, plusplus: true*/
/*global $, console, chrome, COMMON, g_cmdList, g_mapid, GetBlockid, Battle, dystopiaAllBattle,
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

var cmdManager = {};
(function () {
    'use strict';

    function waitTime(time) {
        var defer = $.Deferred();
        setTimeout(function () {
            defer.resolve();
        }, time);
        return defer.promise();
    }

        /*
        this.func = GetBlockid;
        this.param = {mapid: this.mapid};
        this.result = null;
        this.funcState = null;
        */
    /* タスクの実行および終了コマンドの削除 */
    function executeTask() {
        var defer = $.Deferred();

        // 終了済みのコマンドをリストから削除する
        var i = 0;
        for (i = 0; i < g_cmdList.length; i++) {
            if (g_cmdList[i].state === "END") {
                g_cmdList.splice(i, 1);
                i--;
            }
        }

        // コマンドリストを時間で並び替え、先頭のコマンドのタスクを実行する
        // 終わったら次のタスクをセットする
        if (g_cmdList.length !== 0) {
            g_cmdList.sort(function (a, b) {
                return a.time - b.time;
            });
            var now = new Date();
            if (g_cmdList[0].time < now) {
                var task = g_cmdList[0].cmd;
                task.func(task.param)
                    .then(function (result) {
                        task.funcState = "OK";
                        task.result = result;
                    }, function () {
                        task.funcState = "NG";
                    })
                    .always(function () {
                        g_cmdList[0].setNextTask();
                        defer.resolve();
                    });
            }
        } else {
            defer.resolve();
        }

        return defer.promise();
    }

    /* 一定時間ごとに実行するタスクがあるかチェックする */
    cmdManager.pollTask = function () {
        var defer = $.Deferred();

        waitTime(5000)
            .then(executeTask)
            .then(cmdManager.pollTask);

        return defer.promise();
    };
/*
    function cmdManager() {
        var i = 0;
        for (i = 0; i < g_cmdList.length; i++) {
            if (g_cmdList[i].state === "END") {
                g_cmdList.splice(i, 1);
            } else if (g_cmdList[i].state === "RUN") {
                g_cmdList[i].setNextTask();
            }
        }
    }
*/
    /* 共通のコマンドオブジェクト */
    function Command(name) {
        return {
            name: name,
            state: "RUN",

            time: null,
            func: null,
            param: null,
            result: null,
            funcState: null
        };
        /*this.name = name;
        this.state = "RUN"; // RUN, PAUSE, ABORT, END

        this.time = null;
        this.func = null;
        this.param = null;
        this.result = null;
        this.funcState = null;*/
    }

    /* Command : 指定されたマップの初めから順にすべてのマスで手動戦闘する */
    function CmdMapBattle(mapid) {

        this.mapid = mapid;
        this.battleCount = 0;
        this.blockidList = null;

        this.cmd = new Command("CmdMapBattle");
        this.setNextTask();
    }

    CmdMapBattle.prototype.setNextTask = function () {
        var now = new Date();.0@pageXOffset

        if (cmd.state === "END") {
            return;

        } else if (cmd.func === null) {
            cmd.time = now;
            cmd.cmd.func = GetBlockid;
            cmd.param = {
                mapid: this.mapid
            };
            cmd.result = null;
            cmd.funcState = null;

        } else if ((cmd.func === GetBlockid || cmd.func === Battle) && cmd.funcState === "OK") {
            if (cmd.func === GetBlockid) {
                this.blockidList = cmd.result.blockidList;
            }
            var blockid = (this.blockidList).shift();

            if (blockid) {
                cmd.time = now;
                cmd.func = Battle;
                cmd.param = {
                    blockid: blockid
                };
                cmd.result = null;
                cmd.funcState = null;
            } else {
                cmd.state = "END";
            }

        } else if (cmd.funcState === "NG") {
            cmd.state = "END";
        }
    };

    /* Command : 指定された1つ以上のマスで手動戦闘する */
    function CmdBlockBatttle(mapid) {

        this.battleCount = 0;
        this.blockidList = [7100, 7100, 7099];

        this.cmd = "BlockBatttle";
        this.state = "RUN"; // RUN, PAUSE, ABORT, END

        this.time = null;
        this.func = null;
        this.param = null;
        this.result = null;
        this.funcState = null;

        this.setNextTask();
    }

    CmdBlockBatttle.prototype.setNextTask = function () {
        var now = new Date();

        if (this.state === "END") {
            return;

        } else if (this.func === null || (this.func === Battle && this.funcState === "OK")) {
            var blockid = (this.blockidList).shift();

            if (blockid) {
                this.time = now;
                this.func = Battle;
                this.param = {
                    blockid: blockid
                };
                this.result = null;
            } else {
                this.state = "END";
            }
            this.funcState = null;

        } else if (this.funcState === "NG") {
            this.state = "END";
        }
    };

    /* Command : 入場可能な魔界戦マップをすべて手動戦闘する（攻略済みがあってもOK） */
    function CmdDystopia(mapid) {

        this.battleCount = 0;
        this.blockidList = [7100, 7100, 7099];

        this.cmd = "Dystopia";
        this.state = "RUN"; // RUN, PAUSE, ABORT, END

        this.time = null;
        this.func = null;
        this.param = null;
        this.result = null;
        this.funcState = null;

        this.setNextTask();
    }

    CmdDystopia.prototype.setNextTask = function () {
        var now = new Date();
        var rank = 1; // 0 : Heaven, 1: Hell

        if (this.state === "END") {
            return;

        } else if (this.func === null || (this.func === Battle && this.funcState === "OK")) {
            var blockid = (this.blockidList).shift();

            if (blockid) {
                this.time = now;
                this.func = dystopiaAllBattle;
                this.param = {
                    rank: rank
                };
                this.result = null;
            } else {
                this.state = "END";
            }
            this.funcState = null;

        } else if (this.funcState === "NG") {
            this.state = "END";
        }
    };
}());
