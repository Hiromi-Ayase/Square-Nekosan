/*jslint vars: true*/
/*global chrome, localStorage, COMMON*/
(function () {
    'use strict';

    var data = {};

    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            var storageData,
                storageObject;
            if (request.op === COMMON.OP.GET_STORAGE_ARGS) {
                storageData = localStorage.getItem(COMMON.STORAGE.ARGS);
                sendResponse({
                    data: data,
                    storage: storageData
                });
            } else if (request.op === COMMON.OP.GET_STORAGE_CONTENT) {
                storageData = localStorage.getItem(COMMON.STORAGE.CONTENT);
                sendResponse({
                    data: data,
                    storage: storageData
                });
            } else if (request.op === COMMON.OP.SET_STORAGE_ARGS) {
                if (request.data !== undefined) {
                    data = request.data;
                }
                if (request.storage !== undefined) {
                    storageData = request.storage;
                    localStorage.setItem(COMMON.STORAGE.ARGS, storageData);
                }
            } else if (request.op === COMMON.OP.SET_STORAGE_CONTENT) {
                if (request.data !== undefined) {
                    data = request.data;
                }
                if (request.storage !== undefined) {
                    storageData = request.storage;
                    localStorage.setItem(COMMON.STORAGE.CONTENT, storageData);
                }
            }
        }
    );

    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if (tab.url.indexOf("http://lm-s4.ujj.co.jp/") > -1) {
            chrome.pageAction.show(tabId);
            data.tabId = tabId;
        }
    });
}());
