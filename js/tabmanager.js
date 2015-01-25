define(['underscore', 'corralmanager', 'settings'], function (_, corralmanager, settings) {

    var tabmanager = {};

    tabmanager.openTabs = {};

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
                        locked: false,
                        windowId: tab.windowId
                    };

                    tabmanager.scheduleNextClose(tab.windowId);
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
                unscheduleTab(tab);
                tabmanager.scheduleNextClose(tab.windowId);
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
            unscheduleTab(tab);
        } else {
            // Otherwise an unscheduled tab was definitely closed by the user, so we may have to
            // unschedule another tab.
            unscheduleLatestClose(tab.windowId);
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
                unscheduleTab(tab);
                scheduleToClose({id: addedTabId});
            }
        }
    };

    tabmanager.wrangleAndClose = function (tabId) {
        chrome.tabs.get(tabId, function (tab) {
            chrome.tabs.remove(tabId, function () {
                corralmanager.wrangleTab(tab);
            });
        });
    };

    tabmanager.scheduleNextClose = function (windowId) {

        if (settings.paused) {
            return;
        }

        if (settings.get('countPerWindow')) {
            if (arguments.length == 1) {
                chrome.tabs.query({pinned: false, windowType: 'normal', windowId: windowId}, function (tabs) {
                    var tabsToSchedule = getTabsToSchedule(tabs);
                    _.map(tabsToSchedule, scheduleToClose);
                })
            } else {
                chrome.tabs.query({pinned: false, windowType: 'normal'}, function (tabs) {
                    var windowGroups = _.values(_.groupBy(tabs, function (tab) { return tab.windowId }));
                    var tabsToSchedule = _.flatten(_.map(windowGroups, getTabsToSchedule));
                    _.map(tabsToSchedule, scheduleToClose);
                })
            }
        } else {
            chrome.tabs.query({pinned: false, windowType: 'normal'}, function (tabs) {
                var tabsToSchedule = getTabsToSchedule(tabs);
                _.map(tabsToSchedule, scheduleToClose);
            });
        }
    };

    var getTabsToSchedule = function (tabs) {

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

    var scheduleToClose = function (tab) {
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

    var unscheduleLatestClose = function (windowId) {

        var scheduledTabs = _.filter(tabmanager.openTabs, function (tab) {
            return _.has(tab, 'scheduledClose');
        });

        if (settings.get('countPerWindow')) {
            scheduledTabs = _.filter(scheduledTabs, function (tab) { return tab.windowId == windowId })
        }

        if (_.size(scheduledTabs) > 0) {
            var latestTab = _.max(scheduledTabs, function (tab) {
                return tab.time;
            });
            unscheduleTab(latestTab);
        }
    };

    tabmanager.unscheduleAllTabs = function () {
        var scheduledTabs = _.filter(tabmanager.openTabs, function (tab) {
            return _.has(tab, 'scheduledClose');
        });
        _.map(scheduledTabs, unscheduleTab);
    };

    var unscheduleTab = function (tab) {
        clearTimeout(tab.scheduledClose);
        delete tab['scheduledClose'];
    };

    tabmanager.isWhitelisted = function (url) {
        var whitelist = settings.get("whitelist");
        return _.any(whitelist, function (item) {
            return url.indexOf(item) != -1
        });
    };

    tabmanager.toggleTabLock = function (tabId) {
        if (tabmanager.isLocked(tabId)) {
            unlockTab(tabId)
        } else {
            lockTab(tabId)
        }
    };

    var lockTab = function (tabId) {
        var tab = tabmanager.openTabs[tabId];
        tab.locked = true;

        if (_.has(tab, 'scheduledClose')) {
            unscheduleTab(tab);
            tabmanager.scheduleNextClose(tab.windowId);
        }
    };

    var unlockTab = function (tabId) {
        var tab = tabmanager.openTabs[tabId];
        tab.locked = false;

        unscheduleLatestClose(tab.windowId);
        tabmanager.scheduleNextClose(tab.windowId);
    };

    tabmanager.isLocked = function (tabId) {
        return tabmanager.openTabs[tabId].locked;
    };

    tabmanager.detachTab = function (tabId) {
        if (settings.get('countPerWindow')) {
            var tab = tabmanager.openTabs[tabId];

            if (_.has(tab, 'scheduledClose')) {
                unscheduleTab(tab);
            } else {
                unscheduleLatestClose(tab.windowId)
            }
        }
    };

    tabmanager.attachTab = function (tabId, attachInfo) {
        if (settings.get('countPerWindow')) {
            var tab = tabmanager.openTabs[tabId];
            tab.windowId = attachInfo.newWindowId;
            tabmanager.scheduleNextClose(attachInfo.newWindowId);
        }
    };

    return tabmanager;
});