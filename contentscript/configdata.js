/*jslint vars: true, plusplus: true*/
/*global COMMON, console, log */
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

config.item = {
    enable: false,

    sell: [],
    move: [],
    use: [],
    alchemy: [],
    maid: "",
    contribute: {
        enable: false,
        stone: 0
    }
};

(function () {
    'use strict';

    config.setItemConfig = function (input) {
        var check = true;

        if (input.sell && input.sell !== "") {
            config.item.sell = input.sell.split(",").map(function (s) { return s.trim(); });
        }
        if (input.move && input.move !== "") {
            config.item.move = input.move.split(",").map(function (s) { return s.trim(); });
        }
        if (input.use && input.use !== "") {
            config.item.use = input.use.split(",").map(function (s) { return s.trim(); });
        }

        config.item.alchemy = [];
        var i;
        for (i = 0; i < input.alchemy.length; i++) {
            if (input.alchemy[i].name && input.alchemy[i].name !== "") {
                config.item.alchemy.push(input.alchemy[i]);
            }
        }
        config.item.maid = input.maid;

        config.item.contribute = input.contribute;
        if (config.item.contribute.enable === true &&
                (input.contribute.stone < 500 || input.contribute.stone > 750000)) {
            log("寄付額の値が無効(500～750000)");
            config.item.contribute.enable = false;
            check = false;
        }

        return check;
    };
}());

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
