define(['underscore', 'settings'], function (_, settings) {

    var corralmanager = {};

    corralmanager.tabs = [];

    corralmanager.init = function () {
        if (settings.get('purgeClosedTabs')) {
            chrome.storage.local.remove('savedTabs');
        } else {
            chrome.storage.local.get({savedTabs: []}, function (items) {
                corralmanager.tabs = items.savedTabs;
                updateClosedCount();
            });
        }
    };

    corralmanager.wrangleTab = function (tab) {
        var tabToSave = _.extend(tab, {closedAt: new Date().getTime()});
        corralmanager.tabs.unshift(tabToSave);

        chrome.storage.local.set({savedTabs: corralmanager.tabs});
        updateClosedCount();
    };

    corralmanager.removeTab = function (tabId) {
        corralmanager.tabs.splice(findPositionById(corralmanager.tabs, tabId), 1);
        chrome.storage.local.set({savedTabs: corralmanager.tabs});
        updateClosedCount();
    };

    var findPositionById = function (tabs, id) {
        for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].id == id) {
                return i;
            }
        }
        return -1;
    };

    corralmanager.clear = function () {
        corralmanager.tabs = [];
        chrome.storage.local.remove('savedTabs');
        updateClosedCount();
    };

    corralmanager.removeDuplicate = function (url) {
        var tabsToRemove = _.filter(corralmanager.tabs, function (tab) {
            return tab.url == url;
        });

        var tabIdsToRemove = _.pluck(tabsToRemove, 'id');
        _.map(tabIdsToRemove, corralmanager.removeTab);
    };

    corralmanager.openLatestTab = function () {
        var tabToOpen = corralmanager.tabs.shift();
        chrome.tabs.create({active: true, url: tabToOpen.url});
        chrome.storage.local.set({savedTabs: corralmanager.tabs});
        updateClosedCount();
    };

    var updateClosedCount = function () {
        if (settings.get('showBadgeCount') == false) {
            return;
        }
        var storedTabs = corralmanager.tabs.length;
        if (storedTabs == 0) {
            storedTabs = '';
        }
        chrome.browserAction.setBadgeText({text: storedTabs.toString()});
    };

    return corralmanager;
});