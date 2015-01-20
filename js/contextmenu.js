define(['tabmanager', 'settings'], function (tabmanager, settings) {

    var contextmenu = {};
    var lockTabId;
    var lockDomainId;

    contextmenu.createContextMenus = function () {

        var lockTabAction = function (onClickData, selectedTab) {
            tabmanager.toggleTabLock(selectedTab.id);
        };

        var lockDomainAction = function (onClickData, selectedTab) {
            var whitelist = settings.get('whitelist');
            var domain = getDomain(selectedTab.url);
            whitelist.push(domain);
            settings.set('whitelist', whitelist);
        };

        var corralTabAction = function (onClickData, selectedTab) {
            tabmanager.wrangleAndClose(selectedTab.id);
        };

        var lockTab = {
            'type': 'checkbox',
            'title': "Never close this tab",
            'onclick': lockTabAction
        };

        var lockDomain = {
            'type': 'checkbox',
            'title': "Never close anything on this domain",
            'onclick': lockDomainAction
        };

        var closeTab = {
            'type': 'normal',
            'title': "Close tab and save URL immediately",
            'onclick': corralTabAction
        };

        lockTabId = chrome.contextMenus.create(lockTab);
        lockDomainId = chrome.contextMenus.create(lockDomain);
        chrome.contextMenus.create(closeTab);
    };

    contextmenu.updateContextMenus = function (tabId) {
        chrome.tabs.get(tabId, function (tab) {
            var currentDomain = getDomain(tab.url);
            chrome.contextMenus.update(lockTabId, { checked: tab.locked });
            chrome.contextMenus.update(lockDomainId, { title: 'Never close anything on ' + currentDomain });
        })
    };

    var getDomain = function (url) {
        return url.match(/[^:]+:\/\/([^\/]+)\//)[1];
    };

    return contextmenu;
});