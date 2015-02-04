/*jslint vars: true */
/*global angular, chrome, COMMON*/
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

        $interval(function () {
            chrome.tabs.sendMessage(data.tabId, {
                "op": COMMON.OP.LOG
            }, function (response) {
                $scope.log = response.log;
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
