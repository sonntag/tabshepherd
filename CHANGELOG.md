##1.0

* CHANGED: Rebranded Tab Wrangler as Tab Shepherd
* CHANGED: New polished layout
* CHANGED: Auto-lock options moved to it's own tab
* CHANGED: "Clear closed tabs list on quit" defaults to false
* CHANGED: Brand new rewritten tab manager with the following improvements:
  * UPDATED: Does not run a tab close process every 5 seconds
  * FIX: Tab replace event is handled properly
  * FIX: Locked tabs always remain locked (even after tab replace)
  * FIX: Locked tabs can be unlocked
  * FIX: Closed tab count updates instantly when it changes (instead of every 6 seconds)
  * FIX: Tabs close in the order that they were last accessed
  * CHANGED: Pinned tabs are not counted towards the min tabs count
* ADDED: Option to disable syncing of Tab Shepherd settings between chrome browsers
* ADDED: Clear items from corral individually