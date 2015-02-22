/*jslint vars: true */
/*global angular, $, chrome, console, COMMON*/
(function () {
    "use strict";
    var app = angular.module("SquareNekosan", ["ui.bootstrap"]),
        data = {},
        storage = {};

    app.factory("getData", ["$http", function ($http) {
        return {
            get: function (file) {
                return $http.get("data/" + file + ".json")
                    .success(function (data, status, headers, config) {
                        return data;
                    });
            }
        };
    }]);

    app.controller("MainController", ["$scope", "$interval", "getData", function ($scope, $interval, getData) {
        $scope.COMMON = COMMON;
        $scope.args = {};
        getData.get("config").then(function (response) {
            $scope.config = response.data;
            angular.forEach(response.data, function (value, key) {
                $scope.args[key] = value[0].value;
            });
        });

        $scope.send = function (op) {
            chrome.tabs.sendMessage(data.tabId, {
                "op": op,
                "args": $scope.args
            }, function (response) {});
        };

        $scope.args.block_count = 1;

        // state : play  -> btn : pause, stop
        // state : pause -> btn : play, stop
        // state : stop  -> btn : play
        $scope.state = {};
        $scope.state[COMMON.OP.BLOCK] = 'stop';
        $scope.clickPlay = function (op) {
            if ($scope.state[op] === 'play') {
                $scope.state[op] = 'pause';
                chrome.tabs.sendMessage(data.tabId, {
                    "op": op,
                    "state": COMMON.OPCTRL.PAUSE
                }, function (response) {});
            } else if ($scope.state[op] === 'pause') {
                $scope.state[op] = 'play';
                chrome.tabs.sendMessage(data.tabId, {
                    "op": op,
                    "state": COMMON.OPCTRL.RESUME
                }, function (response) {});
            } else if ($scope.state[op] === 'stop') {
                $scope.state[op] = 'play';
                chrome.tabs.sendMessage(data.tabId, {
                    "op": op,
                    "state": COMMON.OPCTRL.NEW,
                    "args": $scope.args
                }, function (response) {});
            }
        };
        $scope.clickStop = function (op) {
            $scope.state[op] = 'stop';
            chrome.tabs.sendMessage(data.tabId, {
                "op": op,
                "state": COMMON.OPCTRL.ABORT
            }, function (response) {});
        };

        $scope.iconClass = function (op) {
            return {
                'glyphicon-play': $scope.state[op] !== 'play',
                'glyphicon-pause': $scope.state[op] === 'play'
            };
        };

        $scope.btnClass = function (cmd) {
            return {
                'btn-danger': $scope.state[cmd] !== 'play',
                'btn-primary': $scope.state[cmd] === 'play'
            };
        };
        $scope.btnClass2 = function (op) {
            return {
                'hidden-element': $scope.state[op] === 'stop'
            };
        };


        $interval(function () {
            chrome.tabs.sendMessage(data.tabId, {
                "op": COMMON.OP.LOG
            }, function (response) {
                $scope.log = response.log;
            });
        }, COMMON.LOG.RELOAD);

        $interval(function () {
            chrome.tabs.sendMessage(data.tabId, {
                "op": COMMON.OP.LOGINBONUSSTATUS
            }, function (response) {
                $scope.loginBonusStatus = response.msg;
            });
        }, COMMON.LOG.RELOAD);

        $interval(function () {
            chrome.tabs.sendMessage(data.tabId, {
                "op": COMMON.OP.BLOCKBATTLECOUNTER
            }, function (response) {
                $scope.blockBattleCounter = response.msg;
            });
        }, COMMON.LOG.RELOAD);


        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            if (request.op === COMMON.OP.BLOCK) {
                if (request.state === COMMON.OPCTRL.END) {
                    $scope.state[COMMON.OP.BLOCK] = 'stop';
                }
            }
        });
    }]);

    chrome.runtime.sendMessage({
        "op": COMMON.OP.GET
    }, function (response) {
        data = response.data;
        storage = response.storage;
    });
}());
