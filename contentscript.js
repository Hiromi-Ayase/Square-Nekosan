/*jslint vars: true, plusplus: true*/
/*global $, chrome, console, log, COMMON, cmdManager*/

/*
    jQuery JavaScript Library v1.9.1 で動作確認
    v1.7はだめー
*/

// ログインプレゼント
// POST updateinfo_.php op:"login_reward"
// Response {
// msg: "獲得アイテム：リーチェボックス X3"
// next: "7★魂珠の欠片"
// result: 1
// time: "1:30:00"
// }

/* --- 戦闘用変数 --- */
var g_mapid = 0;
var g_blockid = 0;
var g_blockidList = [];

/* --- キャラのレベルアップ --- */
var IS_AUTO_LVUP = 0; // 自動でLVUPするか
var g_isLvup = 0;
var g_lvupCharaId = 0;
var g_lvupCharaList = [];

/* --- サドンボス --- */
var IS_CHECK_SUDDEN = 1; // 戦闘終了時にサドンボスをチェックするか
var g_isBattleSudden = 0; // 戦闘終了後にサドンボスが出たか
var g_suddenList = [];  // {id : this.id, mine : 1}    mine=1なら自分が遭遇者


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
    var battleGetMaxParty = function (param) {
        console.log("[Enter]battleGetMaxParty");
        var defer = $.Deferred();

        $.ajax({
            url: "remain_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "get_monster_data",
                level: param.blockid,
                mload: 1
            }),
            success: function (res) {
                if (!res.max_party_num) {
                    log("最大攻略可能パーティ数取得に失敗");
                    defer.reject();
                } else {
                    var maxPartyNum = parseInt(res.max_party_num, 10);

                    log("---- " + res.stagename + "[" + param.blockid + "]");

                    console.log("最大攻略可能パーティ数 ：" + maxPartyNum);
                    defer.resolve(param.blockid, maxPartyNum); // goto battleGetParty
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
    var battleGetParty = function (blockid, maxPartyNum) {
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
                var partyData = [];
                var i = 0;
                for (i = 0; i < maxPartyNum; i++) {
                    partyData[i] = [];
                }

                console.log("パーティ情報：");
                for (i = 0; i < res.merc.length; i++) {
                    var chara = res.merc[i];
                    // パーティに所属していなければ party = 0
                    if (chara.state > 0 && chara.party !== "0") {
                        var partyNo = (chara.party.split("-")[0]) - 1;
                        var partyMemberNo = (chara.party.split("-")[1]) - 1;

                        if (partyNo < maxPartyNum) {
                            partyData[partyNo][partyMemberNo] = chara.id;
                            console.log("    " + chara.name + " [" + chara.party + "]");
                        }
                    }
                }

                if (partyData.length === 0) {
                    log("パーティ無し");
                    defer.reject();
                } else {
                    defer.resolve(blockid, partyData); // goto battlePrepare
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
    var battlePrepare = function (blockid, partyData) {
        console.log("[Enter]battlePrepare");
        var defer = $.Deferred();

        $.ajax({
            url: "flash_trans_xml_.php",
            type: "POST",
            cache: false,
            dataType: "json",
            data: ({
                op: "battle_prepare",
                party: partyData,
                target_level: blockid,
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
                            defer.resolve(blockid); // goto battleStart
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
    var battleStart = function (blockid) {
        console.log("[Enter]battleStart");
        var defer = $.Deferred();

        $.ajax({
            url: "flash_trans_xml_.php",
            type: "POST",
            cache: false,
            //dataType: "json",
            data: ({
                id: "#remain" + blockid,
                op: "BATTLE"
            }),
            success: function (res) {
                var result_txt = createBattleResult(res);
                if (result_txt.pteam_txt === "" || result_txt.eteam_txt === "") {
                    log("手動戦闘開始に失敗[戦闘結果データ生成に失敗]");
                    defer.reject(["power"]); // goto updateCQ
                } else {
                    defer.resolve(blockid, result_txt); // goto battleSendResult
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
    var battleSendResult = function (blockid, result_txt) {
        console.log("[Enter]battleSendResult");
        var defer = $.Deferred();

        if (result_txt.pteam_txt === "" || result_txt.eteam_txt === "") {
            return;
        }

        // ターン数、経過時間
        var turn = Math.floor(Math.random() * 7);
        var sec = Math.floor(Math.random() * 60);
        if (sec < 10) {
            sec = "0" + sec;
        }

        // 開放されてないマップIDを指定するとエラー(array=[{"result":"no_remain"}])
        $.ajax({
            url: "flash_trans_xml_.php",
            type: "POST",
            cache: false,
            //dataType: "json",
            data: ({
                op: "BATTLE_RESULT",
                eteam: result_txt.eteam_txt,
                remain: blockid + "/" + turn + "/00:00:" + sec,
                pteam: result_txt.pteam_txt
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

    /* 表示情報取得更新(func.js updateCQ()) */
    var updateCQ = function (val) {
        console.log("[Enter]updateCQ");
        var defer = $.Deferred();

        if (!val) {
            val = ["res", "char"];
        }

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

                defer.resolve();
            },
            error: defer.reject
        });

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

        if (!(g_isBattleSudden && IS_CHECK_SUDDEN)) {
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
                $.each(res.sudden_data, function () {
                    if (this.clear === 1) {
                        console.log(this.name + "(id=" + this.id + ") : 撃破済みです");
                    } else if (this.hp <= 0) {
                        console.log(this.name + "(id=" + this.id + ") : HPが0です");
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
                defer.resolve();   // goto suddenAllAttack
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

        log("---- sudden id = " + suddenData.id);

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
                    if (this.name === myname && this.damage !== "0") {
                        console.log("攻撃済み");
                        defer.resolve(); // 自分がすでに叩いていた
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
                defer.resolve();
            },
            error: function () {
                log("サドンボス攻撃に失敗");
                defer.reject();
            }
        });

        return defer.promise();
    };

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

        if (!(g_isBattleSudden && IS_CHECK_SUDDEN)) {
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
        log("[Enter]lvupAllPTChara");
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

    /*** 戦闘 ***/
    task.Battle = function (blockid) {
        console.log("[[TaskStart]]Battle");
        var defer = $.Deferred();

        var isBattleSuccess = 0;

        g_isLvup = 0;
        g_isBattleSudden = 0;

        battleGetMaxParty(blockid)
            .then(battleGetParty)
            .then(battlePrepare)
            .then(battleStart)
            .then(battleSendResult)
            .then(battleGetReport)
            .then(function () {
                isBattleSuccess = 1;
                updateCQ();
            }, function () {
                isBattleSuccess = 0;
                updateCQ();
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

    /* ログインボーナスを獲得 */
    task.getLoginBonus = function () {
        console.log("[Enter]getLoginBonus");
        var defer = $.Deferred();

        var $iframe = $('#main');
        var ifrmDoc = $iframe[0].contentWindow.document;
        var loginTime = $("#logintime", ifrmDoc).text();    // ログインボーナス獲得までの残り時間

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
                // 1:成功, 2:成功（その日のプレゼントは終わり）
                if (parseInt(res.result, 10) === 1 || parseInt(res.result, 10) === 2) {
                    log("ログインボーナス " + res.msg);
                    var isNext;
                    if (parseInt(res.result, 10) === 1) {
                        isNext = true;
                    } else {
                        isNext = false;
                    }
                    defer.resolve({
                        isNext: isNext,
                        time: res.time
                    });
                } else {
                    // -1:日付をまたいだ時に帰ってきた、例えばmercenary_.php,op:loadを送ってみて回避？
                    // -2:獲得可能時間前の場合
                    log("ログインボーナス獲得エラー(" + parseInt(res.result, 10) + ")");
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
    /*
        chrome.runtime.sendMessage({
            "op": "get",
            "key": "interval"
        }, function(response) {
            var interval = response.value;
            timer = setInterval(watch, interval * 1000);
        });
    */
});
