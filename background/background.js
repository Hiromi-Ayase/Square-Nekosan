/*global chrome*/
(function () {
    'use strict';

    var data = {};

    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            var storageData,
                storageObject;
            if (request.op === "get") {
                storageData = localStorage.getItem("storage");
                storageObject = JSON.parse(storageData);
                sendResponse({
                    data: data,
                    storage: storageObject
                });
            } else if (request.op === 'set') {
                if (request.data !== 'undefined') {
                    data = request.data;
                }
                if (request.storage !== 'undefined') {
                    storageObject = request.storage;
                    storageData = JSON.stringify(storageObject);
                    localStorage.setItem("storage", storageData);
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
