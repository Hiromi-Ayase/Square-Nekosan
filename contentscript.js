/*jslint vars: true, plusplus: true*/
/*global $, chrome, console, log, COMMON, cmdManager*/

/*
    jQuery JavaScript Library v1.9.1 で動作確認
    v1.7はだめー
*/

/* --- キャラのレベルアップ --- */
var IS_AUTO_LVUP = 0; // 自動でLVUPするか
var g_isLvup = 0;
var g_lvupCharaId = 0;
var g_lvupCharaList = [];

/* --- サドンボス --- */
//var IS_CHECK_SUDDEN = 1; // 戦闘終了時にサドンボスをチェックするか
var IS_BEAT_SUDDEN = 1; // 自分が遭遇したサドンボスを30％以上削るか（キャラに余裕がある場合使用推奨）
var g_isBattleSudden = 0; // 戦闘終了後にサドンボスが出たか
var g_suddenList = [];  // {id : this.id, mine : 1}    mine=1なら自分が遭遇者

/* --- 蒼変換 --- */
var TRANS = {};
//TRANS.ENABLE = true;
//TRANS.RATIO = 0.1;
//TRANS.THRESHOLD = 0.7;
TRANS.TOWNID = null;

/* --- マップID --- */
var DystopiaMapList = [91001, 92001, 93001, 94001, 95001,
                       96001, 97001, 99001, 100001];

// Hard:+1, Master+2, God+3
var NormalMapList = [1001, 2001, 3001, 4001, 5001,
                     6001, 7001, 9001, 10001];

// ジュールズベルグ(GOD最奥:8100)
var valley = [8001];


var task = {};
(function () {
    'use strict';
    /* 指定マスの最大パーティ数を取得する */
    // param = { blockid }
    var battleGetMaxParty = function (battleData) {
        console.log("[Enter]battleGetMaxParty");
        var defer = $.Deferred();

        $.ajax({
            url: "remain_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "get_monster_data",
                level: battleData.blockid,
                mload: 1
            }),
            success: function (res) {
                if (!res.max_party_num) {
                    log("最大攻略可能パーティ数取得に失敗");
                    defer.reject();
                } else {
                    battleData.maxPartyNum = parseInt(res.max_party_num, 10);

                    log("---- " + res.stagename + "[" + battleData.blockid + "]");

                    console.log("最大攻略可能パーティ数 ：" + battleData.maxPartyNum);
                    defer.resolve(battleData); // goto battleGetParty
                }
            },
            error: function () {
                log("最大攻略可能パーティ数取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };


    /* 現在のパーティ情報(キャラid)を取得する */
    var battleGetParty = function (battleData) {
        console.log("[Enter]battleGetParty");
        var defer = $.Deferred();

        $.ajax({
            url: "mercenary_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "load"
            }),
            //data:({
            //    op: "party_merc_loaddata",
            //    save: saveNo      // 1-5
            //}),
            success: function (res) {
                var party = [];
                var i = 0, j = 0;
                for (i = 0; i < 9; i++) {
                    party[i] = [];
                }

                console.log("パーティ情報：");
                for (i = 0; i < res.merc.length; i++) {
                    var chara = res.merc[i];
                    // パーティに所属していなければ party = 0
                    if (chara.state > 0 && chara.party !== "0") {
                        var partyNo = (chara.party.split("-")[0]) - 1;
                        var partyMemberNo = (chara.party.split("-")[1]) - 1;

                        party[partyNo][partyMemberNo] = chara.id;
                        console.log("    " + chara.name + " [" + chara.party + "]");
                        j++;
                    }
                }

                if (j === 0) {
                    log("パーティ無し");
                    defer.reject();
                } else {
                    battleData.partyData = [];
                    for (i = 0; i < 9; i++) {
                        if (party[i].length > 0) {
                            battleData.partyData.push(party[i]);
                            j++;
                            if (battleData.partyData.length >= battleData.maxPartyNum) {
                                break;
                            }
                        }
                    }
                    defer.resolve(battleData); // goto battlePrepare
                }
            },
            error: function () {
                log("パーティ情報取得に失敗");
                defer.reject();
            }
                //log(response.merc[0].lv);
                //party : "1-1", 1-2, 1-3(所属してなければ0)アレット1-2 リーゼ6-3
                // suddencd: "2015-01-11 17:11:28"(サドンが殴れるようになる時間JST)

            // state "5"駐留?
            // loadでは response でresult:"success"
        });

        return defer.promise();
    };

    /* 戦闘準備 */
    var battlePrepare = function (battleData) {
        console.log("[Enter]battlePrepare");
        var defer = $.Deferred();

        $.ajax({
            url: "flash_trans_xml_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "battle_prepare",
                party: battleData.partyData,
                target_level: battleData.blockid,
                old_kick: 0,
                auto_battle: 0,
                assist_set: 0,
                hire_set: 0,
                hire_id: 0
            }),
            success: function (res) {
                if (res) {
                    var nResult = res.result;
                    if (parseInt(res.bPass, 10) === 1) {
                        if (nResult === "auto_fail") {
                            log("自動戦闘に失敗");
                            defer.reject(["power"]); // goto updateCQ

                        } else if (nResult === "auto_success" || nResult === "auto_success_lv") {
                            log("自動戦闘に成功");
                            defer.resolve(); // TODO?:自動戦闘使わないよね！

                        } else if (nResult === "success") {
                            console.log("手動戦闘準備に成功");
                            defer.resolve(battleData); // goto battleStart
                        }
                    } else {
                        log("戦闘準備エラー[" + res.result + "]");
                        defer.reject(["power"]); // goto updateCQ
                    }
                } else {
                    log("戦闘準備エラー");
                    defer.reject(["power"]); // goto updateCQ
                }
            },
            error: function () {
                log("戦闘準備情報の送信に失敗");
                defer.reject(["power"]); // goto updateCQ
            }
        });

        return defer.promise();
    };

    /* 戦闘データ生成 */
    var createBattleResult = function (data) {
        console.log("[Enter]createBattleResult");
        var pteam_txt = "";
        var eteam_txt = "";
        var json_data = null;

        try {
            json_data = $.parseJSON(data.replace("op=BATTLE&array=", ""));
        } catch (e) {}
        if (json_data === null) {
            log("戦闘準備データパース失敗");
            return;
        }

        /* 敵情報解析 */
        var enemy_list = [];

        $.each(json_data[2], function (i, e_party) {
            $.each(e_party, function (j, e_party_mem) {
                enemy_list.push(e_party_mem.id);
                if (j === 2) { eteam_txt += e_party_mem.id + "-0-0-0"; }
                if (j === 0 && i !== 0) { eteam_txt += "#"; }
            });
        });

        console.log("eteam_txt = " + eteam_txt);

        /* プレイヤ情報解析 */
        var player_list = [];
        var player_count = 0;

        // 特性のHP小隊ボーナスの合計値を取得
        var hp_bonus = [];
        $.each(json_data[1], function (i, p_party) {
            hp_bonus[i] = 0;
            $.each(p_party, function (j, p_party_mem) {
                if (p_party_mem.behavior.range === "0" && p_party_mem.behavior.hp) {
                    hp_bonus[i] += parseInt(p_party_mem.behavior.hp, 10);
                }
            });
        });

        // "キャラID-戦闘終了時HP-"を生成
        $.each(json_data[1], function (i, p_party) {
            player_list[i] = [];
            $.each(p_party, function (j, p_party_mem) {
                var p = "";
                var hp = p_party_mem.hp - (-hp_bonus[i]);
                p += p_party_mem.id + "-" + hp + "-";
                player_list[i].push(p);
                player_count++;
            });
        });

        var beat_enemy_num = 0;
        var beat_count;
        var num = enemy_list.length % player_count;
        var player_num = 0;

        var i, j, k;
        for (i = 0; i < player_list.length; i++) {
            if (i !== 0) { pteam_txt += "#"; }

            for (j = 0; j < player_list[i].length; j++) {
                if (j !== 0) { pteam_txt += "/"; }

                var eid_list = "";
                var eid_count_list = "";

                beat_count = (enemy_list.length - num) / player_count;
                if (player_num < num) { beat_count++; }

                if (enemy_list.length > beat_enemy_num && beat_count > 0) {
                    var tmp_array = [];
                    for (k = beat_enemy_num; k < beat_enemy_num + beat_count; k++) {
                        if (tmp_array.hasOwnProperty(enemy_list[k])) {
                            tmp_array[enemy_list[k]]++;
                        } else {
                            tmp_array[enemy_list[k]] = 1;
                        }
                    }

                    var eid;
                    for (eid in tmp_array) {
                        if (tmp_array.hasOwnProperty(eid)) {
                            eid_list += eid + ",";
                            eid_count_list += tmp_array[eid] + ",";
                        }
                    }
                    beat_enemy_num += beat_count;
                } else {
                    eid_list = "0,";
                    eid_count_list = "0,";
                }

                pteam_txt += player_list[i][j] + eid_list.slice(0, -1) + "-" + eid_count_list.slice(0, -1);
                player_num++;
            }
        }

        console.log("pteam_txt = " + pteam_txt);
        return {
            pteam_txt: pteam_txt,
            eteam_txt: eteam_txt
        };
    };

    /* 手動戦闘開始 */
    var battleStart = function (battleData) {
        console.log("[Enter]battleStart");
        var defer = $.Deferred();

        $.ajax({
            url: "flash_trans_xml_.php",
            type: "POST",
            cache: false,
            //dataType: "json",
            data: ({
                id: "#remain" + battleData.blockid,
                op: "BATTLE"
            }),
            success: function (res) {
                battleData.result_txt = createBattleResult(res);
                if (battleData.result_txt.pteam_txt === "" || battleData.result_txt.eteam_txt === "") {
                    log("手動戦闘開始に失敗[戦闘結果データ生成に失敗]");
                    defer.reject(["power"]); // goto updateCQ
                } else {
                    defer.resolve(battleData); // goto battleSendResult
                }
            },
            error: function () {
                log("手動戦闘開始に失敗");
                defer.reject(["power"]); // goto updateCQ
            }
        });

        return defer.promise();
    };

    /* 戦闘結果送信 */
    // result_txt = {pteam_txt, eteam_txt}
    var battleSendResult = function (battleData) {
        console.log("[Enter]battleSendResult");
        var defer = $.Deferred();

        if (battleData.result_txt.pteam_txt === "" || battleData.result_txt.eteam_txt === "") {
            return;
        }

        // ターン数、戦闘時間
        var turn = 1 + Math.floor(Math.random() * 7);
        var time = 0;   // 実際の戦闘時間(秒) (戦闘結果送るまでの待機時間)
        var sec = 0;    // 送信時間(秒)
        var min = 0;    // 送信時間(分)
        if (battleData.time.min !== null && battleData.time.max !== null && battleData.time.max > battleData.time.min) {
            if (battleData.time.max > 1800) {
                battleData.time.max = 1800;  // 最大30分とする
            }
            if (battleData.time.min < 1) {
                battleData.time.min = 1;
            }
            time = battleData.time.min + Math.floor(Math.random() * (battleData.time.max - battleData.time.min));
            sec = time % 60;
            if (time >= 60) {
                min = Math.floor((time - sec) / 60);
            }
            log(min + ":" + (sec < 10 ? "0" + sec : sec) + "後に戦闘結果を送信");
        } else {
            sec = 1 + Math.floor(Math.random() * 58);
        }
        if (sec < 10) {
            sec = "0" + sec;
        }
        if (min < 10) {
            min = "0" + min;
        }

        setTimeout(function () {
            // 開放されてないマップIDを指定するとエラー(array=[{"result":"no_remain"}])
            $.ajax({
                url: "flash_trans_xml_.php",
                type: "POST",
                cache: false,
                //dataType: "json",
                data: ({
                    op: "BATTLE_RESULT",
                    eteam: battleData.result_txt.eteam_txt,
                    remain: battleData.blockid + "/" + turn + "/00:" + min + ":" + sec,
                    pteam: battleData.result_txt.pteam_txt
                }),
                success: function (data) {
                    console.log("手動戦闘結果送信に成功");
                    defer.resolve(); // goto battleGetReport
                },
                error: function (data) {
                    log("手動戦闘結果送信に失敗");
                    defer.reject(); // goto updateCQ
                }
            });
        }, time * 1000);

        return defer.promise();
    };

    /* 戦闘獲得資源・アイテム取得 */
    var battleGetReport = function () {
        console.log("[Enter]battleGetReport");
        var defer = $.Deferred();

        $.ajax({
            url: "report_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "latest_battle_report"
            }),
            success: function (data) {
                if (data.warning === 1) {
                    // サドン
                    //warning_boss(parseInt(data.eid,10),data.name);
                    log("サドンボスが出ました！");
                    g_isBattleSudden = 1;
                } else if (data !== -1) {
                    // 勝敗
                    // data.winner:"16394"(自分) or "0"(敵(通常マップ・ゼクスタワーは確認済み))
                    if (data.winner !== undefined) {
                        if (data.winner === "0") {
                            log("戦闘負け");
                        }
                    }

                    // 獲得アイテム
                    if (data.item !== undefined && data.item) {
                        log(data.item);
                    } else {
                        log("獲得アイテムなし");
                    }

                    // 獲得資源
                    // data.res[?(蒼か成就値あたり), 魔晶石, ダイム, 名声, ?(蒼か成就値あたり)]
                    if (data.res !== undefined && data.res.length > 3) {
                        log("魔晶石:" + data.res[1] +
                            ", ダイム:" + data.res[2] +
                            ", 名声:" + data.res[3]);
                    } else {
                        log("獲得資源なし");
                    }

                    // LVUPしたキャラの有無
                    g_isLvup = 0;
                    if (data.mercLevel !== undefined && data.mercLevel === 1) {
                        g_isLvup = 1;
                    }
                }
                defer.resolve(["res", "char"]); // goto updateCQ
            },
            error: function () {
                log("戦闘結果取得に失敗");
                defer.reject(["res", "char"]); // goto updateCQ
            }
        });

        return defer.promise();
    };

    /* techInfo = {
        techtype,   // constant
        nt,         // constant
        endtime,
        techid,
        town (=tid),
        bindex,
        bid
    } */
    var setBattleBuff = function (tech) {
        console.log("[Enter]setBattleBuff");
        var defer = $.Deferred().resolve(tech);

        // 発動中バフのリストを取得
        defer = defer.then(function (tech) {
            var d = $.Deferred();
            $.ajax({
                url: "remain_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({ op: "battle_tech" }),
                success: function (res) {
                    if (res.tech.length > 0) {
                        var name = null;
                        $.each(res.tech, function () {
                            if (this !== 0 && this.type === tech.techtype) {
                                tech.endtime = Date.parse(this.endtime);
                                name = this.name;
                                return false;
                            }
                        });
                        if (name) {
                            console.log(name + "(techtype=" + tech.techtype + ")は発動中");
                            d.resolve();
                        } else {
                            d.resolve(tech);
                        }
                    } else {
                        log("発動中のバフ情報取得に失敗");
                        d.reject();
                    }
                },
                error: function () {
                    log("戦闘前準備情報取得に失敗");
                    d.reject();
                }
            });
            return d.promise();

        // バフの一覧から指定されたバフの情報を取得
        }).then(function (tech) {
            var d = $.Deferred();
            if (!tech) {
                return d.resolve().promise();
            }
            $.ajax({
                url: "remain_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({ op: "battle_tech_list", nt: tech.nt }),
                success: function (res) {
                    if (res.list.length > 0) {
                        $.each(res.list, function () {
                            if (this.techtype === tech.techtype) {
                                if (this.endtime) {
                                    tech.endtime = Date.parse(this.endtime);
                                    tech.bindex = this.index;
                                    tech.bid = null;
                                } else {
                                    tech.endtime = null;
                                    tech.bindex = this.bindex;
                                    tech.bid = this.bid;
                                }
                                tech.techid = this.techid;
                                tech.town = this.town;

                                console.log(this.name + " の情報取得に成功");
                                return false;
                            }
                        });
                        if (tech.endtime) {
                            console.log("バフ(techtype=" + tech.techtype + ")は発動中");
                            d.resolve();
                        } else {
                            d.resolve(tech);
                        }
                    } else {
                        log("戦闘バフリスト(techtype=" + tech.techtype + ")取得に失敗");
                        d.reject();
                    }
                },
                error: function () {
                    log("戦闘前準備情報取得に失敗");
                    d.reject();
                }
            });
            return d.promise();

        // バフを発動
        }).then(function (tech) {
            var d = $.Deferred();
            if (!tech) {
                return d.resolve().promise();
            }
            $.ajax({
                url: "remain_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "set_battle_tech",
                    bindex: tech.bindex,
                    bid: tech.bid,
                    teid: tech.techid,
                    tid: tech.town,
                    nt: tech.nt
                }),
                success: function (res) {
                    if (res.result === 1 && res.list.length > 0) {
                        $.each(res.list, function () {
                            if (this.techtype === tech.techtype) {
                                if (this.endtime) {
                                    tech.endtime = Date.parse(this.endtime);
                                    tech.bindex = this.index;
                                    tech.bid = null;
                                } else {
                                    tech.endtime = null;
                                    tech.bindex = this.bindex;
                                    tech.bid = this.bid;
                                }
                                tech.techid = this.techid;
                                tech.town = this.town;

                                log(this.name + " を発動");
                                return false;
                            }
                        });
                        if (tech.endtime) {
                            d.resolve(tech);
                        } else {
                            log("バフ(techtype=" + tech.techtype + ")発動に失敗");
                            d.reject();
                        }
                        /*setTimeout(function () {
                            d.resolve();
                        }, 1000);*/
                    } else {
                        log("バフ(techtype=" + tech.techtype + ")発動に失敗");
                        d.reject();
                    }
                },
                error: function () {
                    log("バフ(techtype=" + tech.techtype + ")発動送信に失敗");
                    d.reject();
                }
            });
            return d.promise();

        });

        return defer.promise();
    };

    /*** 都市バフ付け ***/
    // 指定されたバフが発動していなければ発動させる
    task.SetAllBattleBuff = function (techList) {
        console.log("[[TaskStart]]SetAllBattleBuff");
        var defer = $.Deferred().resolve();

        if (!cmdManager.IsBattleCmd()) {
            return $.Deferred().reject().promise();
        }

        $.each(techList, function (i, tech) {
            defer = defer.then(function () {
                return setBattleBuff(tech);
            });
        });

        defer = defer.then(function () {
            return $.Deferred().resolve(techList).promise();
        });
        return defer.promise();
    };

    // 戦闘前準備機能で蒼変換
    task.TransBattlePrepare = function (stone) {
        console.log("[Enter]transBattlePrepare");
        var defer = $.Deferred().resolve();

        if (!COMMON.TRANS.ENABLE || stone.current < stone.limit * COMMON.TRANS.THRESHOLD) {
            return defer.promise();
        }
        var trans_stone = parseInt(stone.limit * COMMON.TRANS.RATIO, 10);

        defer = defer.then(function () {
            var d = $.Deferred();
            $.ajax({
                url: "remain_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({ op: "battle_tech" }),
                success: function (res) {
                    var tid = res.trans.power.tid;
                    if (tid) {
                        d.resolve(tid);
                    } else {
                        log("蒼水晶変換用パラメータ(tid)取得に失敗");
                        d.reject();
                    }
                },
                error: function () {
                    log("戦闘前準備情報取得に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function (tid) {
            var d = $.Deferred();
            $.ajax({
                url: "remain_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "res_trans",
                    tid: tid,
                    ttype: 1,
                    tval: trans_stone
                }),
                success: function (res) {
                    if (res.result === 1) {
                        log(res.alert);
                        d.resolve();
                    } else {
                        log("蒼水晶変換失敗");
                        d.reject();
                    }
                },
                error: function () {
                    log("蒼水晶変換情報取得に失敗");
                    d.reject();
                }
            });
            return d.promise();
        });

        return defer.promise();
    };

    /**
     * 都市での蒼水晶変換（戦闘前準備機能の使用に切り替えるため削除予定）
     * @param   {Number} current_stone [[Description]]
     * @param   {Number} limit_stone   [[Description]]
     * @returns {[[Type]]} [[Description]]
     */
    task.TransduceStone = function (current_stone, limit_stone) {
        console.log("[[TaskStart]]TransduceStone");
        var defer = $.Deferred().resolve();

        if (COMMON.TRANS.ENABLE && current_stone > limit_stone * COMMON.TRANS.THRESHOLD) {
            defer = defer.then(function () {
                var defer2 = $.Deferred();
                $.ajax({
                    url: "town.php?town=" + TRANS.TOWNID,
                    type: "GET",
                    //cache: false,
                    //dataType: "json",
                    success: function (res) {
                        defer2.resolve(current_stone, limit_stone);
                    },
                    error: function () {
                        log("都市データの取得(town.php)に失敗");
                        defer2.reject();
                    }
                });
                return defer2.promise();

            }).then(function () {
                var defer2 = $.Deferred();
                var trans_stone = parseInt(limit_stone * COMMON.TRANS.RATIO, 10);
                $.ajax({
                    url: "flash_trans_xml_.php?town=" + TRANS.TOWNID,
                    type: "POST",
                    cache: false,
                    //dataType: "json",
                    data: ({ op: "TRANS", source: trans_stone, type: "5" }),
                    success: function (res) {
                        var json_data;
                        try {
                            json_data = $.parseJSON(res.replace("op=TRANS&array=", ""));
                        } catch (e) {}
                        if (json_data[0].result === null || json_data[0].result !== 1) {
                            log("魔晶石変換失敗");
                            defer2.reject();
                        } else {
                            log(json_data[0].alert);
                            defer2.resolve();
                        }
                    },
                    error: function () {
                        log("魔晶石変換失敗");
                        defer2.reject();
                    }
                });
                return defer2.promise();
            });
        }
        return defer.promise();
    };

    /* 表示情報取得更新(func.js updateCQ()) */
    var updateCQ = function (val) {
        console.log("[Enter]updateCQ");
        var defer = $.Deferred().resolve();

        if (!val) {
            val = ["res", "char"];
        }

        defer = defer.then(function () {
            var defer2 = $.Deferred();
            $.ajax({
                url: "updateinfo_.php",
                dataType: "json",
                type: "POST",
                cache: false,
                data: ({
                    op: "update",
                    args: val
                }),
                success: function (data) {
                    var $iframe = $('#main');
                    var ifrmDoc = $iframe[0].contentWindow.document;

                    var res = data ? data.res : 0;
                    var prod = data ? data.prod : 0; // 魔晶石産出量?
                    var info = data ? data.info : 0; // 管理官情報
                    var point = data ? data.point : 0; // スターズ
                    var gold = data ? data.gold : 0; // ダイム
                    var power = data ? data.power : 0; // 蒼水晶
                    var ecoin = data ? data.ecoin : 0; // バルスタ
                    var bpoint = data ? data.bpoint : 0; // VIPポイント

                    /* 資源量の表示更新 */
                    if (res) {
                        var stone_res = res.stone;
                        var gold_res = res.gold;
                        var power_res = res.power;
                        var res_limit = res.limit;
                        var stone_mall = Math.floor(prod.stone * prod.mstone / 100);
                        var stone_prod = parseInt(prod.stone, 10) + parseInt(stone_mall, 10);

                        $("#stone", ifrmDoc).attr("prod", parseInt(prod.stone, 10) + parseInt(stone_mall, 10));
                        $("#stone", ifrmDoc).attr("limit", parseInt(res.limit, 10));
                        $("#stone", ifrmDoc).html(res.stone);
                        $("#gold", ifrmDoc).html(res.gold);
                        $("#power", ifrmDoc).html(res.power);

                        if (stone_res >= res_limit) {
                            $("#stone", ifrmDoc).css("color", "red");
                        } else if (Math.ceil(stone_res / res_limit * 100) >= 90) {
                            $("#stone", ifrmDoc).css("color", "orange");
                        } else if (Math.ceil(stone_res / res_limit * 100) < 90) {
                            $("#stone", ifrmDoc).css("color", "#ffd495");
                        }
                        $("#stone", ifrmDoc).html(res.stone);
                        //%s：産出量　%s/時間（基本%s+%s増加) 上限：%s
                        //魔晶石
                        var title_str = "魔晶石" + "：産出量　" + stone_prod +
                            "/時間（基本" + parseInt(stone_prod - stone_mall, 10) + "+" + stone_mall + "増加) 上限：" + res.limit;
                        $("#stone_view").attr("title", title_str);
                    }
                    /* 管理官情報の表示更新 */
                    if (info) {
                        $("#lv", ifrmDoc).html(info.lv); // 管理官Lv
                        $("#exp_view", ifrmDoc).attr("title", info.exp + "%"); // 管理官経験値
                        $("#presige", ifrmDoc).html(info.presige); // 成就値
                        $("#honor", ifrmDoc).html(info.honor); // 名声
                        //setPageInfo();        // 設定遊戲頁面資訊(リザルト画面のことかなぁ...?)
                    }
                    if (point) { $("#point", ifrmDoc).html(point.points); }
                    if (gold) { $("#gold", ifrmDoc).html(gold); }
                    if (power) { $("#power", ifrmDoc).html(power); }
                    if (ecoin) { $("#ecoin", ifrmDoc).html(ecoin); }
                    if (bpoint) { $("#bonus_num>span", ifrmDoc).html(bpoint); }

                    defer2.resolve({current : res.stone, limit: res.limit });
                },
                error: defer2.reject
            });
            return defer2.promise();

        }).then(task.TransBattlePrepare);

        return defer.promise();
    };

    /* マップのリロード？ */
    /*
    Battle.prototype.remainReload = function(){
        log("Enter Battle.reloadRemain");
        var defer = $.Deferred();

        $.ajax({
            url: "remain_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data:({
                op: "remain_reload"
            }),
            success: function(data){
                defer.resolve(["res","char"]);      // updateCQ
            },
            error: function() {
                log("remain_reloadに失敗");
                defer.reject(["res","char"]);    // updateCQ
            }
        });
        return defer.promise();
    };
    */

    /* 出現しているサドンボスの中から攻撃対象のものを取得 */
    /* 攻撃対象：HPが70％以下かつ0以上、または自分が遭遇者 */
    var getSuddenList = function () {
        console.log("[Enter]getSuddenList");
        var defer = $.Deferred();

        if (!(g_isBattleSudden && COMMON.SUDDEN.ENABLE)) {
            defer.resolve();
            return;
        }

        // 自分のプレイヤ名を取得
        var $iframe = $('#main');
        var ifrmDoc = $iframe[0].contentWindow.document;
        var myname = $("#name", ifrmDoc).text();
        if (!myname) {
            log("自分の名前の取得に失敗");
            defer.reject();
            return;
        }

        g_suddenList = [];

        $.ajax({
            url: "guild_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "guild_sudden_list"
            }),
            success: function (res) {
                var clearCount = 0;
                $.each(res.sudden_data, function () {
                    if (this.clear === 1) {
                        console.log(this.name + "(id=" + this.id + ") : 撃破済みです");
                        clearCount++;
                    } else if (this.hp <= 0) {
                        console.log(this.name + "(id=" + this.id + ") : HPが0です");
                    } else if (this.max_hp <= COMMON.SUDDEN.MINHP) {
                        console.log(this.name + "(id=" + this.id + ") : 最大HPが" + COMMON.SUDDEN.MINHP + "以下なので攻撃対象ではありません");
                    } else if (this.discoverer === myname) {
                        g_suddenList.push({id : this.id, mine : 1});
                        console.log(this.name + "(id=" + this.id + ") : 遭遇者が自分なので攻撃対象です");
                    } else if (this.hp / this.max_hp < 0.70) {
                        g_suddenList.push({id : this.id, mine : 0});
                        console.log(this.name + "(id=" + this.id + ") : HPが70%以下なので攻撃対象です");
                    } else {
                        console.log(this.name + "(id=" + this.id + ") : 攻撃対象ではありません");
                    }
                });

                if (clearCount > 0) {
                    $.ajax({
                        url: "guild_.php",
                        type: "POST",
                        cache: false,
                        dataType: "json",
                        data: ({
                            op: "sudden_all_reward"
                        }),
                        success: function (res) {
                            if (res.result === 1) {
                                log("サドン報酬：");
                                if (res.reward.discover) {
                                    log("  [遭遇報酬]");
                                    $.each(res.reward.discover, function () {
                                        log("    " + this);
                                    });
                                }
                                if (res.reward.item1) {
                                    log("  [参加報酬]");      // (<10%)
                                    $.each(res.reward.item1, function () {
                                        log("    " + this);
                                    });
                                }
                                if (res.reward.item2) {
                                    log("  [援護報酬]");      // (<30%)
                                    $.each(res.reward.item2, function () {
                                        log("    " + this);
                                    });
                                }
                                if (res.reward.item3) {
                                    log("  [優戦報酬]");      // (>30%)
                                    $.each(res.reward.item3, function () {
                                        log("    " + this);
                                    });
                                }
                            }
                            defer.resolve();
                        },
                        error: defer.reject
                    });
                } else {
                    defer.resolve();   // goto suddenAllAttack
                }
            },
            error: function () {
                log("サドンボス情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /* サドンボスの叩かれ具合を取得（(30%以上削られているか)、すでに自分がなぐっていないか） */
    var isAttackedSudden = function (suddenData) {
        console.log("[Enter]isAttackedSudden");
        var defer = $.Deferred();

        // 自分のプレイヤ名を取得
        var $iframe = $('#main');
        var ifrmDoc = $iframe[0].contentWindow.document;
        var myname = $("#name", ifrmDoc).text();
        if (!myname) {
            log("自分の名前の取得に失敗");
            defer.reject();
            return;
        }

        console.log("---- sudden id = " + suddenData.id);

        $.ajax({
            url: "guild_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "sudden_dalist",
                id: suddenData.id
            }),
            success: function (res) {
                $.each(res.list, function () {
                    if (this.name === myname) {
                        if (suddenData.mine === 1 && this.rate < 30.0) {
                            console.log("自分のサドン(ダメージ" +  this.rate + "%)");
                            suddenData.mydamage = parseInt(this.damage, 10);
                        } else {
                            console.log("攻撃済み");
                            defer.resolve(); // 自分がすでに叩いていた
                        }
                        return false;
                    }
                });
                if (defer.state() !== "resolved") {
                    defer.resolve(suddenData);
                }
            },
            error: function () {
                log("サドンボス攻撃済みプレイヤ取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    var getAvailableCharaSudden = function (suddenData) {
        console.log("[Enter]getAvailableCharaSudden");
        var defer = $.Deferred();

        if (!suddenData) {
            defer.resolve();
            return;
        }

        $.ajax({
            url: "remain_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "get_sudden_data",
                id: suddenData.id
            }),
            success: function (res) {
                if (res.result === 1) {
                    // 殴れるキャラのリストが返される（はず）
                    $.each(res.merc, function () {
                        var lv = parseInt(this.lv, 10);
                        // 自分のサドンはLV1以外のキャラで、他人のサドンはLV1のキャラで殴る
                        if ((lv === 1 && suddenData.mine === 0) || (lv > 1 && suddenData.mine === 1)) {
                            console.log(this.name + " ☆" + this.rarity + " (id=" + this.id + ")で殴ります");
                            defer.resolve(suddenData, this.id);
                            return false;
                        }
                    });
                    if (defer.state() !== "resolved") {
                        log("殴れるキャラがいません");
                        defer.resolve();
                    }
                } else if (res.result === -3) {
                    log("撃破済みサドンボスリストがいっぱいで殴れません");
                    defer.resolve();
                } else {
                    log("殴ろうとしたら倒されていました（たぶん）(result=" + res.result + ")");
                    defer.resolve();
                }
            },
            error: function () {
                log("サドンボス情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    var attackSudden = function (suddenData, charaid) {
        console.log("[Enter]attackSudden");
        var defer = $.Deferred();

        var attackSuddenInner = function (suddenData, charaid) {
            if (!suddenData || !charaid) {
                defer.resolve();
                return;
            }

            var charaList = [];
            charaList.push(parseInt(charaid, 10));
            charaList.push(0);
            charaList.push(0);

            $.ajax({
                url: "remain_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "sudden_challenge",
                    target: suddenData.id,
                    cid: charaList
                }),
                success: function (res) {
                    console.log("サドンボス攻撃に成功"); // 失敗時の応答不明（無効なidでも送ってみる？）
                    // 遭遇者が自分の場合、30％以上殴る(殴るキャラは1人ずつ)
                    if (suddenData.mine === 1 && IS_BEAT_SUDDEN === 1 && res.battle.left_hp > 0) {
                        // キャラが1人の場合、res.battle.merc[1 or 2].total=undefined で、これを加算するとNaNになるので注意
                        suddenData.mydamage += res.battle.merc[0].total;
                        if (suddenData.mydamage / res.battle.max <= 0.30) {
                            console.log("ダメージが30%以下なのでまた殴ります");
                            charaid = null;
                            $.each(res.merc_list, function () {
                                if (parseInt(this.lv, 10) > 1) {
                                    console.log(this.name + " ☆" + this.rarity + " (id=" + this.id + ")で殴ります");
                                    charaid = this.id;
                                    return false;
                                }
                            });
                            attackSuddenInner(suddenData, charaid);
                            return;
                        }
                    }
                    defer.resolve();
                },
                error: function () {
                    log("サドンボス攻撃に失敗");
                    defer.reject();
                }
            });
        };

        attackSuddenInner(suddenData, charaid);

        return defer.promise();
    };

    /* suddenData (g_suddenList) : {id, mine(0/1), mydamage}*/
    var suddenProcess = function (suddenData) {
        console.log("[Enter]suddenProcess");
        var defer = $.Deferred();

        isAttackedSudden(suddenData)
            .then(getAvailableCharaSudden)
            .then(attackSudden)
            .then(function () {
                console.log("suddenProcess成功");
                defer.resolve();
            }, function () {
                log("suddenProcess失敗");
                defer.reject();
            });

        return defer.promise();
    };

    var suddenAllAttack = function () {
        console.log("[Enter]suddenAllAttack");
        var defer = $.Deferred();

        if (!(g_isBattleSudden && COMMON.SUDDEN.ENABLE)) {
            defer.resolve();
            return;
        }

        var list = g_suddenList;
        var suddenData = list.shift();
        if (!suddenData) {
            console.log("出現中のサドンボスがこれ以上いません");
            defer.reject();
            return;
        }

        suddenProcess(suddenData)
            .then(suddenAllAttack)
            .then(defer.resolve, function () {
                log("Failed suddenAllAttack");
                defer.reject();
            });

        return defer.promise();
    };

    /* パーティーに加入しているキャラのうち、レベルアップフラグが立っているキャラのリストを取得 */
    var getLvupCharaInParty = function () {
        console.log("[Enter]getLvupCharaInParty");
        var defer = $.Deferred();

        if (!(g_isLvup && IS_AUTO_LVUP)) {
            defer.resolve();
            return;
        }

        $.ajax({
            url: "mercenary_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "load"
            }),
            success: function (res) {
                g_lvupCharaList = [];
                $.each(res.merc, function () {
                    if (this.lv_up === 1 && this.party !== "0") {
                        g_lvupCharaList.push(parseInt(this.id, 10));
                    }
                });
                defer.resolve();
            },
            error: function () {
                log("レベルアップキャラリストの取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };
    
    /* レベルアップ確定 */
    var fixLvup = function () {
        console.log("[Enter]fixLvup");
        var defer = $.Deferred();

        $.ajax({
            url: "mercenary_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "new_data",
                mid: g_lvupCharaId
            }),
            success: function (res) {
                if (res.name && res.lv) {
                    log(res.name + "のレベルアップ確定(Lv" + res.lv + ")");
                    defer.resolve();
                } else {
                    log("レベルアップ確定に失敗");
                    defer.reject();
                }
            },
            error: function () {
                log("レベルアップ確定に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };
    
    /* 指定キャラのレベルアップ開始 */
    var startLvup = function (target_parameter) {
        console.log("[Enter]startLvup");
        var defer = $.Deferred();

        $.ajax({
            url: "mercenary_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "point",
                mid: g_lvupCharaId,
                type: 0,
                md: 0
            }),
            success: function (res) {
                if (res === -1) {
                    log("レベルアップ開始に失敗"); //getString(593);
                } else if (res === -2) {
                    log("レベルアップ開始に失敗"); //getString(2240);
                } else if (res === -4) {
                    log("レベルアップ開始に失敗"); //getString(4312);
                } else {
                    var point = res.point.split("-");
                    if (point.length !== 6) {
                        log("レベルアップ開始に謎の失敗");
                    } else {
                        log(res.mdata.name + "(Lv" + res.mdata.lv + ") : " + res.point);
                        // TODO:ダイス振り直し判定
                        // if (res.point != target_parameter) {}
                        defer.resolve(["char"]); // UpdateCQ
                        return;
                    }
                }
                defer.reject();
            },
            error: function () {
                log("レベルアップ開始に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /* 指定キャラのレベルアップダイス振り直し */
    var retryLvup = function () {
        console.log("[Enter]retryLvup");
        var defer = $.Deferred();

        $.ajax({
            url: "mercenary_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "point",
                mid: g_lvupCharaId,
                type: 1
            }),
            success: function (res) {
                if (res === -1) {
                    log("レベルアップダイス振り直しに失敗"); //getString(593);
                } else if (res === -2) {
                    log("レベルアップダイス振り直しに失敗"); //getString(2240);
                } else if (res === -4) {
                    log("レベルアップダイス振り直しに失敗"); //getString(4312);
                } else {
                    var point = res.point.split("-");
                    if (point.length !== 6) {
                        log("レベルアップダイス振り直しに謎の失敗");
                    } else {
                        log(res.mdata.name + "(Lv" + res.mdata.lv + ") : " + res.point);
                        // ダイス振り直し判定
                        // if (res.point != target_parameter) {}
                        defer.resolve(["char"]); // UpdateCQ
                        return;
                    }
                }
                defer.reject();
            },
            error: function () {
                log("レベルアップダイス振り直しに失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    var lvupProcess = function (charaid) {
        console.log("[Enter]lvupProcess");
        var defer = $.Deferred();

        g_lvupCharaId = charaid;

        startLvup(charaid)
            //.then(retryLvup)
            .then(updateCQ)
            .then(fixLvup)
            .then(function () {
                log("lvupProcess成功");
                defer.resolve();
            }, function () {
                log("lvupProcess失敗");
                defer.reject();
            });

        return defer.promise();
    };

    var lvupAllPTChara = function () {
        console.log("[Enter]lvupAllPTChara");
        var defer = $.Deferred();

        g_lvupCharaId = 0;
        g_lvupCharaList = [];

        if (!(g_isLvup && IS_AUTO_LVUP)) {
            defer.resolve();
            return;
        }

        var charaid = g_lvupCharaList.shift();
        if (!charaid) {
            defer.reject();
            return;
        }

        lvupProcess(charaid)
            .then(lvupAllPTChara)
            .then(defer.resolve, function () {
                log("Failed lvupAllPTChara");
                defer.reject();
            });

        return defer.promise();
    };
    
    /* 魔界戦 入場可能マップか判定 */
    var isAvailableDystopia = function (mapid, rank) {
        console.log("[Enter]isAvailableDystopia");
        var defer = $.Deferred();

        if (!mapid) {
            defer.resolve();
            return defer.promise();
        }

        $.ajax({
            url: "remain_occupy_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "occupy_data",
                index: mapid
            }),
            success: function (res) {
                if (res.self_guild.name === res.win_guild.name && res.win_guild.open === "0") {
                    log("魔界線入場可能マップ : " + res.name);
                    defer.resolve(mapid, rank); // goto getAllBlockidDystopia
                } else {
                    log("魔界線入場不可マップ : " + res.name);
                    defer.resolve(); // goto getAllBlockidDystopia
                }
            },
            error: function () {
                log("魔界戦情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /* 魔界戦 マップ内の全マスのIDを取得(rank=0:Heaven, 1:Hell) */
    var getAllBlockidDystopia = function (mapid, rank) {
        console.log("[Enter]getAllBlockidDystopia");
        var defer = $.Deferred();

        var blockidList = [];
        if (!mapid) {
            defer.resolve({
                blockidList: blockidList
            });
            return defer.promise();
        }

        $.ajax({
            url: "remain_occupy_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "heaven_data",
                index: mapid,
                rotype: rank
            }),
            success: function (res) {
                $.each(res.remain.heaven || res.remain.hell, function () {
                    // 通過済みのマスは取得しない
                    if (this.id >= res.remain.level) {
                        blockidList.push(this.id);
                    }
                });
                defer.resolve({
                    blockidList: blockidList
                });
            },
            error: function () {
                log("魔界戦マップ情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /*** 魔界戦入場可能マップか判定し、マップ内の全マスのIDを取得 ***/
    task.GetDystopiaMap = function (param) {
        console.log("[[TaskStart]]GetDystopiaMap");
        var defer = $.Deferred();

        isAvailableDystopia(param.mapid, param.rank)
            .then(getAllBlockidDystopia)
            .then(function (result) {
                defer.resolve({
                    blockidList: result.blockidList
                });
            }, function () {
                defer.reject();
            });

        return defer.promise();
    };

    /*** マップ内の全マスのIDを取得 ***/
    task.GetBlockid = function (param) {
        console.log("[[TaskStart]]GetBlockid");
        var defer = $.Deferred();

        var blockidList = [];
        if (!param.mapid) {
            defer.resolve();
            return;
        }

        $.ajax({
            url: "remain_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "remain_rank_data",
                rrank: param.mapid
            }),
            success: function (res) {
                $.each(res.remain, function () {
                    blockidList.push(this.id);
                });
                defer.resolve({
                    blockidList: blockidList
                });
            },
            error: function () {
                log("マップ情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /*** 指定されたマップ、マスの次のマスのIDを取得 ***/
    // mapid, blockid, isFirst(マップの最初のマスが取得対象か)
    // blockidとisFirstを同時に指定しないこと（blockidを優先）
    task.GetNextBlockid = function (param) {
        console.log("[[TaskStart]]GetNextBlockid");
        var defer = $.Deferred();

        var blockidList = [];
        if (!param.mapid) {
            defer.resolve();
            return;
        }

        $.ajax({
            url: "remain_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "remain_rank_data",
                rrank: param.mapid
            }),
            success: function (res) {
                if (!res.remain || res.remain.length === 0) {
                    log("マップが存在しません（きっと）");
                    defer.reject();
                    return;
                }

                var prevBlockid = parseInt(param.blockid, 10);
                var nextBlockid;
                var firstBlockid = parseInt(res.remain[0].id, 10);
                var lastBlockid = parseInt(res.remain[res.remain.length - 1].id, 10);
                var targetBlockid = parseInt(res.target_level, 10);

                if (param.blockid) {
                    nextBlockid = ++param.blockid;
                    if (nextBlockid > lastBlockid) {
                        nextBlockid = firstBlockid;
                    }
                } else if (param.isFirst) {
                    nextBlockid = firstBlockid;
                    if (res.remain[0].cable === 0) {
                        nextBlockid = targetBlockid;
                        // nextBlockidがマップ外かどうかのチェックはしない（最初のマスがセットできない状態なので）
                    }
                } else if (!param.isFirst) {
                    nextBlockid = targetBlockid;
                    if (nextBlockid > lastBlockid) {
                        nextBlockid = firstBlockid;
                    }
                }
                nextBlockid = parseInt(nextBlockid, 10);
                // nextBlockidが行けるマスか確認
                var i;
                for (i = 0; i < res.remain.length; i++) {
                    if (parseInt(res.remain[i].id, 10) === nextBlockid) {
                        if (res.remain[i].cable === 0) {
                            log(res.remain[i].name + "[" + res.remain[i].id + "]に行くことができません");
                            var nextIndex = res.level_set.indexOf(res.target_level);
                            if (nextIndex < 0) {
                                log("次のマスの決定に失敗");
                                defer.reject();
                                return;
                            } else {
                                log(res.remain[nextIndex].name + "[" + res.target_level + "]に行きます");
                                nextBlockid = targetBlockid;
                            }
                        }
                        break;
                    }
                    if (i === res.remain.length - 1) {
                        log("blockid=" + nextBlockid + "がmapid=" + param.mapid + "に存在しません");
                        defer.reject();
                        return;
                    }
                }
                defer.resolve({
                    blockid: nextBlockid,
                    isEnd: (prevBlockid === lastBlockid && nextBlockid === firstBlockid)
                });
            },
            error: function () {
                log("マップ情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /*** 全マップの攻略済みの最高難易度のボスマスのIDを取得 ***/
    // mapid, blockid, isFirst(マップの最初のマスが取得対象か)
    // blockidとisFirstを同時に指定しないこと（blockidを優先）
    task.GetAllBossBlockid = function () {
        console.log("[[TaskStart]]GetAllBossBlockid");
        var defer = $.Deferred();

        var blockidList = [];
        var maxRank = 3;
        var i = 0;

        //$.each(NormalMapList, function () {
        var getAllBossBlockidInner = function (mapid) {
            $.ajax({
                url: "remain_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "remain_rank_data",
                    rrank: mapid
                }),
                success: function (res) {
                    if (!res.remain) {
                        log("マップが存在しません（きっと）");
                        defer.reject();
                        return;
                    }

                    var bossBlockid = parseInt(res.level_set[res.level_set.length - 1], 10);
                    if (res.target_level - 1 !== bossBlockid) {
                        if (mapid % 1000 > 1) {
                            getAllBossBlockidInner(mapid - 1);
                            return;
                        } else {
                            if (++i < NormalMapList.length) {
                                getAllBossBlockidInner(NormalMapList[i] + maxRank);
                                return;
                            }
                        }
                    } else {
                        blockidList.push(bossBlockid);
                        if (++i < NormalMapList.length) {
                            getAllBossBlockidInner(NormalMapList[i] + maxRank);
                            return;
                        }
                    }
                    defer.resolve(blockidList);
                },
                error: function () {
                    log("マップ情報取得に失敗");
                    defer.reject();
                }
            });
        };

        getAllBossBlockidInner(NormalMapList[i] + maxRank);
        return defer.promise();
    };

    /*** 戦闘 ***/
    task.Battle = function (battleData) {
        console.log("[[TaskStart]]Battle(" + battleData.round + ")");
        var defer = $.Deferred();

        var isBattleSuccess = 0;

        g_isLvup = 0;
        g_isBattleSudden = battleData.round % 10 === 0 ? 1 : 0;

        battleGetMaxParty(battleData)
            .then(battleGetParty)
            .then(battlePrepare)
            .then(battleStart)
            .then(battleSendResult)
            .then(battleGetReport)
            .then(function () {
                isBattleSuccess = 1;
                return updateCQ();
            }, function () {
                isBattleSuccess = 0;
                return updateCQ();
            })

            .then(getSuddenList)
            .then(suddenAllAttack)

            .then(getLvupCharaInParty)
            .then(lvupAllPTChara)
            .then(function () {
                if (isBattleSuccess) {
                    defer.resolve();
                } else {
                    defer.reject();
                    log("Failed Battle task");
                }
            }, function () {
                defer.reject();
                log("Failed Battle task");
            });

        return defer.promise();
    };
/*
    var repeatBattle = function () {
        log("[Enter]repeatBattle");
        var defer = $.Deferred();

        var list = g_blockidList;
        g_blockid = list.shift();
        if (!g_blockid) {
            defer.reject();
            return;
        }

        log("---- g_blockid = " + g_blockid);

        Battle()
            .then(repeatBattle)
            .then(defer.resolve, function () {
                log("Failed repeatBattle");
                defer.reject();
            });

        return defer.promise();
    };
*/

    /* 魔界線 入場可能マップをすべて回る(Heaven・Hell個別) */
/*
    var dystopiaAllBattle = function (rank) {
        log("Enter dystopiaAllBattle");
        var defer = $.Deferred();

        var maplist = DystopiaMapList;
        var mapid = maplist.shift();
        if (!mapid) {
            defer.reject();
            return;
        }

        isAvailableDystopia(mapid, rank)
            .then(getAllBlockidDystopia)
            .then(repeatBattle)
            .then(dystopiaAllBattle)
            .then(defer.resolve, function () {
                log("Failed dystopiaAllBattle");
                defer.reject();
            });

        return defer.promise();
    };
*/

    /* 側近へプレゼント */
    task.GiftToMaid = function (giftConfig) {
        console.log("[Enter]giveItemsToMaid");
        var defer = $.Deferred().resolve();

        defer = defer.then(function () {
            var d = $.Deferred();
            $.ajax({
                url: "dialog_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "md_page"
                }),
                success: function (res) {
                    if (res.gifttime) {
                        giftConfig.time = new Date(res.gifttime.duedate);
                        d.resolve();
                        return;
                    }
                    $.each(res.md_merc, function () {
                        if (this.name === giftConfig.maidName) {
                            giftConfig.maidid = this.id;
                            return false;
                        }
                    });
                    if (!giftConfig.maidid) {
                        log("指定された名前の側近が見つかりません");
                        d.reject();
                    }
                    d.resolve(giftConfig);
                },
                error: function (res) {
                    log("側近情報取得に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function (giftConfig) {
            var d = $.Deferred();
            if (!giftConfig) {
                return d.resolve().promise();
            }

            $.ajax({
                url: "mdmerc_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "gift_list",
                    mid: giftConfig.maidid,
                    itype: 0
                }),
                success: function (res) {
                    if (res.result === 1) {
                        giftConfig.giftid = null;
                        giftConfig.gifttype = null;
                        $.each(giftConfig.itemList, function (i, giftItem) {
                            $.each(res.item, function (type, typeList) {
                                $.each(typeList, function (index, item) {
                                    if (item.name === giftItem && item.ilock === "0") {
                                        giftConfig.giftid = item.id;
                                        giftConfig.gifttype = type;
                                        log(item.name + "を" + giftConfig.maidName + "へプレゼントします");
                                        return false;
                                    }
                                });
                                if (giftConfig.giftid) { return false; }
                            });
                            if (giftConfig.giftid) { return false; }
                        });
                        if (giftConfig.giftid) {
                            d.resolve(giftConfig);
                        } else {
                            console.log("プレゼント対象のアイテム所持なし");
                            d.reslve();     // プレゼント対象のアイテムなし
                        }
                    } else {
                        log("プレゼントリスト取得に失敗");
                        d.reject();
                    }
                },
                error: function (res) {
                    log("側近情報取得に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function (giftConfig) {
            var d = $.Deferred();
            if (!giftConfig) {
                return d.resolve().promise();
            }

            $.ajax({
                url: "mdmerc_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "item_give",
                    mid: giftConfig.maidid,
                    item: giftConfig.giftid,
                    itype: giftConfig.gifttype
                }),
                success: function (res) {
                    if (res.result === 1) {
                        var str = "アイアスの羽:" + res.add;
                        if (res.addgp) {
                            str += ", 好感度上昇:" + res.addgp;
                        }
                        log(str);
                        giftConfig.time = new Date(res.gifttime.duedate);
                        d.resolve(giftConfig);
                    } else {
                        log("プレゼントに失敗");
                        d.reject();
                    }
                },
                error: function (res) {
                    log("プレゼント情報取得に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function (giftConfig) {
            return $.Deferred().resolve(giftConfig);
        }, function () {
            return $.Deferred().reject();
        });

        return defer.promise();
    };


    /* ログインボーナスを獲得 */
    task.getLoginBonus = function () {
        console.log("[Enter]getLoginBonus");
        var defer = $.Deferred();

        var $iframe = $('#main');
        var ifrmDoc = $iframe[0].contentWindow.document;

        // ログインボーナス獲得までの残り時間の表示が更新されないので、チェックしない
        $.ajax({
            url: "updateinfo_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "login_reward"
            }),
            success: function (res) {
                // 1:成功
                var result = parseInt(res.result, 10);
                if (result === 1) {
                    log("ログインボーナス " + res.msg);
                    defer.resolve({
                        isNext: true,
                        time: res.time
                    });
                // 2:成功（その日のプレゼントは終わり
                } else if (result === 2) {
                    log("ログインボーナス " + res.msg);
                    defer.resolve({
                        isNext: false,
                        time: null
                    });
                // -1:日付をまたいだ
                } else if (result === -1) {
                    log("ログインボーナス獲得エラー(" + result + ")");
                    $("#merc_title", ifrmDoc).click();
                    setTimeout(defer.reject, 5000);
                // -2:獲得可能時間前の場合
                } else if (result === -2) {
                    log("ログインボーナス獲得エラー(" + result + ")");
                    defer.reject();
                // -3:ログインボーナス終了済み
                } else if (result === -3) {
                    log("ログインボーナス獲得エラー(" + result + ")");
                    defer.resolve({
                        isNext: false,
                        time: null
                    });
                    defer.resolve();
                } else {
                    log("ログインボーナス獲得エラー(" + result + ")");
                    defer.reject();
                }
            },
            error: function () {
                log("ログインボーナス獲得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /* 都市のリストと各都市のデータを取得 */
    var getTownList = function () {
        console.log("[Enter]getTownList");
        var defer = $.Deferred();
        var townIdList = [];

        $.ajax({
            url: "flash_trans_xml_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "town_list"
            }),
            success: function (res) {
                var i = 0;
                for (i = 0; i < res.self.length; i++) {
                    townIdList[i] = {
                        id: res.self[i].id,
                        name: res.self[i].name
                    };
                }

                defer.resolve(townIdList);
            },
            error: function () {
                log("都市のリスト取得に失敗");
                defer.reject();
                //return;
            }
        });

        return defer.promise();
    };

    var getTownsData = function (townIdList) {
        console.log("[Enter]getTownsData");
        var defer = $.Deferred();
        defer.resolve();
        var townsData = {};

        $.each(townIdList, function (i, townId) {
            defer = defer.then(function () {
                return $.ajax({
                    url: "town.php?town=" + townId.id,
                    type: "GET",
                    //cache: false,
                    //dataType: "json",
                    success: function (res) {
                    },
                    error: function () {
                        log("都市データの取得(town.php)に失敗");
                    }
                });

            }).then(function () {
                return $.ajax({
                    url: "flash_trans_xml_.php?town=" + townId.id,
                    type: "POST",
                    cache: false,
                    //dataType: "json",
                    data: ({
                        op: "AREA"
                    }),
                    success: function (res) {
                    },
                    error: function () {
                        log("都市データの取得(AREA)に失敗");
                    }
                });

            }).then(function () {
                return $.ajax({
                    url: "flash_trans_xml_.php?town=" + townId.id,
                    type: "POST",
                    cache: false,
                    //dataType: "json",
                    data: ({
                        op: "READ"
                    }),
                    success: function (res) {
                        var json_data = null;
                        try {
                            json_data = $.parseJSON(res.slice(res.indexOf("["), res.indexOf("&op")));
                        } catch (e) {}
                        if (json_data === null) {
                            log("都市データパース失敗");
                            return false;
                        } else {
                            townsData[townId.name] = json_data;
                            //console.log(townsData[townId]);
                        }
                    },
                    error: function () {
                        log("都市データの取得(READ)に失敗");
                    }
                });
            });
        });

        defer = defer.then(function () {
            var defer2 = $.Deferred();
            if (townsData.length === 0) {
                defer2.reject();
            } else {
                defer2.resolve(townsData);
            }
            return defer2.promise();
        });

        return defer.promise();
    };

    /* 一番レベルの高い変換器(400)がある都市のIDを取得 */
    var getTownTransducer = function (townsData) {
        //townsData = { id: towndata, id: towndata, ... }
        var town;
        var transducerLv = 0;

        $.each(townsData, function (name, townData) {
            $.each(townData[1], function () {
                if (this.building > 400 && this.building < 500) {
                    if (transducerLv < parseInt(this.lv, 10)) {
                        transducerLv = parseInt(this.lv, 10);
                        town = name;
                    }
                }
            });
        });
        if (town) {
            console.log("変喚器は" + town + "を使います");
            TRANS.TOWNID = townsData[name][0];
        }
    };

    /*** 魔晶石変換に使用する練成器（がある都市）を取得する ***/
    task.GetTownTransducer = function () {
        console.log("[[TaskStart]]GetTownTransducer");
        var defer = $.Deferred();

        getTownList()
            .then(getTownsData)
            .then(function (townsData) {
                var townName;
                var transducerLv = 0;
                $.each(townsData, function (name, townData) {
                    $.each(townData[1], function () {
                        if (this.building > 400 && this.building < 500) {
                            if (transducerLv < parseInt(this.lv, 10)) {
                                transducerLv = parseInt(this.lv, 10);
                                townName = name;
                            }
                        }
                    });
                });
                if (townName) {
                    console.log(townName + " の練成器を使います");
                    TRANS.TOWNID = townsData[townName][0];
                }
                defer.resolve();
            });

        return defer.promise();
    };

    /*** 指定された☆以上のキャラを名声召喚する(指定☆以下のキャラは解雇する) ***/
    task.Recruit = function (recruitConfig) {
        console.log("[[TaskStart]]Recruit");
        var defer = $.Deferred().resolve();

        defer = defer.then(function () {
            var defer2 = $.Deferred();
            $.ajax({
                url: "mercenary_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "bar",
                    rank: 2,
                    ufree: 0
                }),
                success: function (res) {
                    if (res.length === 2) {
                        var rarity = parseInt(res[1].merc.rarity, 10);
                        var charaid = res[1].merc.DBID;

                        if (rarity !== null && charaid !== null) {
                            recruitConfig.count--;
                            log("☆" + rarity + res[1].merc.name + "を召喚");
                            if (rarity < recruitConfig.rarity) {
                                defer2.resolve(true, charaid);
                            } else {
                                recruitConfig.maxnum--;
                                defer2.resolve(false, null);
                            }

                        } else {
                            log("召喚キャラの☆、IDの取得に失敗");
                            defer2.reject(["res", "char"]); // goto updateCQ
                        }
                    } else {
                        log("召喚情報の取得に失敗");
                        defer2.reject(["res", "char"]); // goto updateCQ
                    }
                },
                error: function () {
                    log("召喚に失敗");
                    defer2.reject(["res", "char"]); // goto updateCQ
                }
            });

            return defer2.promise();

        }).then(function (fire, charaid) {
            var defer2 = $.Deferred();
            if (!fire) {
                defer2.resolve();
                return;
            }

            $.ajax({
                url: "mercenary_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "fire",
                    ftype: 1,
                    id: charaid
                }),
                success: function (res) {
                    if (res.result === true) {
                        log("解雇に成功");
                        defer2.resolve(["res", "char"]); // goto updateCQ
                    } else {
                        log("解雇情報の取得に失敗");
                        defer2.reject(["res", "char"]); // goto updateCQ
                    }
                },
                error: function () {
                    log("解雇に失敗");
                    defer2.reject(["res", "char"]); // goto updateCQ
                }
            });

            return defer2.promise();

        }).always(updateCQ)

            .then(function () {
                return $.Deferred().resolve(recruitConfig).promise();
            }, function () {
                return $.Deferred().reject(recruitConfig).promise();
            });

        return defer.promise();
    };

    /* 拠点戦に参加 */
    task.JoinCamp = function () {
        console.log("[[TaskStart]]JoinCamp");
        var defer = $.Deferred();
        var townIdList = [];

        $.ajax({
            url: "camp_occupy_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "sign_up_data",
                nid: 0
            }),
            success: function (res) {
                if (res.result === 1) {
                    log("拠点戦に参加");
                }
                defer.resolve();
            },
            error: function () {
                log("拠点戦参加に失敗");
                defer.resolve();    // 失敗してもコマンドは終了させない
            }
        });

        return defer.promise();
    };

}());

$(function () {
    'use strict';

    var timer;
    log("Start script");


    cmdManager.pollTask();
    var watch = function () {
        var $iframe = $('#main');
        var ifrmDoc = $iframe[0].contentWindow.document;

        if (!$("#igu", ifrmDoc)[0]) {
            $("#remain_bg", ifrmDoc).append($(
                '<a href="javascript: void(0);" id="igu" class="top_menu_btn tmc" title="自動戦闘" alt="自動戦闘" style="position: absolute; right: 0px; top: 0px; background:url(http://lm-s4.ujj.co.jp/web/image2/wnd/main/md_btn.png) no-repeat;" ><span id="igu_title" class="top_font">自動戦闘</span></a>'
            ));

            $("#igu", ifrmDoc).on("click", function () {
                log("Clicked");

                //var mapBattle = new cmdMapBatttle();
                //g_cmdList.push(mapBattle);

                //var blockBattle = new cmdBlockBatttle();
                //g_cmdList.push(blockBattle);
                
                //getDailyLoginPresent();

                // *** 現在このスクリプトでできること ***

                // 1.指定された1つ以上のマスで手動戦闘する
                // g_blockidList(グローバル)にマスのリストを設定し、repeatBattleを呼ぶ

                //g_blockidList = [1100, 2100, 3100];
                //g_blockidList = [];
                //for (i = 0; i < 10; i++) g_blockidList.push(26048);
                //repeatBattle();

                // 2.指定されたマップの初めから順にすべてのマスで手動戦闘する
                // マップIDをgetAllBlockidに渡し(blockListが設定される)、repeatBattleを呼ぶ

                // 3.入場可能な魔界戦マップをすべて手動戦闘する（攻略済みがあってもOK）
                //rank = 1;   // 0 : Heaven, 1: Hell
                //dystopiaAllBattle(rank);

                // 魔界戦で1マップのみ攻略する場合は #動作未確認
                //isAvailableDystopia(94001, 1)
                //.then(getAllBlockidDystopia)
                //.then(repeatBattle);

                // 4. 出現中のサドンボスのリストを取得して、HPが30%以下ならLV1のキャラ1匹で殴る
                //getSuddenList()
                //.then(suddenAllAttack);

                // 5. キャラのLVUP
                //lvupProcess(7769528);

                /*
                var battle = new Battle();
                battle.getParty(2)
                .then(battle.prepare)
                .then(battle.start)
                .then(battle.sendResult)
                .then(battle.getReport)
                .then(updateCQ, updateCQ);
                */

                /*if (auto_battle) {
                    var battle = new Battle();
                    battle.getParty(2)
                    .then(battle.prepare)
                    .then(battle.getReport)
                    .then(updateCQ, updateCQ);
                }*/

                //log("---- Completed ----");
            });
        }

        //cmdManager();
        //setSchedule();
        //popTaskQueue();
    };
    timer = setInterval(watch, 1000);
/*
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.op === COMMON.OP.LOGINBONUSSTATUS) {
                sendResponse({msg: loginBonus.statusMsg});
            }
        }
    );

        chrome.runtime.sendMessage({
            "op": "get",
            "key": "interval"
        }, function(response) {
            var interval = response.value;
            timer = setInterval(watch, interval * 1000);
        });
*/
});
