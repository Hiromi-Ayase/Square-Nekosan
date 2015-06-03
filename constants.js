var COMMON = {};

COMMON.OP = {
    MAP: "map",
    DYSTOPIA: "dystopia",
    ALLDYSTOPIA: "allDystopia",
    BLOCK: "block",
    TOWNBATTLE: "townBattle",
    TRANS: "trans",
    SUDDEN: "sudden",
    MAIDLVUP: "maidLvup",
    BATTLEDAMAGE: "battleDamage",
    GIFT: "gift",
    LVUP: "lvup",
    TOWNLVUP: "townLvup",
    RECRUIT: "recruit",
    ITEM: "item",
    CONTENTS_DATA: "contents_data",
    INIT: "init",
    TEST: "test",

    LOG: "log",
    GET_STORAGE_ARGS: "get_storage_args",
    GET_STORAGE_CONTENT: "get_storage_content",
    SET_STORAGE_ARGS: "set_storage_args",
    SET_STORAGE_CONTENT: "set_storage_content"
};

COMMON.CMD_STATUS = {
    RUN: "RUN",
    PAUSE: "PAUSE",
    END: "END",
    ON: "ON",
    OFF: "OFF",
    DISABLE: "disable"
};

COMMON.CMD_RESULT = {
    OK: "OK",
    NG: "NG"
};

COMMON.OP_CTRL = {
    RUN: "run",
    PAUSE: "pause",
    ABORT: "abort",
    ON: "on",
    OFF: "off",
    CHANGE: "change",
    FLAG: "flag"
};

COMMON.STORAGE = {
    ARGS: "args",
    CONTENT: "content"
};
COMMON.INTERVAL = {
    CONTENTS_DATA: 100,
    SETTING: 100
};
COMMON.LOG = {
    RELOAD: 100
};

COMMON.SUDDEN_ASSIST = {
    NEVER: -1,
    DEFAULT: 0,
    ALWAYS: 1
};

COMMON.STATUSLIST = [
    "HP", "ATK", "DEF", "DEX", "FLEE", "LUK"
];

COMMON.MAID = [
    "フリューネ",
    "キサナ",
    "アリシア",
    "リエル"
];

COMMON.BUILDING = {
    "": { name: "", maxlv: 0 },
    1: { name: "遺跡管理局", maxlv: 30 },
    101: { name: "魔晶採掘場", maxlv: 30 },
    201: { name: "魔晶精製所", maxlv: 30 },
    301: { name: "魔晶集積所", maxlv: 30 },
    401: { name: "特殊練成器", maxlv: 20 },
    501: { name: "交易所", maxlv: 20 },
    601: { name: "創星館", maxlv: 30 },
    701: { name: "傷癒施設", maxlv: 20 },
    801: { name: "遺跡研究所", maxlv: 30 },
    901: { name: "戦技学園", maxlv: 30 },
    1001: { name: "防衛学園", maxlv: 30 },
    1101: { name: "魔導協会", maxlv: 30 },
    1201: { name: "魔導科学院", maxlv: 30 },
    1301: { name: "列焔実験棟", maxlv: 30 },
    1401: { name: "疾風実験棟", maxlv: 30 },
    1501: { name: "湧泉実験棟", maxlv: 30 },
    1601: { name: "聖堂教会", maxlv: 30 },
    1701: { name: "街路樹", maxlv: 15 },
    1801: { name: "星晶苑", maxlv: 30 }
};

COMMON.GOLDBHV = [
    "高値", "金銭", "泡銭", "貪欲", "経済", "愛財",
    "優待", "軌跡", "重宝",
    "美夢", "泳練", "典雅", "猫娘", "店長", "艶麗", "追跡", "商人"
];

COMMON.ITEMTYPE = {
    ITEM_ALL : 0,		//標籤 全部
    ITEM_BADGE : 1,		//道具類型 徽章
    ITEM_STONE : 2,		//道具類型 原石
    ITEM_JADE : 3,		//道具類型 勾玉
    ITEM_SPECIAL : 4,	//道具類型 特殊
    BOX : 4,		//道具類型 寶箱
    PIECE : 5,	    //道具類型 碎片
    EVOLVE : 7,	    //道具類型 進化道具
    JEWEL_PIECE : 9,//道具類型 珠寶碎片
    RES : 10,	    //道具類型 資源
    MERCEGG : 11,	//道具類型 召喚蛋
    SPECIAL : 12,	//道具類型 特殊
    LUCKY_BAG : 13,	//道具類型 福袋
    RESET : 14,	    //道具類型 重置
    RARUP : 15,	    //道具類型 升階
    SPWEPON : 16,	//道具類型 專武
    SKL_LEARN : 17,	//道具類型 技能書
    CHWEPON : 20,	//道具類型 魔具
    MERCLV_RANK : 21,//道具類型 轉生
    SET_PIECE : 22,	//道具類型 配件		// 共鳴装備
    FREE_NUM : 23,	//道具類型 加值
    MGP : 24,	    //道具類型 好感度
    AHP : 25,       //道具類型 HP回復
    EVOLVE_2 : 27,	//道具類型 進化道具2
    RPOWER : 28,	//道具類型 召喚能量
    BEHAGET : 29,	//道具類型 特性獲得
    SP_BOX : 30,	//道具類型 特殊寶箱
    ALCHEMY : 31//道具類型 鍊金道具
};


COMMON.DATESTR = function (date) {
    'use strict';
    if (date === undefined) {
        date = new Date();
    }
    var y = date.getFullYear(),
        m = date.getMonth() + 1,
        d = date.getDate(),
        h = date.getHours(),
        n = date.getMinutes(),
        s = date.getSeconds(),
        l = date.getMilliseconds();
    if (m < 10) {
        m = '0' + m;
    }
    if (d < 10) {
        d = '0' + d;
    }
    if (h < 10) {
        h = '0' + h;
    }
    if (n < 10) {
        n = '0' + n;
    }
    if (s < 10) {
        s = '0' + s;
    }
    if (l < 10) {
        l = '00' + l;
    } else if (l < 100) {
        l = '0' + l;
    }

    return y + "/" + m + "/" + d + " " + h + ":" + n + ":" + s + "." + l;
};
