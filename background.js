var limit = 0;
var current = 0;

var defaults = {
    "trans_threshold": 0.7,
    "trans_ratio": 0.1,
    "interval": 10
};

chrome.runtime.onMessage.addListener(

    function(request, sender, sendResponse) {
        if (request.op == "getVar") {
            //chrome.tabs.executeScript(null, {file: "goldData.js"}, function(){
            chrome.tabs.executeScript(null, {file: "http://lm-s4.ujj.co.jp/web/js/default_set.js?ver=1145"}, function(){
                chrome.tabs.executeScript(null, {file: "getvariable.js"});
            });
            sendResponse();
        }

/*
        } else if (request.op == "trans") {
            current = request.stone_current;
            limit = request.stone_limit;
            var ratio = current / limit;
            
            var transRatio = localStorage["trans_ratio"] || defaults["trans_ratio"];
            var threshold = localStorage["trans_threshold"] || defaults["trans_threshold"];

            if (threshold < ratio) {
                var amount = current * transRatio;
            }
            sendResponse({"amount": amount});
        } else if (request.op == "get") {
            sendResponse({"value": localStorage[request.key] || defaults[request.key]});
        }
*/
    }
);


chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tab.url.indexOf("http://lm-s4.ujj.co.jp/") > -1) {
        chrome.pageAction.show(tabId);
        /*
        if (tab.url.indexOf("chrome-devtools://") == -1) {
            chrome.tabs.executeScript(null, {file: "http://lm-s4.ujj.co.jp/web/js/default_set.js?ver=1145"}, function(){
                chrome.tabs.executeScript(null, {code: "var scriptOptions = {gold : gold_res};"}, function(){
                    chrome.tabs.executeScript(null, {file: "getvariable.js"});
                });
            });
        }
        */
    }
});


/*
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      console.log(details.requestBody.formData);
      return {};
    },
    {urls: ["http://lm-s4.ujj.co.jp/web/flash_trans_xml_.php"]},
    ["blocking", "requestBody"]
);
*/
    
