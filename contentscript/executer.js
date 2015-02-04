/*jslint vars: true*/
/*global chrome, COMMON, g_mapid, GetBlockid, repeatBattle*/
(function () {
    'use strict';
    chrome.runtime.onMessage.addListener(function (request, sender, response) {
        if (request.op === COMMON.OP.MAP) {
            g_mapid = request.args.map;
            GetBlockid()
                .then(repeatBattle);
        } else if (request.op === COMMON.OP.DYSTOPIA) {
            isAvailableDystopia(request.args.dystopia, request.args.dystopiaMode)
                .then(getAllBlockidDystopia)
                .then(repeatBattle);
        }
    });
}());
