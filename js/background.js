require.config({
    baseUrl: 'js',
    paths: {
        underscore: '../lib/js/underscore'
    },
    shim: {
        underscore: {
            exports: '_'
        }
    }
});

// This is used to expose the background page to the popup
var TW = TW || {};

require(['underscore', 'tabmanager', 'corralmanager', 'settings', 'contextmenu', 'updater'],
    function (_, tabmanager, corralmanager, settings, contextmenu, updater) {

        TW.TabManager = tabmanager;
        TW.corralmanager = corralmanager;
        TW.settings = settings;

        chrome.runtime.onInstalled.addListener(function (details) {
            if (details.reason == 'install') {
                updater.firstInstall();
            } else if (details.reason == 'update') {
                updater.runUpdates(details.previousVersion, chrome.app.getDetails().version);
            }
        });

        settings.init();
        corralmanager.init();

        // Move this to a function somewhere so we can restart the process.
        chrome.tabs.query({windowType: 'normal', pinned: false}, tabmanager.initTabs);
        chrome.tabs.onCreated.addListener(tabmanager.registerNewTab);

        // Handles pinning and unpinning a tab
        chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
            if (_.has(changeInfo, 'pinned')) {
                if (changeInfo.pinned) {
                    clearTimeout(tabmanager.openTabs[tabId].scheduledClose);
                    tabmanager.tabPinned(tabId);
                } else {
                    tabmanager.registerNewTab(tab);
                }
            }
        });

        // Handler for removing duplicate tabs from the corral
        chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
            if (settings.get('removeCorralDupes') && _.has(changeInfo, 'url')) {
                corralmanager.removeDuplicate(changeInfo.url);
            }
        });

        chrome.tabs.onRemoved.addListener(tabmanager.removeTab);

        chrome.tabs.onActivated.addListener(function (tabInfo) {
            contextmenu.updateContextMenus(tabInfo.tabId);
            tabmanager.updateLastAccessed(tabInfo.tabId)
        });

        chrome.tabs.onReplaced.addListener(tabmanager.replaceTab);

        // Handlers specific to a window-based count
        chrome.tabs.onDetached.addListener(tabmanager.detachTab);
        chrome.tabs.onAttached.addListener(tabmanager.attachTab);

        chrome.storage.onChanged.addListener(settings.copySyncChanges);

        chrome.commands.onCommand.addListener(function (command) {
            if (command == 'reopen-corral-tab') {
                corralmanager.openLatestTab();
            }
        });

        contextmenu.createContextMenus();
    }
);