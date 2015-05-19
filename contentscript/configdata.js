/*global COMMON*/
var config = {};

config.trans = {
    enable: false,
    ratio: 0,
    threshold: 1
};

config.sudden = {
    enable: false,
    minhp: 1000000,
    assist: COMMON.SUDDEN_ASSIST.DEFAULT
};

config.battleDamage = {
    enable: false,
    minhp: 1
};

config.lvup = {
    enable: false,
    data: []    // data = [{ name, cond, type, point, condstr, status, judge }]
};
/*
config.townlvup = {
    town: [ {
        townName: "都市1",
        townId: null,
        index: null,
        targetTime: null,
        building: null,
        status: ""
    }, ]
};
*/
