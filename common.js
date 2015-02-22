var COMMON = {};

COMMON.OP = {
    MAP: "map",
    DYSTOPIA: "dystopia",
    ALLDYSTOPIA: "allDystopia",
    LOGINBONUSSTATUS: "loginBonusStatus",
    GET: "get",
    SET: "set",
    LOG: "log",
    BLOCK: "block",
    SUSPEND: "suspend",
    END: "end"
};

COMMON.OPCTRL = {
    NEW: "new",
    PAUSE: "pause",
    RESUME: "resume",
    ABORT: "abort",
    END: "end"
};

COMMON.STORAGE = "storage";
COMMON.LOG = {
    MAX: 100,
    RELOAD: 100
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

COMMON.HELLWAIT = 5;    // minutes
