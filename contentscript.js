/*jslint vars: true, plusplus: true*/
/*global $, chrome, console, log, COMMON, config, cmdManager*/

/*
    jQuery JavaScript Library v1.9.1 で動作確認
    v1.7はだめー
*/

/* --- キャラのレベルアップ --- */
var IS_AUTO_LVUP = false; // 自動でLVUPするか
var g_isLvup = 0;
var g_lvupCharaId = 0;
var g_lvupCharaList = [];

/* --- サドンボス --- */
var IS_BEAT_SUDDEN = 1; // 自分が遭遇したサドンボスを30％以上削るか（キャラに余裕がある場合使用推奨）

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

/*
battleData = {
    // 戦闘前にセット
    blockid,    // 協防の場合は"town"
    time,
    round,
    maid,
    // 戦闘中にセット
    maxPartyNum,
    partyData,
    result_txt = { pteam_txt, eteam_txt },
    isBattleSuccess,
    isSudden,
    isLvup
}
*/
var task = {};
(function () {
    'use strict';
    /* 指定マスの最大パーティ数を取得する */
    // param = { blockid }
    var battleGetMaxParty = function (battleData) {
        console.log("[Enter]battleGetMaxParty");
        var defer = $.Deferred();

        var url;
        var data = {};

        if (battleData.blockid === "town") {
            url = "flash_trans_xml_.php";
            data = {
                op: "town_defend_data"
            };
        } else {
            url = "remain_.php";
            data = {
                op: "get_monster_data",
                level: battleData.blockid,
                mload: 1
            };
        }

        $.ajax({
            url: url,
            type: "POST",
            cache: false,
            dataType: "json",
            data: data,
            success: function (res) {
                if (!res.max_party_num) {
                    log("最大攻略可能パーティ数取得に失敗");
                    defer.reject();
                } else {
                    battleData.maxPartyNum = parseInt(res.max_party_num, 10);
                    if (battleData.blockid === "town") {
                        battleData.blockid = res.level;
                        log("---- " + res.stage.name + "[" + battleData.blockid + "]");
                    } else {
                        log("---- " + res.stagename + "[" + battleData.blockid + "]");
                    }
                    console.log("最大攻略可能パーティ数 ：" + battleData.maxPartyNum);

                    if (battleData.maid) {
                        if (res.assist.num <= 0 && battleData.maid === 1) {
                            console.log("側近残り戦闘回数0");
                            battleData.maid = 0;
                        }
                    }
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
                assist_set: battleData.maid,
                hire_set: 0,
                hire_id: 0,
                reitem: 0
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
        console.log(json_data);
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
                if (config.battleDamage.enable) {
                    var minhp = hp * config.battleDamage.minhp;
                    hp = Math.floor(Math.random() * (hp - minhp) + minhp);
                    if (hp < 1) { hp = 1; }
                }
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
                if (battleData.result_txt.pteam_txt === "") {
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

        if (battleData.result_txt.pteam_txt === "") {
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
                    defer.resolve(battleData); // goto battleGetReport
                },
                error: function (data) {
                    log("手動戦闘結果送信に失敗");
                    defer.reject(battleData); // goto updateCQ
                }
            });
        }, time * 1000);

        return defer.promise();
    };

    /* 戦闘獲得資源・アイテム取得 */
    var battleGetReport = function (battleData) {
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
                    battleData.isSudden = true;
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
                    battleData.isLvup = false;
                    if (data.mercLevel !== undefined && data.mercLevel === 1) {
                        battleData.isLvup = true;
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

        if (!config.trans.enable || stone.current < stone.limit * config.trans.threshold) {
            return defer.promise();
        }
        var trans_stone = parseInt(stone.limit * config.trans.ratio, 10);

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

        if (config.trans.enable && current_stone > limit_stone * config.trans.threshold) {
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
                var trans_stone = parseInt(limit_stone * config.trans.ratio, 10);
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

        });
//            .then(task.TransBattlePrepare);

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

        if (!(config.sudden.enable)) {
            return defer.resolve().promise();
        }

        // 自分のプレイヤ名を取得
        var $iframe = $('#main');
        var ifrmDoc = $iframe[0].contentWindow.document;
        var myname = $("#name", ifrmDoc).text();
        if (!myname) {
            log("自分の名前の取得に失敗");
            return defer.reject().promise();
        }

        var suddenList = [];

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
                    } else if (this.discoverer === myname) {
                        suddenList.push({id : this.id, mine : 1});
                        console.log(this.name + "(id=" + this.id + ") : 遭遇者が自分なので攻撃対象です");
                    } else if (this.max_hp <= config.sudden.minhp) {
                        console.log(this.name + "(id=" + this.id + ") : 最大HPが" + config.sudden.minhp + "以下なので攻撃対象ではありません");
                    } else if (this.hp / this.max_hp < 0.70) {
                        suddenList.push({id : this.id, mine : 0});
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
                            defer.resolve(suddenList);    // goto suddenAllAttack
                        },
                        error: defer.reject
                    });
                } else {
                    defer.resolve(suddenList);   // goto suddenAllAttack
                }
            },
            error: function () {
                log("サドンボス情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    // サドン戦闘画面
    var getSuddenData = function (suddenData) {
        console.log("[Enter]getAvailableCharaSudden");
        var defer = $.Deferred();

        if (!suddenData) {
            return defer.resolve().promise();
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
                if (res.result === 1 && res.merc) {
                    suddenData.rate = parseFloat(res.rate);
                    suddenData.maxhp = parseInt(res.sudden.hp, 10);
                    suddenData.lefthp = parseInt(res.sudden.now_hp, 10);
                    suddenData.merc = res.merc;
                    if (res.sudden.show && parseInt(res.sudden.show, 10) < 2) {
                        suddenData.assist = 1;  // 援護要請可能
                    } else {
                        suddenData.assist = 0;
                    }
                    defer.resolve(suddenData);
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

    // サドン攻撃
    var attackSudden = function (suddenData) {
        console.log("[Enter]attackSudden");
        var defer = $.Deferred();

        var charaid = null;
        var attackSuddenInner = function (suddenData) {
            if (!suddenData) {
                return defer.resolve(suddenData).promise();
            }

            charaid = null;
            // 他人のサドン：rate==0なら"LV1"で殴る（設定HP以下の他人のサドンはこのリストには含まれない）
            if (suddenData.mine === 0 && suddenData.rate === 0 &&
                    suddenData.maxhp > config.sudden.minhp) {
                $.each(suddenData.merc, function () {
                    if (parseInt(this.lv, 10) === 1) {
                        console.log(this.name + " ☆" + this.rarity + " (id=" + this.id + ")で殴ります");
                        charaid = this.id;
                        return false;
                    }
                });
                if (charaid === null) {
                    log("殴れるキャラがいません");
                }

            // 自分のサドン：設定HP以上なら"LV1以上"で殴る
            } else if (suddenData.mine === 1 && suddenData.maxhp > config.sudden.minhp) {
                // 30%以下のダメージの場合、次に殴るキャラを取得する
                if (suddenData.rate <= 30.0) {
                    $.each(suddenData.merc, function () {
                        if (parseInt(this.lv, 10) > 1) {
                            console.log(this.name + " ☆" + this.rarity + " (id=" + this.id + ")で殴ります");
                            charaid = this.id;
                            return false;
                        }
                    });
                    // 殴れるキャラがいない場合、ALWAYSの時のみ、援護要請する
                    if (charaid === null) {
                        log("殴れるキャラがいません");
                        if (config.sudden.assist === COMMON.SUDDEN_ASSIST.ALWAYS) {
                            suddenData.assist += 1;
                        }
                    }
                // 30%以上のダメージの場合、NEVER以外の時、援護要請する
                } else {
                    if (config.sudden.assist !== COMMON.SUDDEN_ASSIST.NEVER) {
                        suddenData.assist += 1;
                    }
                }

            // 自分のサドン：設定HP以下なら殴らずに援護要請を出す
            } else if (suddenData.mine === 1 && suddenData.maxhp <= config.sudden.minhp) {
                console.log("自分のサドン(id=" + suddenData.id + ") : 最大HPが" + config.sudden.minhp + "以下なので殴りません");
                if (config.sudden.assist !== COMMON.SUDDEN_ASSIST.NEVER) {
                    suddenData.assist += 1;
                }
            }

            if (charaid) {
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
                        if (res.result === 1) {
                            console.log("サドンボス攻撃に成功");
                            suddenData.rate = parseFloat(res.rate);
                            suddenData.maxhp = parseInt(res.battle.max, 10);
                            suddenData.lefthp = parseInt(res.battle.left_hp, 10);
                            suddenData.merc = res.merc_list;
                            attackSuddenInner(suddenData);
                        } else {
                            log("サドンボス攻撃に失敗");
                            defer.resolve();
                        }
                    },
                    error: function () {
                        log("サドンボス攻撃情報取得に失敗");
                        defer.reject();
                    }
                });
            } else {
                defer.resolve(suddenData);
            }
        };

        attackSuddenInner(suddenData);

        return defer.promise();
    };

    var reqSuddenAssist = function (suddenData) {
        console.log("[Enter]reqSuddenAssist");
        var defer = $.Deferred();

        // だってビット演算怒られるんだもん
        if (!suddenData || !suddenData.assist || suddenData.assist !== 2) {
            return defer.resolve(suddenData).promise();
        }

        $.ajax({
            url: "remain_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "sudden_assist_require",
                sid: suddenData.id
            }),
            success: function (res) {
                if (res.result && res.result === 1) {
                    console.log("サドン援護要請に成功");
                    defer.resolve();
                } else {
                    console.log("サドン援護要請に失敗");
                    defer.resolve();
                }
            },
            error: function () {
                log("サドン援護要請通信に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    var suddenAllAttack = function () {
        console.log("[Enter]suddenAllAttack");
        var defer = $.Deferred().resolve();

        if (!config.sudden.enable) {
            return defer.resolve().promise();
        }

        var suddenAttack = function (suddenList) {
            var d = $.Deferred().resolve();
            $.each(suddenList, function (index, suddenData) {
                d = d.then(function () {
                    return $.Deferred().resolve(suddenData).promise();
                })
                    .then(getSuddenData)
                    .then(attackSudden)
                    .then(reqSuddenAssist)
                    .then(function () {
                        console.log("suddenProcess成功");
                        return $.Deferred().resolve().promise();
                    }, function () {
                        log("suddenProcess失敗");
                        return $.Deferred().reject().promise();
                    });
            });
            return d.promise();
        };

        defer = defer.then(getSuddenList)
            .then(suddenAttack);

        return defer.promise();
    };

    /* (new) 戦闘終了後のLVUPキャラリストからレベルアップする方法(PTに入っていないキャラ・側近も取得できるリストに含まれる) */
    /* パーティーに加入しているキャラのうち、レベルアップフラグが立っているキャラのリストを取得 */
    var getLvupCharaInParty = function (battleData) {
        console.log("[Enter]getLvupCharaInParty");
        var defer = $.Deferred();

        if (!config.lvup.enable) {
            return defer.resolve([]).promise();
        }

        var lvupCharaList = [];
        var i;

        $.ajax({
            url: "mercenary_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "get_lvup_merc"
            })
        }).then(function (res) {
            $.each(res, function () {
                // パーティーに加入しているメンバーに限定する（側近は常に含まれるはず？party: "0-x"）
                if (battleData.isLvup && this.party !== "0") {
                    for (i = 0; i < config.lvup.data.length; i++) {
                        if (config.lvup.data[i].name === this.name) {
                            lvupCharaList.push({
                                id: parseInt(this.id, 10),
                                name: this.name,
                                lvupData: config.lvup.data[i]
                            });
                            break;
                        }
                    }

                } else if (battleData.maid) {
                    if (this.name === "フリューネ" || this.name === "キサナ" ||
                            this.name === "アリシア" || this.name === "リエル") {
                        for (i = 0; i < config.lvup.data.length; i++) {
                            if (config.lvup.data[i].name === this.name) {
                                lvupCharaList.push({
                                    id: parseInt(this.id, 10),
                                    name: this.name,
                                    lvupData: config.lvup.data[i]
                                });
                                break;
                            }
                        }
                    }
                }
            });
            defer.resolve(lvupCharaList);
        }, function () {
            log("レベルアップキャラリストの取得に失敗");
            defer.reject();
        });

        return defer.promise();
    };

    /* 指定キャラのレベルアップ開始 */
    var diceLvup = function (charaData) {
        console.log("[Enter]diceLvup");
        var defer = $.Deferred();
        var isFirst = true;
        var reqData = {};
        var canVip = false;

        var diceLvupInner = function (charaData) {
            if (isFirst) {
                reqData = {
                    op: "point",
                    mid: charaData.id,
                    type: 0,
                    md: 0
                };
            } else if (charaData.lvupData.type === "dice") {
                reqData = {
                    op: "point",
                    mid: charaData.id,
                    type: 1
                };
            } else if (charaData.lvupData.type === "vip") {
                if (!canVip) {
                    log("VIP振りはできません");
                    defer.reject();
                    return;
                }
                var point_array = [];
                var i;
                for (i = 0; i < COMMON.STATUSLIST.length; i++) {
                    point_array.push((charaData.lvupData.cond[i].length === 0) ? 0 : charaData.lvupData.cond[i][0]);
                }
                reqData = {
                    op: "appoint_set",
                    mid: charaData.id,
                    point_array: point_array
                };
            }
            $.ajax({
                url: "mercenary_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: reqData,
                success: function (res) {
                    if (charaData.lvupData.type === "vip" && !isFirst) {
                        if (!res.result || res.result !== "success") {
                            log("レベルアップ(VIP)に失敗");
                            defer.reject();
                        } else {
                            log(charaData.name + "レベルアップ(VIP)確定");
                            defer.resolve(); // submitLvup
                        }
                        return;
                    }
                    if (res === -1) {
                        log("レベルアップ(ダイス)に失敗"); //getString(593);
                        defer.reject();
                    } else if (res === -2) {
                        log("レベルアップ(ダイス)に失敗: " + "配分するポイントがありません"); //getString(2240) VIPじゃない;
                        defer.reject();
                    } else if (res === -4) {
                        log("レベルアップ(ダイス)に失敗: " + "参戦中はLVUPできません"); //getString(4312);
                        defer.reject();
                    } else {
                        if (res.appoint && res.appoint === 1) {
                            canVip = true;
                        }

                        var point = res.point.split("-").map(function (p) { return parseInt(p, 10); });
                        if (point.length !== 6) {
                            log("レベルアップ(ダイス)に謎の失敗");
                            defer.reject();
                        } else {
                            log(res.mdata.name + "(Lv" + res.mdata.lv + ") : " + res.point + "(total " +
                                point.reduce(function (a, b, i) { return (i === 1 ? (a / 5) : a) + b; }) + ")");
                            point[0] = point[0] / 5;  // HP
                            // ダイス振り直し判定
                            var total = 0, i;
                            for (i = 0; i < COMMON.STATUSLIST.length; i++) {
                                if (charaData.lvupData.cond[i].length > 0) {
                                    if (charaData.lvupData.cond[i].indexOf(point[i]) === -1) {
                                        break;
                                    }
                                }
                                total += point[i];
                            }
                            if (total < charaData.lvupData.point) {
                                isFirst = false;
                                diceLvupInner(charaData);
                                return;
                            }
                            var newlv = parseInt(res.mdata.lv, 10) + 1;
                            log(res.mdata.name + "レベルアップ確定(Lv" + newlv + ")");
                            if (charaData.lvupData.type === "vip" && !isFirst) {
                                defer.resolve(); // submitLvupで何もしない
                            } else {
                                defer.resolve(charaData); // submitLvup
                            }
                        }
                    }
                },
                error: function () {
                    log("レベルアップ(ダイス)に失敗");
                    defer.reject();
                }
            });
        };

        diceLvupInner(charaData);
        return defer.promise();
    };

    /* レベルアップ確定 */
    var submitLvup = function (charaData) {
        console.log("[Enter]submitLvup");
        if (!charaData) {
            return;
        }
        var defer = $.Deferred();

        $.ajax({
            url: "mercenary_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "point_submit",
                mid: charaData.id
            }),
            success: function (res) {
                if (res.result === 1) {
                    console.log("レベルアップ確定");
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

    var lvupAllPTChara = function (battleData) {
        console.log("[Enter]lvupAllPTChara");
        var defer = $.Deferred().resolve(battleData);

        var lvupProcess = function (lvupCharaList) {
            var d = $.Deferred().resolve();
            $.each(lvupCharaList, function (index, charaData) {
                d = d.then(function () {
                    return $.Deferred().resolve(charaData).promise();
                })
                    .then(diceLvup)
                    .then(submitLvup)
                    .then(function () {
                        console.log("lvupProcess成功");
                        return $.Deferred().resolve().promise();
                    }, function () {
                        log("lvupProcess失敗");
                        return $.Deferred().reject().promise();
                    });
            });
            return d.promise();
        };

        defer = defer.then(getLvupCharaInParty)
            .then(lvupProcess)
            .then(defer.resolve, function () {
                log("Failed lvupAllPTChara");
            });

        return defer.promise();
    };

    /* パーティーに加入しているキャラのうち、レベルアップフラグが立っているキャラのリストを取得 */
    var old_getLvupCharaInParty = function () {
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

    var old_lvupProcess = function (charaid) {
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

    var old_lvupAllPTChara = function () {
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

        old_lvupProcess(charaid)
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
                var nextBlockid = 0;
                var firstBlockid = parseInt(res.remain[0].id, 10);
                var lastBlockid = parseInt(res.remain[res.remain.length - 1].id, 10);
                var targetBlockid = parseInt(res.target_level, 10);
                var i, j;

                if (param.blockid) {
                    //nextBlockid = ++param.blockid;
                    //if (nextBlockid > lastBlockid) {
                    //    nextBlockid = firstBlockid;
                    //}
                    for (i = 0; i < res.remain.length; i++) {
                        if (parseInt(res.remain[i].id, 10) === param.blockid) {
                            if (i === res.remain.length - 1) {
                                nextBlockid = firstBlockid;
                            } else {
                                nextBlockid = parseInt(res.remain[i + 1].id, 10);
                            }
                            break;
                        }
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
                for (i = 0; i < res.remain.length; i++) {
                    if (parseInt(res.remain[i].id, 10) === nextBlockid) {
                        if (res.remain[i].cable === 0) {
                            log(res.remain[i].name + "[" + res.remain[i].id + "]に行くことができません");
                            for (j = 0; j < res.remain.length; j++) {
                                if (parseInt(res.remain[j].id, 10) === targetBlockid &&
                                        res.remain[j].cable !== 0) {
                                    log(res.remain[j].name + "[" + targetBlockid + "]に行きます");
                                    nextBlockid = targetBlockid;
                                    break;
                                }
                                if (j === res.remain.length - 1) {
                                    log("次のマスの決定に失敗");
                                    defer.reject();
                                    return;
                                }
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

            .then(task.TransBattlePrepare)

            .then(function () {
                if (battleData.isSudden || battleData.round % 10 === 0) {
                    return suddenAllAttack();
                }
            })

            .then(function () {
                if (config.item.enable === true && (battleData.isSudden || battleData.round % 10 === 0)) {
                    return task.CleanBag();
                }
            })

            .then(function () {
                if ((battleData.isLvup && config.lvup.enable) || (battleData.maid && config.lvup.enable)) {
                    return lvupAllPTChara(battleData);
                }
            })

            .then(function () {
                if (isBattleSuccess) {
                    defer.resolve(battleData);
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
                            // 30分後にリトライ
                            var  now = new Date();
                            now.setMinutes(now.getMinutes() + 30);
                            giftConfig.time = now;
                            d.resolve();     // プレゼント対象のアイテムなし
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
    task.GetTownList = function () {
        console.log("[[TaskStart]]GetTownList");
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
            }
        });

        return defer.promise();
    };

    var getTownData = function (townId) {
        console.log("[Enter]getTownData");
        var defer = $.Deferred().resolve(townId);

        defer = defer.then(function (townId) {
            var d = $.Deferred();
            $.ajax({
                url: "town.php?town=" + townId,
                type: "GET",
                //cache: false,
                //dataType: "json",
                success: function (res) {
                    d.resolve(townId);
                },
                error: function () {
                    log("都市データの取得(town.php)に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function (townId) {
            var d = $.Deferred();
            $.ajax({
                url: "flash_trans_xml_.php?town=" + townId,
                type: "POST",
                cache: false,
                //dataType: "json",
                data: ({
                    op: "AREA"
                }),
                success: function (res) {
                    d.resolve(townId);
                },
                error: function () {
                    log("都市データの取得(AREA)に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function (townId) {
            var d = $.Deferred();
            $.ajax({
                url: "flash_trans_xml_.php?town=" + townId,
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
                        d.reject();
                    } else {
                        d.resolve(json_data);
                    }
                },
                error: function () {
                    log("都市データの取得(READ)に失敗");
                    d.reject();
                }
            });
            return d.promise();
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
                            log("☆" + rarity + res[1].merc.name + "(" + res[1].merc.behavior.name + ")を召喚");

                            if (recruitConfig.isSpBhv && res[1].merc.behavior.sp && parseInt(res[1].merc.behavior.sp, 10) === 1) {
                                recruitConfig.maxnum--;
                                defer2.resolve(false, null);
                            } else if (recruitConfig.isStriker && res[1].merc.name.indexOf("オムニ") < 0) {
                                recruitConfig.maxnum--;
                                defer2.resolve(false, null);
                            } else if (recruitConfig.isGoldBhv && COMMON.GOLDBHV.indexOf(res[1].merc.behavior.name) >= 0) {
                                recruitConfig.maxnum--;
                                defer2.resolve(false, null);
                            } else if (rarity >= recruitConfig.rarity) {
                                recruitConfig.maxnum--;
                                defer2.resolve(false, null);
                            } else {
                                defer2.resolve(true, charaid);
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

    /* 指定したギルドメンバーの都市を取得・移動し、協防可能か判定 */
    task.GetMemberTown = function (playerName) {
        console.log("[Enter]getMemberTown");
        var defer = $.Deferred().resolve();
        var townsData = {};

        var townId = null;

        log(playerName + " の都市を防衛");
        defer = defer.then(function () {
            var d = $.Deferred();
            $.ajax({
                url: "flash_trans_xml_.php",
                type: "POST",
                cache: false,
                dataType: "json",
                data: ({
                    op: "member_town"
                }),
                success: function (res) {
                    if (res.length !== 0) {
                        $.each(res, function (id, member) {
                            if (member.name === playerName) {
                                townId = member.id;
                                d.resolve(townId);
                                return false;
                            }
                        });
                        if (!townId) {
                            log("指定されたプレイヤーはギルド内にいません");
                            d.reject();
                        }
                    } else {
                        log("ギルドメンバーの都市リスト取得に失敗");
                        d.reject();
                    }
                },
                error: function () {
                    log("ギルドメンバーの都市リスト取得に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(getTownData)

            .then(function (townData) {
                var d = $.Deferred();
                console.log(townData[7]);
                if (townData[7][5]) {
                    log("自分が協防済み");
                    d.reject();
                } else if (townData[7][1] === 0) {
                    log("他人が協防済み");
                    d.reject();
                } else if (townData[7][2] === 0) {
                    log("自分の協防可能回数0");
                    d.reject();
                } else {
                    d.resolve(townData);
                }
                return d.promise();
            });

        return defer.promise();
    };

    var checkBuildingType = function (building, type) {
        if (building === null || type === null) {
            return false;
        }
        var bldg = parseInt(building, 10);
        var t = parseInt(type, 10);
        if (bldg >= t && bldg < t + 99) {
            return true;
        } else {
            return false;
        }
    };

    /**
     * 指定された建物で一番高いLVのものが建っている都市を取得する
     * @param   {number}   buildingType 建物のタイプ
     * @returns {string} townid 一番高いLVの建物が建っている都市のID(numberの文字列)
     */
    task.GetHighestBuilding = function (buildingType) {
        console.log("[[TaskStart]]GetTownTransducer");
        var defer = $.Deferred();

        var townIdList, townName, townid, lv = 0;
        task.GetTownList()
            .then(function (res) {
                townIdList = res;

            }).then(function () {
                var d = $.Deferred().resolve();
                $.each(townIdList, function (i, town) {
                    d = d.then(function () {
                        return $.Deferred().resolve(town.id).promise();

                    }).then(getTownData)

                        .then(function (townData) {
                            $.each(townData[1], function () {
                                if (checkBuildingType(this.building, buildingType)) {
                                    if (lv < parseInt(this.lv, 10)) {
                                        lv = parseInt(this.lv, 10);
                                        townName = town.name;
                                        townid = town.id;
                                    }
                                }
                            });
                        });
                });
                return d.promise();

            }).then(function () {
                if (lv > 0) {
                    console.log(townName + "の" + COMMON.BUILDING[buildingType].name + "(Lv" + lv + ")");
                    defer.resolve(townid);
                } else {
                    console.log(COMMON.BUILDING[buildingType].name + "は建造されていない");
                    defer.resolve();
                }
            });

        return defer.promise();
    };

    /* 指定された建物が建造済みか確認 */
    task.CheckBuilding = function (townLvupDataList) {
        console.log("[Enter]CheckBuilding");
        var defer = $.Deferred().resolve();

        var buildings;
        var townId;

        $.each(townLvupDataList, function (index, townLvupData) {
            defer = defer.then(function () {
                var d = $.Deferred();
                townId = townLvupData.townId;
                buildings = townLvupData.buildings;
                return d.resolve(townId).promise();

            }).then(getTownData)

                .then(function (townData) {
                    var d = $.Deferred();
                    var now = new Date();
                    var i, j;
                    for (i = 0; i < buildings.length; i++) {
                        for (j = 0; j < townData[1].length; j++) {
                            if (buildings[i].building === null) {
                                buildings[i].status = "";
                                break;
                            }
                            if (checkBuildingType(townData[1][j].building, buildings[i].building)) {
                                buildings[i].targetTime = now;
                                var s = COMMON.DATESTR(buildings[i].targetTime);
                                buildings[i].status = "開始予定 " + s.slice(s.indexOf("/") + 1, s.indexOf("."));
                                townData[1].splice(j, 1);
                                j--;
                                break;
                            }
                            if (j === townData[1].length - 1) {
                                buildings[i].building = null;
                                buildings[i].status = "建造されていません";
                            }
                        }
                    }
                    console.log(townLvupData);
                    return d.resolve().promise();
                });
        });

        return defer.promise();
    };

    /* 指定した都市の建物をLVUP */
    task.LvupBuilding = function (townLvupData) {
        console.log("[Enter]LvupBuilding");
        var defer = $.Deferred();

        var townData;
        var buildings = townLvupData.buildings;
        var target = null;

        var now = new Date();
        // 指定されたリストからLVUP対象の建物を取得
        var i;
        for (i = 0; i < buildings.length; i++) {
            if (buildings[i].targetTime < now && buildings[i].building !== null) {
                target = i;
                //buildings[target].index = null;
                break;
            }
        }
        if (target === null) {
            log("あれーすることがないよー");
            return defer.resolve().promise();
        }

        defer.resolve(townLvupData.townId);
        defer = defer.then(getTownData)

            .then(function (res_townData) {
                townData = res_townData;

            }).then(function () {
                var d = $.Deferred();
                var tBldg = parseInt(buildings[target].building, 10);
                var latestTime = null;
                var isAbuilding = false;
                var i, j;

                // 都市データのLVUP中リストから最初にLVUPが終了する時刻を取得
                for (i = 0; i < townData[2].length; i++) {
                    if (latestTime === null || latestTime > townData[2][i].remainTime) {
                        latestTime = townData[2][i].remainTime;
                    }

                    if (checkBuildingType(townData[2][i].id, tBldg)) {
                        isAbuilding = true;
                    }
                    /*    for (j = 0; j < buildings.length; j++) {
                            if (buildings[j].index === townData[2][i].index) {
                                break;
                            }
                            if (j === buildings.length - 1) {
                                buildings[target].index = townData[2][i].index;
                                now.setSeconds(now.getSeconds() + parseInt(townData[2][i].remainTime, 10) + 120);
                                buildings[target].targetTime = now;
                                buildings[target].status = "開始予定 " + buildings[target].targetTime.toLocaleTimeString();
                                return d.resolve(buildings).promise();
                            }
                        }
                    }*/
                }

                // 建築上限のためLVUP不可
//                if (townData[2].length === 3) {
//                    //buildings[target].index = null;
//                    now.setSeconds(now.getSeconds() + parseInt(latestTime, 10) + 120);
//                    buildings[target].targetTime = now;
//                    var s = COMMON.DATESTR(buildings[target].targetTime);
//                    buildings[target].status = "開始予定 " + s.slice(s.indexOf("/") + 1, s.indexOf("."));
//                    log("他の建物のLVUP終了待ち");
//                    return d.resolve().promise();
//                }

                // 都市データの全建物リストからLVUP中の建物を削除
                for (i = 0; i < townData[1].length; i++) {
                    for (j = 0; j < townData[2].length; j++) {
                        if (townData[1][i].index === townData[2][j].index) {
                            townData[1].splice(i, 1);
                            i--;
                            break;
                        }
                    }
                }

                // 指定された建物のうち、都市データから一番LVが高い/低い建物を取得
                var largestBldg = null;
                for (i = 0; i < townData[1].length; i++) {
                    var lv = parseInt(townData[1][i].lv, 10);
                    if (checkBuildingType(townData[1][i].building, tBldg) &&
                            lv < COMMON.BUILDING[tBldg].maxlv) {
                        if (townLvupData.isLowest) {
                            if (largestBldg === null || lv < parseInt(largestBldg.lv, 10)) {
                                largestBldg = townData[1][i];
                            }
                        } else {
                            if (largestBldg === null || lv > parseInt(largestBldg.lv, 10)) {
                                largestBldg = townData[1][i];
                            }
                        }
                    }
                }

                if (largestBldg === null) {
                    if (isAbuilding) {
                        now.setSeconds(now.getSeconds() + parseInt(latestTime, 10) + 120);
                        buildings[target].targetTime = now;
                        var t = COMMON.DATESTR(buildings[target].targetTime);
                        buildings[target].status = "開始予定 " + t.slice(t.indexOf("/") + 1, t.indexOf("."));
                        log(COMMON.BUILDING[tBldg - tBldg % 100 + 1].name + " はLVUP中 : " + buildings[target].building);
                        return d.resolve().promise();
                    } else {
                        log(COMMON.BUILDING[tBldg - tBldg % 100 + 1].name + " は全てLV上限 : " + buildings[target].building);
                        buildings[target].building = null;
                        buildings[target].status = "全てLVUP上限";
                        buildings[target].targetTime = null;
                        return d.resolve().promise();
                    }
                } else {
                    largestBldg.townId = townData[0];
                    var param = {
                        largestBldg: largestBldg,
                        latestTime: latestTime
                    };
                    return d.resolve(param).promise();
                }

            }).then(function (param) {
                if (param === undefined || param.largestBldg === undefined) {
                    return;
                }
                var d = $.Deferred();
                $.ajax({
                    url: "flash_trans_xml_.php?town=" + param.largestBldg.townId,
                    type: "POST",
                    cache: false,
                    //dataType: "json",
                    data: ({
                        op: "UPGRADE",
                        index: param.largestBldg.index,
                        building: param.largestBldg.building,
                        lv: param.largestBldg.lv
                    }),
                    success: function (res) {
                        var now = new Date();
                        var s;
                        var cq = res.replace("showCQ=", "").replace("&op=UPGRADE", "");
                        // 建築上限のためLVUP不可(showCQ=x: xは建築上限数(エラー時)と想定(0: 成功, 1: 資源不足?))
                        if (Number(cq) > 1) {
                            now.setSeconds(now.getSeconds() + parseInt(param.latestTime, 10) + 120);
                            buildings[target].targetTime = now;
                            s = COMMON.DATESTR(buildings[target].targetTime);
                            buildings[target].status = "開始予定 " + s.slice(s.indexOf("/") + 1, s.indexOf("."));
                            log("他の建物のLVUP終了待ち");
                            return d.resolve();

                        // 資源不足のためLVUP不可
                        } else if (Number(cq) === 1) {
                            if (param.latestTime === null) {
                                now.setHours(now.getHours() + 1);   // 建設中の建物がない場合は1時間後にリトライ
                            } else {
                                now.setSeconds(now.getSeconds() + parseInt(param.latestTime, 10) + 120);
                            }
                            buildings[target].targetTime = now;
                            s = COMMON.DATESTR(buildings[target].targetTime);
                            buildings[target].status = "開始予定 " + s.slice(s.indexOf("/") + 1, s.indexOf("."));
                            log("資源不足");
                            return d.resolve();

                        } else if (Number(cq) === 0) {
                            d.resolve(param.largestBldg);

                        } else {
                            log("都市LVUP UPGRADEにエラー応答[" + res + "]");
                            d.reject();
                        }
                    },
                    error: function () {
                        log("都市LVUP情報送信に失敗");
                        d.reject();
                    }
                });
                return d.promise();

            }).then(function (largestBldg) {
                if (largestBldg === undefined) {
                    return;
                }
                var d = $.Deferred();
                $.ajax({
                    url: "flash_trans_xml_.php?town=" + largestBldg.townId,
                    type: "POST",
                    cache: false,
                    //dataType: "json",
                    data: ({
                        op: "CQ"
                    }),
                    success: function (res) {
                        var json_data = null;
                        try {
                            json_data = $.parseJSON(res.slice(res.indexOf("["), res.indexOf("&op")));
                        } catch (e) {}
                        if (json_data === null) {
                            log("建物LVUPデータパース失敗");
                            d.reject();
                        } else {
                            var i;
                            for (i = 0; i < json_data[0].length; i++) {
                                if (json_data[0][i].index === largestBldg.index) {
                                    var now = new Date();
                                    now.setSeconds(now.getSeconds() + parseInt(json_data[0][i].remainTime, 10) + 120);
                                    log(COMMON.BUILDING[largestBldg.building - largestBldg.building % 100 + 1].name + "(Lv" + largestBldg.lv + ")は " +
                                        COMMON.DATESTR(now) + " にLVUP完了します");
                                    //buildings[target].index = json_data[0][i].index;
                                    buildings[target].targetTime = now;
                                    var s = COMMON.DATESTR(buildings[target].targetTime);
                                    buildings[target].status = "(Lv" + largestBldg.lv + ") LVUP完了 " + s.slice(s.indexOf("/") + 1, s.indexOf("."));
                                    d.resolve(buildings);
                                    return;
                                }
                            }
                            log("建物LVUPに失敗");
                            d.reject();
                        }
                    },
                    error: function () {
                        log("都市LVUP情報取得に失敗");
                        d.reject();
                    }
                });
                return d.promise();
            });

        return defer.promise();
    };

    var loadBagData = function () {
        console.log("[Enter]loadBagData");
        var defer = $.Deferred();

        $.ajax({
            url: "item_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "merc_equip",
                append: 0,      // ソート（表示アイテム切り替え）
                nTag: 0         // 通常/特殊倉庫切り替え
            }),
            success: function (res) {
                if (res.num && res.show_num && res.num === res.show_num) {
                    defer.resolve(res);
                } else {
                    log("インベントリ情報エラー");
                    console.log(res);
                    defer.reject();
                }
            },
            error: function () {
                log("インベントリ情報取得売却に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    var getItemDatafromBag = function (bagData, item) {
        var list = [];
        var i;
        for (i = 0; bagData[i]; i++) {
            if (bagData[i].name === item) {
                list.push(i);
            }
        }
        return list;
    };

    /**
     * 指定されたアイテムを売る、ロック中・装備中のアイテムは売らない
     * (同じ名前のアイテムが複数個倉庫にある場合は全て売る)
     * @param   {Object} bagData 倉庫内のアイテムリスト
     * @param   {Object} item    売るアイテム
     */
    var sellItem = function (bagData, item) {
        console.log("[Enter]sellItem");
        var defer = $.Deferred();

        var sellItemInner = function (bagData, item) {
            //console.log(bagData);

            var i = 0, itemData = null;
            while (bagData[i]) {
                if (bagData[i].name === item && parseInt(bagData[i].pack, 10) > 0 &&
                        bagData[i].ilock === "0" && bagData[i].merc === undefined) {
                    itemData = bagData[i];
                    break;
                }
                i++;
            }

            if (itemData) {
                var sellNum = parseInt(itemData.pack, 10) > 10 ? 10 : itemData.pack;

                $.ajax({
                    url: "item_.php",
                    type: "POST",
                    cache: false,
                    dataType: "json",
                    data: ({
                        op: "item_sell",
                        item: itemData.id,
                        num: sellNum
                    }),
                    success: function (res) {
                        if (res.result === "success") {
                            log(itemData.name + "x" + sellNum + "を売却");
                            bagData[i].pack = res.num;

                            // 指定されたアイテムが倉庫からなくなるまで繰り返す
                            // bagDataは個数以外更新されない(reponseが残り個数の情報のみなので)
                            sellItemInner(bagData, item);
                        } else {
                            console.log(itemData.name + "売却に失敗[" + res + "]");
                            defer.resolve();
                        }
                    },
                    error: function () {
                        log(itemData.name + "売却情報送信に失敗");
                        defer.reject();
                    }
                });
            } else {
                defer.resolve(bagData);
            }
        };

        sellItemInner(bagData, item);
        return defer.promise();
    };

    /**
     * 指定されたアイテムを倉庫からオルタへ移動する、ロックされているアイテムも移動するが装備中のアイテムは移動しない
     * (同じ名前のアイテムが複数個倉庫にある場合は全て移動する)
     * @param   {Object} bagData 倉庫内のアイテムリスト
     * @param   {Object} item    オルタへ移動させるアイテム
     */
    var moveItem = function (bagData, item) {
        console.log("[Enter]moveItem");
        var defer = $.Deferred();

        var moveItemInner = function (bagData, item) {

            var i = 0, itemData = null;
            while (bagData[i]) {
                if (bagData[i].name === item && parseInt(bagData[i].pack, 10) > 0 && bagData[i].merc === undefined) {
                    itemData = bagData[i];
                    break;
                }
                i++;
            }

            if (itemData) {
                $.ajax({
                    url: "item_.php",
                    type: "POST",
                    cache: false,
                    dataType: "json",
                    data: ({
                        op: "storage_exchange",
                        id: itemData.id,
                        sappend: 0,
                        tostore: 1
                    }),
                    success: function (res) {
                        if (!res.result) {
                            console.log(itemData.name + "移動に失敗");
                            defer.reject();     // 予期しないエラーなので、アイテム整理を中断する
                        } else if (res.result === "success") {
                            log(itemData.name + "を移動");
                            bagData = res.pack;
                            // 指定されたアイテムが倉庫からなくなるまで繰り返す
                            moveItemInner(bagData, item);
                        } else {
                            console.log(itemData.name + "移動に失敗[" + res.result + "]");
                            defer.resolve(bagData);     // 倉庫がいっぱいな場合は移動を終了するが、アイテム整理は中断しない
                        }
                    },
                    error: function () {
                        log(itemData.name + "移動情報送信に失敗");
                        defer.reject();
                    }
                });
            } else {
                defer.resolve(bagData);
            }
        };

        moveItemInner(bagData, item);
        return defer.promise();
    };

    /**
     * 指定されたアイテムを開封する、ロック中・装備中のアイテムは開封しない
     * (同じ名前のアイテムが複数個倉庫にある場合は全て開封する)
     * @param   {Object} bagData 倉庫内のアイテムリスト
     * @param   {Object} item    開封するアイテム
     */
    var useItem = function (bagData, item) {
        console.log("[Enter]useItem");
        var defer = $.Deferred();
        var used = false;   // アイテム整理ルーチンを初めからやり直すかどうかのフラグ（資源以外のアイテムを開封したらtrueにする）

        var useItemInner = function (bagData, item) {

            var i = 0, itemData = null;
            while (bagData[i]) {
                if (bagData[i].name === item && parseInt(bagData[i].pack, 10) > 0 &&
                        bagData[i].ilock === "0" && bagData[i].merc === undefined) {
                    itemData = bagData[i];
                    break;
                }
                i++;
            }

            if (itemData) {
                var data = {};
                var openNum = 0;
                var type = parseInt(itemData.type, 10);
                if ((type === COMMON.ITEMTYPE.BOX || type === COMMON.ITEMTYPE.LUCKY_BAG || type === COMMON.ITEMTYPE.RES)
                        && parseInt(itemData.pack, 10) > 1) {
                    openNum = parseInt(itemData.pack, 10) > 10 ? 10 : itemData.pack;
                    data = {
                        op: "multi_open",
                        cItem: itemData.id,
                        append: 0,      // ソート（表示アイテム切り替え）
                        inum: openNum,
                        nTag: 0         // 通常/特殊倉庫切り替え
                    };
                } else {
                    openNum = 1;
                    data = {
                        op: "item_open",
                        cItem: itemData.id,
                        item: itemData.item,
                        append: 0,      // ソート（表示アイテム切り替え）
                        sel_co: 0,      // _ITEM_TYPE_SP_BOX用?
                        nTag: 0         // 通常/特殊倉庫切り替え
                    };
                }

                $.ajax({
                    url: "item_.php",
                    type: "POST",
                    cache: false,
                    dataType: "json",
                    data: data,
                    success: function (res) {
                        if (res[0] === -1) {
                            console.log(itemData.name + "開封に失敗[full]");     // 倉庫がいっぱいな場合は移動を終了するが、アイテム整理は中断しない
                            defer.resolve(bagData, used);
                        } else if (res.item) {
                            // 開封したアイテムが資源系なら、続けて次のアイテムを開封するのでused = falseのままにする
                            if (res[0] !== COMMON.ITEMTYPE.RES) {
                                used = true;    // アイテム整理ルーチンを初めからやり直す
                            }
                            log(itemData.name + "x" + openNum + "を開封");
                            bagData = res.item;
                            // 指定されたアイテムが倉庫からなくなるまで繰り返す
                            useItemInner(bagData, item);
                        } else {
                            console.log(itemData.name + "開封に失敗[" + res + "]");
                            defer.reject();     // 予期しないエラーなので、アイテム整理を中断する
                        }
                    },
                    error: function () {
                        log(itemData.name + "開封情報送信に失敗");
                        defer.reject();
                    }
                });
            } else {
                defer.resolve(bagData, used);
            }
        };

        useItemInner(bagData, item);
        return defer.promise();
    };

    var getAlchemyBagData = function () {
        console.log("[Enter]getAlchemyBagData");
        var defer = $.Deferred();

        $.ajax({
            url: "mdmerc_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: {
                op: "alchemy_data"
            },
            success: function (res) {
                if (res.item) {
                    defer.resolve(res.item);
                } else {
                    log("練成アイテム情報取得に失敗");
                    defer.resolve();    // アイテム整理ルーチンは止めない
                }
            },
            error: function () {
                log("練成アイテム情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /**
     * 指定されたアイテムを練成する(同じアイテムのみ)
     * @param   {Object} bagData 倉庫内のアイテムリスト
     * @param   {Object} item    開封するアイテム
     */
    var alchemyItem = function (maid, item) {
        console.log("[Enter]alchemyItem");
        var defer = $.Deferred();

        var itemList = [];
        var itype = 0;
        if (item.num === 5) {
            itype = 2;  // エトワール
        } else if (item.num === 3) {
            itype = 1;  // トライアングル
        } else {
            itype = 0;  // ライン
        }

        var alchemyItemInner = function (bagData, item) {
            var defer2 = $.Deferred().resolve();
            defer2 = defer2.then(function () {
                var d = $.Deferred();

                var itemIndexList = [], i;
                for (i = 0; bagData[i]; i++) {
                    if (bagData[i].name === item.name) {
                        itemIndexList.push(bagData[i]);
                    }
                }

                if (itemIndexList.length >= 1 &&
                        (itemIndexList.length >= item.num || itemIndexList[0].pack >= item.num)) {
                    itemList = [];
                    for (i = 0; i < item.num; i++) {
                        if (itemIndexList[0].pack >= item.num) {
                            itemList.push(itemIndexList[0].id);
                        } else {
                            itemList.push(itemIndexList[i].id);
                        }
                    }

                    $.ajax({
                        url: "mdmerc_.php",
                        type: "POST",
                        cache: false,
                        dataType: "json",
                        data: {
                            op: "alchemy_test",
                            mid: maid,
                            item: itemList,
                            itype: itype
                        },
                        success: function (res) {
                            if (res.result && res.result === 1) {
                                d.resolve(itemList);
                            } else {
                                console.log(item.name + "の練成に失敗[alchemy_test]");
                                defer.resolve();    // アイテム整理ルーチンは止めない
                            }
                        },
                        error: function () {
                            log(item.name + "練成情報送信に失敗");
                            defer.reject();
                        }
                    });
                } else {
                    // 練成アイテムなしまたは不足
                    defer.resolve();
                }
                return d.promise();

            }).then(function (itemList) {
                if (!itemList) {
                    defer.resolve();
                    return;
                }
                var d = $.Deferred();

                $.ajax({
                    url: "mdmerc_.php",
                    type: "POST",
                    cache: false,
                    dataType: "json",
                    data: {
                        op: "alchemy_change",
                        mid: maid,
                        item: itemList,
                        itype: itype,
                        eset: 0,    // バルスタを使用するか
                        eit: 0      // バルスタ使用時のベース材料ID?
                    },
                    success: function (res) {
                        if (res.result && res.result === 1) {
                            log(item.name + "x" + item.num + "から" + res.get + "を練成");
                            bagData = res.item;
                            alchemyItemInner(bagData, item);
                        } else {
                            console.log(item.name + "の練成に失敗[alchemy_change]");
                            defer.resolve();    // アイテム整理ルーチンは止めない
                        }
                    },
                    error: function () {
                        log(item.name + "練成情報送信に失敗");
                        defer.reject();
                    }
                });
                return d.promise();
            });

            return defer2.promise();
        };

        getAlchemyBagData()
            .then(function (alchembagData) {
                if (alchembagData) {
                    return alchemyItemInner(alchembagData, item);
                } else {
                    defer.resolve();
                }
            });

        return defer.promise();
    };

    var getMaidId = function (maidName) {
        console.log("[Enter]getMaidId");
        var defer = $.Deferred();

        $.ajax({
            url: "dialog_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: {
                op: "md_page"
            },
            success: function (res) {
                if (res.md_merc) {
                    var i;
                    for (i = 0; i < res.md_merc.length; i++) {
                        if (res.md_merc[i].name === maidName) {
                            defer.resolve(res.md_merc[i].id);
                            return;
                        }
                    }
                    log(maidName + "が存在しません");
                    defer.resolve();    // アイテム整理ルーチンは止めない
                } else {
                    log("メイド情報取得に失敗");
                    defer.resolve();    // アイテム整理ルーチンは止めない
                }
            },
            error: function () {
                log("メイド情報取得に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

    /**
     * 指定された都市で寄付をする
     * (寄付の結果はチェックしない。気が向いたら追加する)
     * @param   {string} townId     最もレベルが高い教会がある都市のID
     * @param   {Object}   itemConfig 寄付する魔晶石の数(itemConfig.contribute)
     */
    var contributeStone = function (townId, itemConfig) {
        console.log("[Enter]contributeStone");
        if (!townId || !itemConfig.contribute.enable) {
            return;
        }

        var defer = $.Deferred().resolve(townId);

        defer = defer.then(function (townId) {
            var d = $.Deferred();
            $.ajax({
                url: "town.php?town=" + townId,
                type: "GET",
                //cache: false,
                //dataType: "json",
                success: function (res) {
                    d.resolve(townId);
                },
                error: function () {
                    log("都市データの取得(town.php)に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function (townId) {
            var d = $.Deferred();
            $.ajax({
                url: "flash_trans_xml_.php?town=" + townId,
                type: "POST",
                cache: false,
                //dataType: "json",
                data: ({
                    op: "AREA"
                }),
                success: function (res) {
                    d.resolve(townId);
                },
                error: function () {
                    log("都市データの取得(AREA)に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function (townId) {
            var d = $.Deferred();
            $.ajax({
                url: "flash_trans_xml_.php?town=" + townId,
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
                        d.reject();
                    } else {
                        d.resolve(json_data);
                    }
                },
                error: function () {
                    log("都市データの取得(READ)に失敗");
                    d.reject();
                }
            });
            return d.promise();

        }).then(function () {
            var d = $.Deferred();
            $.ajax({
                url: "flash_trans_xml_.php?town=" + townId,
                type: "POST",
                cache: false,
                //dataType: "json",
                data: ({
                    mall: 0,
                    op: "CONTRIBUTE",
                    num: itemConfig.contribute.stone
                }),
                success: function (res) {
                    var json_data = null;
                    try {
                        json_data = $.parseJSON(res.slice(res.indexOf("[")));
                        if (json_data === null) {
                            log("寄付データパース失敗");
                        } else if (json_data[0].result === 1) {
                            log("寄付 " + json_data[0].msg);
                        } else {
                            log("寄付失敗");
                        }
                    } catch (e) {}
                    d.resolve();
                },
                error: function () {
                    log("寄付情報送信に失敗");
                    d.reject();
                }
            });
            return d.promise();
        });

        return defer.promise();
    };

    task.CleanBag = function () {
        console.log("[[TaskStart]]CleanBag");
        if (!config.item.enable) {
            return $.Deferred().resolve().promise();
        }
        var defer = $.Deferred();
        var bagData;
        var itemConfig = config.item;

// 1. アイテムを練成する
// 2. 売るリストのアイテムを全部売る
// 3. オルタ移動リストのアイテムを全部移動する（ロック無視）、移動ごとに応答からデータを取得
// 4. 使うリストのアイテムを1種類使う、更新されたBagDataを応答から取得、資源以外のアイテムを獲得したら1.へ
// 5. 資源、倉庫の空きがあれば寄付(スタック可だが、倉庫に空きがなければもらえないはず)

        var sell, move, use, alchemy, contrib;

        var maid;
        alchemy = function (itemConfig) {
            if (!itemConfig.maid || itemConfig.maid === "" ||
                    !itemConfig.alchemy || itemConfig.alchemy.length === 0) {
                return sell(itemConfig);
            }
            var d = $.Deferred().resolve(itemConfig.maid);
            d = d.then(getMaidId)
                .then(function (res) {
                    maid = res;
                });
            $.each(itemConfig.alchemy, function (index, item) {
                d = d.then(function () {
                    return alchemyItem(maid, item);
                });
            });
            d = d.then(function () {
                console.log("アイテム練成完了");
                return sell(itemConfig);
            });
            return d.promise();
        };

        sell = function (itemConfig) {
            var d = $.Deferred().resolve();
            d = d.then(loadBagData)
                .then(function (res) {
                    bagData = res;
                });
            $.each(itemConfig.sell, function (index, item) {
                d = d.then(function () {
                    return sellItem(bagData, item);
                });
            });
            d = d.then(function () {
                console.log("アイテム売却完了");
                return move(itemConfig);
            });
            return d.promise();
        };

        move = function (itemConfig) {
            var d = $.Deferred().resolve();
            d = d.then(loadBagData)
                .then(function (res) {
                    bagData = res;
                });
            $.each(itemConfig.move, function (index, item) {
                d = d.then(function () {
                    return moveItem(bagData, item);
                });
            });
            d = d.then(function () {
                console.log("アイテム移動完了");
                return use(bagData, itemConfig, 0);
            });
            return d.promise();
        };

        use = function (bagData, itemConfig, index) {
            var d = $.Deferred().resolve();
            if (index < itemConfig.use.length) {
                useItem(bagData, itemConfig.use[index])
                    .then(function (bagData, used) {
                        if (used) {
                            return alchemy(itemConfig);
                        // 開けたアイテムが資源だった場合、あるいは対象アイテムが存在しなかった場合、続けて次のアイテムを開封する
                        } else {
                            return use(bagData, itemConfig, index + 1);
                        }
                    });
            } else {
                console.log("アイテム開封完了");
                return contrib(itemConfig);
            }
            return d.promise();
        };

        contrib = function (itemConfig) {
            if (!itemConfig.contribute.enable) {
                defer.resolve();
                return;
            }

            var d = $.Deferred();
            loadBagData()
                .then(function (res) {
                    if (res.max > res.total) {
                        return updateCQ()
                            .then(function (res) {
                                if (parseInt(res.current, 10) > parseInt(itemConfig.contribute.stone, 10)) {
                                    return task.GetHighestBuilding(1601);
                                }
                            }).then(function (townId) {
                                if (townId) {
                                    return contributeStone(townId, itemConfig);
                                }
                            });
                    }
                }).then(function () {
                    d.resolve();
                    defer.resolve();
                    console.log("アイテム整理完了");
                });
            return d.promise();
        };

        alchemy(itemConfig);

        return defer.promise();
    };

}());

$(function () {
    'use strict';

    var timer;
    log("Start script");

    cmdManager.pollTask();

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
