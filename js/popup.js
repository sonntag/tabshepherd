var module = angular.module('popup', ['timer', 'ui.bootstrap']);

module.factory('backgroundPage', function () {
    return chrome.extension.getBackgroundPage().TW
});

module.filter('groupTabs', function () {
    return function (tabs) {

        if (_.isEqual(this.previousList, tabs)) {
            return this.previousGroup;
        }

        var now = new Date().getTime();
        var separations = [];
        separations.push([now - (1000 * 60 * 30), 'in the last 1/2 hour']);
        separations.push([now - (1000 * 60 * 60), 'in the last hour']);
        separations.push([now - (1000 * 60 * 60 * 2), 'in the last 2 hours']);
        separations.push([now - (1000 * 60 * 60 * 24), 'in the last day']);
        separations.push([0, 'more than a day ago']);

        this.previousList = tabs;
        this.previousGroup = _.groupBy(tabs, function (tab) {
            var separation = _.find(separations, function (sep) { return tab.closedAt > _.head(sep) });
            return separation[1];
        });

        return this.previousGroup;
    };
});

module.filter('timeago', function () {
    return function (tab) {
        return $.timeago(tab.closedAt)
    }
});

var PauseController = function (TW) {
    this.TW = TW
};

Object.defineProperty(PauseController.prototype, 'paused', {
    enumerable: true,
    configurable: false,
    get: function () {
        return this.TW.settings.paused
    },
    set: function (val) {
        this.TW.settings.set('paused', val)
    }
});

module.controller('PauseController', ['backgroundPage', PauseController]);

var CorralController = function (TW) {
    this.TW = TW;
    this.searchTerm = '';

    this.reopenTab = function (tab) {
        chrome.tabs.create({active: false, url: tab.url});
        TW.corralmanager.removeTab(tab.id);
    };

    this.restoreAll = function (tabs) {
        _.map(tabs, this.reopenTab)
    };

    this.removeTab = function (tab) {
        TW.corralmanager.removeTab(tab.id)
    };

    this.isEmpty = function () {
        return this.closedTabs.length == 0
    };

    this.clearList = function () {
        TW.corralmanager.clear()
    };
};

Object.defineProperty(CorralController.prototype, 'closedTabs', {
    enumerable: true,
    configurable: false,
    get: function () {
        return this.TW.corralmanager.tabs
    }
});

module.controller('CorralController', ['backgroundPage', CorralController]);

var LockController = function ($q, TW) {
    var self = this;
    self.TW = TW;

    self.openTabs = [];
    var deferredTabs = $q.defer();
    deferredTabs.promise.then(function (tabs) { self.openTabs = tabs });
    chrome.windows.getCurrent(null, function (window) {
        chrome.tabs.query({windowId: window.id, pinned: false}, function (tabs) {
            deferredTabs.resolve(tabs)
        })
    });

    self.getTimeLeft = function (tab) {
        var now = new Date().getTime();
        var timeToClose = TW.TabManager.openTabs[tab.id].scheduledClose.closeTime;
        return (timeToClose - now) / 1000;
    };

    self.isChecked = function (tab) {
        return TW.TabManager.isLocked(tab.id) || self.isDisabled(tab)
    };

    self.isDisabled = function (tab) {
        return TW.TabManager.isWhitelisted(tab.url)
    };

    self.toggleTabLock = function (tab) {
        TW.TabManager.toggleTabLock(tab.id)
    };

    self.scheduledToClose = function (tab) {
        return _.has(TW.TabManager.openTabs[tab.id], 'scheduledClose');
    }
};

Object.defineProperty(LockController.prototype, 'paused', {
    enumerable: true,
    configurable: false,
    get: function() {
        return this.TW.settings.paused
    }
});

module.controller('LockController', ['$q', 'backgroundPage', LockController]);

module.controller('ActiveTabController', ['backgroundPage', function (TW) {
    this.TW = TW
}]);

var WhitelistController = function (TW) {
    this.TW = TW;

    this.newWhitelistValue = "";

    this.addNewWhitelistValue = function () {
        TW.settings.addWhitelist(this.newWhitelistValue);
        this.newWhitelistValue = "";
    };

    this.removeWhitelist = function (index) {
        TW.settings.removeWhitelistByIndex(index)
    };
};

Object.defineProperty(WhitelistController.prototype, 'whitelist', {
    enumerable: true,
    configurable: false,
    get: function () {
        return this.TW.settings.get('whitelist')
    }
});

module.controller('WhitelistController', ['backgroundPage', WhitelistController]);

var SettingsController = function (TW) {
    this.TW = TW;
    this._minutesInactive = TW.settings.get('minutesInactive');
    this._minTabs = TW.settings.get('minTabs');
    this._maxExceededTime = TW.settings.get('maxExceededTime');

    this.resetMinutesInactive = function () {
        this._minutesInactive = TW.settings.get('minutesInactive');
    };

    this.resetMinTabs = function () {
        this._minTabs = TW.settings.get('minTabs');
    };

    this.resetMaxExceededTime = function () {
        this._maxExceededTime = TW.settings.get('maxExceededTime');
    }
};

Object.defineProperties(SettingsController.prototype, {
    minutesInactive: {
        enumerable: true,
        configurable: false,
        get: function () {
            return this._minutesInactive;
        },
        set: function (val) {
            this._minutesInactive = val;
            if (val !== undefined) {
                this.TW.settings.set('minutesInactive', val)
            }
        }
    },
    minTabs: {
        enumerable: true,
        configurable: false,
        get: function () {
            return this._minTabs;
        },
        set: function (val) {
            this._minTabs = val;
            if (val !== undefined) {
                this.TW.settings.set('minTabs', val)
            }
        }
    },
    maxExceededTime: {
        enumerable: true,
        get: function () {
            return this._maxExceededTime;
        },
        set: function (val) {
            this._maxExceededTime = val;
            if (val !== undefined) {
                this.TW.settings.set('maxExceededTime', val)
            }
        }
    },
    purgeClosedTabs: {
        enumerable: true,
        configurable: false,
        get: function () {
            return this.TW.settings.get('purgeClosedTabs');
        },
        set: function (val) {
            this.TW.settings.set('purgeClosedTabs', val)
        }
    },
    showBadgeCount: {
        enumerable: true,
        configurable: false,
        get: function () {
            return this.TW.settings.get('showBadgeCount');
        },
        set: function (val) {
            this.TW.settings.set('showBadgeCount', val)
        }
    },
    enableSync: {
        enumerable: true,
        configurable: false,
        get: function () {
            return this.TW.settings.enableSync;
        },
        set: function (val) {
            this.TW.settings.set('enableSync', val)
        }
    },
    removeCorralDupes: {
        enumerable: true,
        configurable: false,
        get: function () {
            return this.TW.settings.get('removeCorralDupes');
        },
        set: function (val) {
            this.TW.settings.set('removeCorralDupes', val)
        }
    },
    countPerWindow: {
        enumerable: true,
        configurable: false,
        get: function () {
            return this.TW.settings.get('countPerWindow');
        },
        set: function (val) {
            this.TW.settings.set('countPerWindow', val);
        }
    }
});

module.controller('SettingsController', ['backgroundPage', SettingsController]);
