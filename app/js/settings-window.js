'use strict';

const app = angular.module('settingsWindow', []);

const remote = require('electron').remote;

const debounce = require('lodash.debounce');

// copy/paste menu & hotkeys
const inputMenu = require('electron-input-menu');
const contextMenu = require('electron-contextmenu-middleware');
contextMenu.use(inputMenu);
contextMenu.activate();
inputMenu.registerShortcuts();

app.run($rootScope => {
    $rootScope.Platform = require('os').platform();
    $rootScope.Electron = remote.app;
    $rootScope.AppName = $rootScope.Electron.getName();
    $rootScope.Version = $rootScope.Electron.getVersion();
    $rootScope.Window = remote.getCurrentWindow();
    $rootScope.Pussh = remote.getGlobal('Pussh');

    $rootScope.Window.focus();
});

app.controller('settings', ($scope, $rootScope) => {
    const Pussh = $rootScope.Pussh;

    $scope.services = Pussh.services.list().map(s => {
        return {
            name: s.name,
            _name: s._name,
            description: s.description,
            settings: s.settings
        }
    });
    $scope.settings = Pussh.settings.get();
    $scope.selectedService = Pussh.services.get($scope.settings.selectedService) || Pussh.services.list()[0];
    $scope.serviceSettings = $scope.selectedService.getSettings();
    $scope.autoLaunchSetting = false;

    Pussh.settings.getAutoLaunch(state => {
        $scope.autoLaunchSetting = state;
        $scope.$apply();

        $scope.$watch('autoLaunchSetting', () => Pussh.settings.setAutoLaunch($scope.autoLaunchSetting));
    });

    $scope.resetAll = () => Pussh.settings.resetAll();

    $scope.$watch('selectedService', service => {
        $scope.settings.selectedService = service._name;
        $scope.serviceSettings = $scope.selectedService.settings;

        $scope.save();
    });

    $scope.$watch('settings', () => $scope.save(), true);
    $scope.$watch('serviceSettings', () => $scope.save(), true);

    $scope.save = debounce(() => {
        Pussh.services.get($scope.selectedService._name).saveSettings();
        Pussh.settings.save();
    }, 1000, {
        leading: true,
        trailing: true
    });
});
