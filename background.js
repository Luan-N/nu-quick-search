const MENU_ID = "search-on-novelupdates";
const PENDING_QUERY_KEY = "pendingSelectedQuery";

function normalizeSelection(value) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Search Novel Updates for "%s"',
      contexts: ["selection"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  const query = normalizeSelection(info.selectionText);
  if (!query) {
    return;
  }

  await chrome.storage.local.set({
    [PENDING_QUERY_KEY]: query,
  });

  if (typeof chrome.action?.openPopup === "function") {
    try {
      await chrome.action.openPopup();
    } catch (error) {
      console.warn("Could not open popup automatically:", error);
    }
  }
});
