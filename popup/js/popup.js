/*jslint vars: true */
/*global angular, $, chrome, console, COMMON, CodeMirror, document*/
(function () {
    "use strict";
    var app = angular.module("SquareNekosan", ["ui.bootstrap", "ngResource", "ui.codemirror"]),
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

    app.controller("MainController", ["$scope", "$interval", "$resource", "$timeout", function ($scope, $interval, $resource, $timeout) {
        $scope.COMMON = COMMON;
        $scope.config = $resource("/popup/data/form.json").query();
        $scope.args = {};
        $scope.send = function (ctrl, op) {
            chrome.tabs.sendMessage(data.tabId, {
                "op": op,
                "ctrl": ctrl,
                "args": $scope.args[op]
            }, function (response) {});
        };

        $scope.btnClass = function (ctrl, op) {
            if ($scope.contentsData === undefined) {
                return { disabled: true };
            }
            var s = $scope.contentsData[op].state;
            if (ctrl === COMMON.OP_CTRL.RUN) {
                return { disabled: s === COMMON.CMD_STATUS.RUN };
            } else if (ctrl === COMMON.OP_CTRL.PAUSE) {
                return { disabled: s === COMMON.CMD_STATUS.PAUSE || s === COMMON.CMD_STATUS.END };
            } else if (ctrl === COMMON.OP_CTRL.ABORT) {
                return { disabled: s === COMMON.CMD_STATUS.END };
            }
        };

        var cmSetting;
        $scope.settingEditor = {
            lineNumbers: true,
            indentWithTabs: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            mode: 'application/ld+json',
            onLoad : function (cm) {
                cmSetting = cm;
                cm.on("change", function (e) {
                    try {
                        JSON.parse(cm.getValue());
                        $scope.settingsStatus = "OK";
                    } catch (e1) {
                        $scope.settingsStatus = "JSON Error";
                    }
                });
            }
        };
/*
        var flash = function (message) {
            $scope.flash = message;
            $timeout(function () {
                $scope.flash = undefined;
            }, 1000);
        };
        $scope.flashbox = function () {
            return { hiddenElement: $scope.flash === undefined };
        };
*/
        $scope.settingAction = function (mode) {
            if (mode === "save") {
                var jsonString = cmSetting.getValue();
                try {
                    storage = JSON.parse(jsonString);
                } catch (e2) {
                    return;
                }
                chrome.runtime.sendMessage({
                    "op": COMMON.OP.SET,
                    "storage": jsonString
                });
                $scope.settingsStatus = "Saved!";
            } else if (mode === "restore") {
                cmSetting.setValue(storage);
            }
        };

        $interval(function () {
            chrome.tabs.sendMessage(data.tabId, {
                "op": COMMON.OP.CONTENTS_DATA
            }, function (response) {
                $scope.contentsData = response;
            });
        }, COMMON.INTERVAL.CONTENTS_DATA);


        chrome.runtime.sendMessage({
            "op": COMMON.OP.GET
        }, function (response) {
            data = response.data;
            storage = response.storage;
            $scope.setting = storage;
        });
    }]);
}());