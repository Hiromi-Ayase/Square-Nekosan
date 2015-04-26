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

COMMON.STATUSLIST = [
    "HP", "ATK", "DEF", "DEX", "FLEE", "LUK"
];

COMMON.BUILDING = {
    "": {
        name: "",
        maxlv: 0
    },
    1: {
        name: "遺跡管理局",
        maxlv: 30
    },
    101: {
        name: "魔晶採掘場",
        maxlv: 30
    },
    201: {
        name: "魔晶精製所",
        maxlv: 30
    },
    301: {
        name: "魔晶集積所",
        maxlv: 30
    },
    401: {
        name: "特殊練成器",
        maxlv: 20
    },
    501: {
        name: "交易所",
        maxlv: 20
    },
    601: {
        name: "創星館",
        maxlv: 30
    },
    701: {
        name: "傷癒施設",
        maxlv: 20
    },
    801: {
        name: "遺跡研究所",
        maxlv: 30
    },
    901: {
        name: "戦技学園",
        maxlv: 30
    },
    1001: {
        name: "防衛学園",
        maxlv: 30
    },
    1101: {
        name: "魔導協会",
        maxlv: 30
    },
    1201: {
        name: "魔導科学院",
        maxlv: 30
    },
    1301: {
        name: "列焔実験棟",
        maxlv: 30
    },
    1401: {
        name: "疾風実験棟",
        maxlv: 30
    },
    1501: {
        name: "湧泉実験棟",
        maxlv: 30
    },
    1601: {
        name: "聖堂教会",
        maxlv: 30
    },
    1701: {
        name: "街路樹",
        maxlv: 15
    },
    1801: {
        name: "星晶苑",
        maxlv: 30
    }
};

COMMON.GOLDBHV = [
    "高値", "金銭", "泡銭", "貪欲", "経済", "愛財",
    "優待", "軌跡", "重宝",
    "美夢", "泳練", "典雅", "猫娘", "店長", "艶麗", "追跡", "商人"
];

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
