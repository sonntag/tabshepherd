define(['underscore', 'settings'], function (_, settings) {

    var tabmanager = {};

    tabmanager.openTabs = {};
    tabmanager.closedTabs = {tabs: []};
    tabmanager.filters = {};

    tabmanager.getTime = function (tabId) {
        return tabmanager.openTabs[tabId].time;
    };

    tabmanager.initTabs = function (tabs) {
        _.map(tabs, tabmanager.registerNewTab);
    };

    tabmanager.registerNewTab = function (tab) {
        if (!tab.pinned) {
            chrome.windows.get(tab.windowId, null, function (window) {
                if (window.type == 'normal') {
                    tabmanager.openTabs[tab.id] = {
                        time: new Date(),
                        locked: false
                    };

                    tabmanager.scheduleNextClose();
                }
            });
        }
    };

    tabmanager.updateLastAccessed = function (tabId) {
        if (_.has(tabmanager.openTabs, tabId)) {
            var tab = tabmanager.openTabs[tabId];
            tab.time = new Date();

            // If this tab was scheduled to close, we must cancel the close and schedule a new one
            if (_.has(tab, 'scheduledClose')) {
                tabmanager.unscheduleTab(tab);
                tabmanager.scheduleNextClose();
            }
        }
    };

    tabmanager.removeTab = function (tabId) {

        if (!_.has(tabmanager.openTabs, tabId)) {
            return;
        }

        var tab = tabmanager.openTabs[tabId];

        if (_.has(tab, 'scheduledClose')) {
            // If this case is true, then a scheduled tabs was closed (doesn't matter if it was
            // by the user or by a close event), so attmpt to unschedule it.
            tabmanager.unscheduleTab(tab);
        } else {
            // Otherwise an unscheduled tab was definitely closed by the user, so we may have to
            // unschedule another tab.
            tabmanager.unscheduleLatestClose();
        }

        delete tabmanager.openTabs[tabId];
    };

    tabmanager.replaceTab = function (addedTabId, removedTabId) {
        if (_.has(tabmanager.openTabs, removedTabId)) {
            var tab = tabmanager.openTabs[removedTabId];
            tabmanager.openTabs[addedTabId] = tab;
            delete tabmanager.openTabs[removedTabId];

            // if the replaced tab was schedule to close then we must reschedule it.
            if (_.has(tab, 'scheduledClose')) {
                tabmanager.unscheduleTab(tab);
                tabmanager.scheduleToClose({id: addedTabId});
            }
        }
    };

    tabmanager.wrangleAndClose = function (tabId) {
        chrome.tabs.get(tabId, function (tab) {
            chrome.tabs.remove(tabId, function () {

                var tabToSave = _.extend(tab, {closedAt: new Date().getTime()});
                tabmanager.closedTabs.tabs.unshift(tabToSave);

                chrome.storage.local.set({savedTabs: tabmanager.closedTabs.tabs});
                tabmanager.updateClosedCount();
            });
        });
    };

    tabmanager.scheduleNextClose = function () {

        if (settings.paused) {
            return;
        }

        chrome.tabs.query({pinned: false, windowType: 'normal'}, function (tabs) {
            var tabsToSchedule = tabmanager.getTabsToSchedule(tabs);
            _.map(tabsToSchedule, tabmanager.scheduleToClose);
        });
    };

    tabmanager.getTabsToSchedule = function (tabs) {

        var minTabs = settings.get('minTabs');

        if (tabs.length <= minTabs) {
            return [];
        } else {

            /* Do not schedule any tabs that are active, locked, or whitelisted. */
            var canSchedule = _.reject(tabs, function (tab) {
                return tab.active || tabmanager.isLocked(tab.id) || tabmanager.isWhitelisted(tab.url);
            });

            /* Sort tabs by time so that the older tabs are closed before newer ones. */
            var sortedByTime = _.sortBy(canSchedule, function (tab) {
                return tabmanager.getTime(tab.id);
            });

            /* Only take the minimum number of tabs requried to get to minTabs */
            return _.take(sortedByTime, tabs.length - minTabs);
        }
    };

    tabmanager.scheduleToClose = function (tab) {
        if (!_.has(tabmanager.openTabs[tab.id], 'scheduledClose')) {
            var timeout = tabmanager.getTime(tab.id).getTime() + settings.get('stayOpen') - new Date();
            tabmanager.openTabs[tab.id].scheduledClose = setTimeout(function () {
                tabmanager.wrangleAndClose(tab.id);
            }, timeout);
        }
    };

    tabmanager.rescheduleAllTabs = function () {
        tabmanager.unscheduleAllTabs();
        tabmanager.scheduleNextClose();
    };

    tabmanager.unscheduleLatestClose = function () {

        var scheduledTabs = _.filter(tabmanager.openTabs, function (tab) {
            return _.has(tab, 'scheduledClose');
        });

        if (_.size(scheduledTabs) > 0) {
            var latestTab = _.max(scheduledTabs, function (tab) {
                return tab.time;
            });
            tabmanager.unscheduleTab(latestTab);
        }
    };

    tabmanager.unscheduleAllTabs = function () {
        var scheduledTabs = _.filter(tabmanager.openTabs, function (tab) {
            return _.has(tab, 'scheduledClose');
        });
        _.map(scheduledTabs, tabmanager.unscheduleTab);
    };

    tabmanager.unscheduleTab = function (tab) {
        clearTimeout(tab.scheduledClose);
        delete tab['scheduledClose'];
    };

    tabmanager.closedTabs.init = function () {
        if (settings.get('purgeClosedTabs')) {
            chrome.storage.local.remove('savedTabs');
        } else {
            chrome.storage.local.get({savedTabs: []}, function (items) {
                tabmanager.closedTabs.tabs = items.savedTabs;
                tabmanager.updateClosedCount();
            });
        }
    };

    tabmanager.closedTabs.removeTab = function (tabId) {
        tabmanager.closedTabs.tabs.splice(findPositionById(tabmanager.closedTabs, tabId), 1);
        chrome.storage.local.set({savedTabs: tabmanager.closedTabs.tabs});
        tabmanager.updateClosedCount();
    };

    var findPositionById = function (tabs, id) {
        for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].id == id) {
                return i;
            }
        }
        return -1;
    };

    tabmanager.closedTabs.clear = function () {
        tabmanager.closedTabs.tabs = [];
        chrome.storage.local.remove('savedTabs');
        tabmanager.updateClosedCount();
    };

    tabmanager.closedTabs.removeDuplicate = function (url) {
        var tabsToRemove = _.filter(tabmanager.closedTabs.tabs, function (tab) {
            return tab.url == url;
        });

        var tabIdsToRemove = _.pluck(tabsToRemove, 'id');
        _.map(tabIdsToRemove, tabmanager.closedTabs.removeTab);
    };

    tabmanager.closedTabs.openLatestTab = function () {
        var tabToOpen = tabmanager.closedTabs.tabs.shift();
        chrome.tabs.create({active: true, url: tabToOpen.url});
        chrome.storage.local.set({savedTabs: tabmanager.closedTabs.tabs});
        tabmanager.updateClosedCount();
    };

    tabmanager.isWhitelisted = function (url) {
        var whitelist = settings.get("whitelist");
        return _.any(whitelist, function (item) {
            return url.indexOf(item) != -1
        });
    };

    tabmanager.lockTab = function (tabId) {
        var tab = tabmanager.openTabs[tabId];
        tab.locked = true;

        if (_.has(tab, 'scheduledClose')) {
            tabmanager.unscheduleTab(tab);
            tabmanager.scheduleNextClose();
        }
    };

    tabmanager.unlockTab = function (tabId) {
        tabmanager.openTabs[tabId].locked = false;
        tabmanager.unscheduleLatestClose();
        tabmanager.scheduleNextClose();
    };

    tabmanager.toggleTabLock = function (tabId) {
        if (tabmanager.isLocked(tabId)) {
            tabmanager.unlockTab(tabId)
        } else {
            tabmanager.lockTab(tabId)
        }
    };

    tabmanager.isLocked = function (tabId) {
        return tabmanager.openTabs[tabId].locked;
    };

    tabmanager.updateClosedCount = function () {
        if (settings.get('showBadgeCount') == false) {
            return;
        }
        var storedTabs = tabmanager.closedTabs.tabs.length;
        if (storedTabs == 0) {
            storedTabs = '';
        }
        chrome.browserAction.setBadgeText({text: storedTabs.toString()});
    };

    return tabmanager;
});