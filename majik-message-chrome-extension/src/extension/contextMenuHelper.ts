// Helper to register a context menu entry for encrypt-and-replace.
// This is a small helper the extension background can import and call.
export function registerEncryptContextMenu(menuId = "majik_encrypt") {
  if (typeof chrome === "undefined" || !chrome.contextMenus) {
    console.warn("Chrome contextMenus API not available in this environment");
    return;
  }

  try {
    chrome.contextMenus.create({
      id: menuId,
      title: "Encrypt with MajikMessage",
      contexts: ["selection"],
    });
  } catch (e) {
    // ignore duplicates
  }
}

export function onEncryptMenuClick(
  handler: (info: any, tab: chrome.tabs.Tab) => void
) {
  if (typeof chrome === "undefined" || !chrome.contextMenus) return;
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "majik_encrypt" && !!tab) handler(info, tab);
  });
}

export function registerDecryptContextMenu(menuId = "majik_decrypt") {
  if (typeof chrome === "undefined" || !chrome.contextMenus) return;
  try {
    chrome.contextMenus.create({
      id: menuId,
      title: "Decrypt with MajikMessage",
      contexts: ["selection"],
    });
  } catch (e) {
    // ignore duplicates
  }
}

export function onDecryptMenuClick(
  handler: (info: any, tab: chrome.tabs.Tab) => void
) {
  if (typeof chrome === "undefined" || !chrome.contextMenus) return;
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "majik_decrypt" && !!tab) handler(info, tab);
  });
}
