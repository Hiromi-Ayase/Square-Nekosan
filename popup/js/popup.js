/*jslint vars: true */
/*global angular, $, chrome, console, COMMON*/
(function () {
    "use strict";
    var app = angular.module("SquareNekosan", ["ui.bootstrap", "ngResource"]),
        data = {},
        storage = {};

    app.directive("ngForm", ['$compile', function ($compile) {
        return function (scope, element, attr) {
            if (scope.args[scope.c.name] === undefined) {
                scope.args[scope.c.name] = {};
            }
            var html;
            var n = scope.c.name + "." + scope.f.name;
            if (scope.f.type === "select") {
                html = '<select ng-model="args.' + n + '" ng-options="m.value as m.name + \' (\' + m.value + \')\' for m in f.values" />';
                element.append($compile(html)(scope));
                scope.args[scope.c.name][scope.f.name] = scope.f.values[0].value;
            } else if (scope.f.type === "text") {
                html = '<input type="text" ng-model="args.' + n + '" />';
                element.append($compile(html)(scope));
                scope.args[scope.c.name][scope.f.name] = scope.f.init;
            } else if (scope.f.type === "number") {
                html = '<input type="number" ng-model="args.' + n + '" />';
                element.append($compile(html)(scope));
                scope.args[scope.c.name][scope.f.name] = scope.f.init;
            }
        };
    }]);


    app.controller("MainController", ["$scope", "$interval", "$resource", function ($scope, $interval, $resource) {
        $scope.COMMON = COMMON;
        $scope.config = $resource("/popup/data/config.json").query();
        $scope.args = {};
        $scope.state = {};
        $scope.send = function (btn, op) {
            chrome.tabs.sendMessage(data.tabId, {
                "op": op,
                "button": btn,
                "args": $scope.args[op]
            }, function (response) {});
            $scope.state = btn;
        };

        $scope.state = "stop";
        $scope.btnClass = function (btn, op) {
            if (btn === 'play') {
                return {
                    "disabled": $scope.state === "play"
                };
            } else if (btn === 'pause') {
                return {
                    "disabled": $scope.state === "stop" || $scope.state === "pause"
                };
            } else if (btn === 'stop') {
                return {
                    "disabled": $scope.state === "stop"
                };
            }
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
