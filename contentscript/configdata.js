var config = {};

config.trans = {
    enable: false,
    ratio: 0,
    threshold: 1
};

config.sudden = {
    enable: false,
    minHp: 1000000
};

config.maidLvup = {
    enable: false
};

config.battleDamage = {
    enable: false,
    minhp: 1
};

config.lvup = {
    enable: false,
    data: []    // data = [{ name, cond, type, point, condstr, status, judge }]
};
