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
        $scope.state.block = 'stop';
        $scope.clickPlay = function (cmd) {
            if ($scope.state[cmd] === 'play') {
                $scope.state[cmd] = 'pause';
            } else if ($scope.state[cmd] === 'pause') {
                $scope.state[cmd] = 'play';
            } else if ($scope.state[cmd] === 'stop') {
                $scope.state[cmd] = 'play';
            }
        };

        $scope.clickStop = function (cmd) {
            $scope.state[cmd] = 'stop';
        };

        $scope.iconClass = function (cmd) {
            return {
                'glyphicon-play': $scope.state[cmd] !== 'play',
                'glyphicon-pause': $scope.state[cmd] === 'play'
            };
        };

        $scope.btnClass = function (cmd) {
            return {
                'btn-danger': $scope.state[cmd] !== 'play',
                'btn-primary': $scope.state[cmd] === 'play'
            };
        };

        $scope.btnClass2 = function (cmd) {
            return {
                'hidden-element': $scope.state[cmd] === 'stop'
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
    }]);

    chrome.runtime.sendMessage({
        "op": COMMON.OP.GET
    }, function (response) {
        data = response.data;
        storage = response.storage;
    });
}());
