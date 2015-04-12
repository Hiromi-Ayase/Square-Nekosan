/*jslint vars: true, plusplus: true*/
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
            var onChange = ' ng-change="onChange(c.name)"';
            if (scope.f.type === "select") {
                html = '<select class="ng-model-box" ng-model="args.' + n + '" ng-options="m.value as m.name + \' (\' + m.value + \')\' for m in f.values"' + onChange + ' />';
                element.append($compile(html)(scope));
                scope.args[scope.c.name][scope.f.name] = scope.f.values[0].value;
            } else if (scope.f.type === "text") {
                html = '<input class="ng-model-box" type="text" ng-model="args.' + n + '"' + onChange + ' />';
                element.append($compile(html)(scope));
                scope.args[scope.c.name][scope.f.name] = scope.f.init;
            } else if (scope.f.type === "number") {
                html = '<input class="ng-model-box" type="number" ng-model="args.' + n + '"' + onChange + ' />';
                element.append($compile(html)(scope));
                scope.args[scope.c.name][scope.f.name] = scope.f.init;
            } else if (scope.f.type === "range") {
                html = '<div class="ng-model-box"><input type="number" class="col-xs-5 range-box" ng-model="args.' + n + '.min"' + onChange + ' /><div class="col-xs-2 range-mark">～' +
                    '</div><input type="number" class="col-xs-5 range-box" ng-model="args.' + n + '.max"' + onChange + ' /></div>';
                element.append($compile(html)(scope));
                scope.args[scope.c.name][scope.f.name] = {};
                scope.args[scope.c.name][scope.f.name].min = scope.f.initmin;
                scope.args[scope.c.name][scope.f.name].max = scope.f.initmax;
            } else if (scope.f.type === "checkbox") {
                html = '<div class="ng-model-box"><input type="checkbox" ng-model="args.' + n + '"' + onChange + ' /><span class="checkbox-mark">{{f.title}}</span></div>';
                element.append($compile(html)(scope));
                scope.args[scope.c.name][scope.f.name] = scope.f.init;
            }
        };
    }]);

    app.directive("ngFlagform", ['$compile', function ($compile) {
        return function (scope, element, attr) {
            if (scope.args[scope.c.name] === undefined) {
                scope.args[scope.c.name] = {};
            }
            var html;
            html = '<button class="btn btn-xs" ng-class="flagbtnClass(c.name)" ng-click="sendFlag(c.name)">' +
                '{{contentsData.' + scope.c.name + '.state}}</button> {{c.title}}';
            element.append($compile(html)(scope));
            scope.args[scope.c.name].enable = scope.c.init;
        };
    }]);


    app.directive("ngLvupform", ['$compile', function ($compile) {
        return function (scope, element, attr) {
            if (scope.args[COMMON.OP.LVUP] === undefined) {
                scope.args[COMMON.OP.LVUP] = {};
                scope.args[COMMON.OP.LVUP].data = [{
                    name: "",
                    cond: [],
                    type: "dice",
                    point: 5,
                    condstr: "",
                    status: "",
                    judge: false
                }];
            }
            scope.lvupTypes = [ "dice", "vip" ];
            scope.lvupPoint = [ 4, 5, 6 ];

            var html;
            var onChange = ' ng-change="onChange(' + "'lvup'" + ')"';
            html =
                '<div class="row" ng-repeat="a in args.lvup.data">' +
                '    <span class="glyphicon glyphicon-ok" ng-if="a.judge" />' +
                '    <span class="glyphicon glyphicon-remove" ng-if="!a.judge" />' +
                '    <input class="ng-model-box lvupform-element" style="width:20%" type="text" ng-model="a.name"' + onChange + ' />' +
                '    <input class="ng-model-box lvupform-element" style="width:42%" type="text" ng-model="a.condstr"' +
                ' tooltip="{{a.status}}" tooltip-trigger="focus" tooltip-placement="bottom"' + onChange + ' />' +
                '    <select class="ng-model-box lvupform-element" style="width:13%" ng-model="a.type" ng-options="t for t in lvupTypes"' + onChange + '></select>' +
                '    <select class="ng-model-box lvupform-element" style="width:9%" ng-model="a.point" ng-options="p for p in lvupPoint"' + onChange + '></select>' +
                '    <button class="btn btn-default btn-xs glyphicon glyphicon-minus pull-right" ng-click="delLvupform($index)" ></button>' +
                '</div>';
            element.append($compile(html)(scope));
            scope.args[COMMON.OP.LVUP].enable = false;
        };
    }]);

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

    app.controller("MainController", ["$scope", "$interval", "getData", "$timeout", function ($scope, $interval, getData, $timeout) {
        $scope.COMMON = COMMON;
        getData.get("form").then(function (res) {
            $scope.config = res.data;
            console.log($scope.config);
        });
        //$scope.config = $resource("/popup/data/form.json").query();
        $scope.args = {};
        $scope.send = function (ctrl, op) {
            $scope.saveSetting();
            chrome.tabs.sendMessage(data.tabId, {
                "op": op,
                "ctrl": ctrl,
                "args": $scope.args[op]
            }, function (response) {});
        };

        $scope.addLvupform = function () {
            $scope.args.lvup.data.push({
                name: "",
                cond: [],
                type: "dice",
                point: 5,
                condstr: "",
                status: "",
                judge: false
            });
            $scope.onChange(COMMON.OP.LVUP);
        };
        $scope.delLvupform = function (i) {
            $scope.args.lvup.data.splice(i, 1);
            $scope.onChange(COMMON.OP.LVUP);
        };

        $scope.btnClass = function (ctrl, op) {
            if ($scope.contentsData === undefined || $scope.contentsData[op] === undefined) {
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

        $scope.sendFlag = function (op) {
            chrome.tabs.sendMessage(data.tabId, {
                "op": op,
                "ctrl": COMMON.OP_CTRL.FLAG,
                "args": $scope.args[op]
            }, function (response) {
                $scope.args[op].enable = response;
                $scope.saveSetting();
            });
        };

        $scope.flagbtnClass = function (op) {
            if ($scope.contentsData === undefined || $scope.contentsData[op] === undefined || $scope.contentsData[op].state === undefined) {
                return { "btn-primary": true };
            }
            var s = $scope.contentsData[op].state;
            return {
                "btn-primary": s === COMMON.CMD_STATUS.ON,
                "btn-default": s === COMMON.CMD_STATUS.OFF
            };
        };

        $scope.onChange = function (op) {
            chrome.tabs.sendMessage(data.tabId, {
                "op": op,
                "ctrl": COMMON.OP_CTRL.CHANGE,
                "args": $scope.args[op]
            }, function (response) {
                if (response !== undefined) {
                    $scope.args[op] = response;
                    $scope.saveSetting();
                    console.log("reponse");
                }
            });
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
        $scope.saveSetting = function () {
            storage.args = $scope.args;
            //storage.config = $scope.config;
            var jsonString =  JSON.stringify(storage, null, 4);
            chrome.runtime.sendMessage({
                "op": COMMON.OP.SET,
                "storage": jsonString
            });
            cmSetting.setValue(jsonString);
        };

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
                cmSetting.setValue(jsonString);
                $scope.settingsStatus = "Saved!";
            } else if (mode === "restore") {
                cmSetting.setValue(JSON.stringify(storage, null, 4));
            } else if (mode === "reset") {
                cmSetting.setValue("{}");
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
            storage = JSON.parse(response.storage) || {};
            cmSetting.setValue(JSON.stringify(storage, null, 4));
            if (storage.args !== undefined) {
                $scope.args = storage.args;
            }
            /*if (storage.config !== undefined) {
                $scope.config = storage.config;
            }*/

            chrome.tabs.sendMessage(data.tabId, {
                "op": COMMON.OP.INIT,
                "args": $scope.args
            }, function (response) {});
        });
    }]);
}());
