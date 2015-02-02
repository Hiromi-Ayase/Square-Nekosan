/*global angular*/
(function () {
  "use strict";
  var app = angular.module("SquareNekosan", ["ui.bootstrap"]);

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
      $scope.mapList = res.data.map[0].id;
    });
  }]);
}());

