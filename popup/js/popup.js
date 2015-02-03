/*global angular, chrome*/
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


    app.controller("MapController", ["$scope", "getData", function ($scope, getData) {
        getData.get("mapId").then(function (res) {
            $scope.data = res.data.map;
            $scope.mapId = res.data.map[0].id;
        });

        $scope.send = function () {
            chrome.tabs.sendMessage(data.tabId, {
                "op": "map",
                "mapId": $scope.mapId
            }, function (response) {});
        };
    }]);

    chrome.runtime.sendMessage({
        "op": "get"
    }, function (response) {
        data = response.data;
        storage = response.storage;
    });
}());
