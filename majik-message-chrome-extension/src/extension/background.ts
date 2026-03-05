// Background service worker for MajikMessage
// Handles dynamic context menu actions and forwards messages to content script

import {
  MajikKeyStore,
  EnvelopeCache,
  MessageEnvelope,
} from "@majikah/majik-message";

import { base64DecodeUtf8 } from "../lib/majik-file-utils";
import { MajikMessageDatabase } from "../components/majik-context-wrapper/majik-message-database";

console.log("MajikMessage background worker starting");

let majikInstance: MajikMessageDatabase | null = null;
let scanningEnabled = false;
let globalPassphrase: string | null = null;

async function initMajik() {
  if (!majikInstance) {
    majikInstance =
      await MajikMessageDatabase.loadOrCreate<MajikMessageDatabase>(
        {
          keyStore: MajikKeyStore,
          envelopeCache: new EnvelopeCache(undefined, "default"),
        },
        "default",
      );
  }

  return majikInstance;
}

// Fetch contacts dynamically
async function getContacts(): Promise<string[]> {
  const majik = await initMajik();

  return await Promise.all(
    majik.listContacts(false).map(async (c) => {
      const pubkey = await c.getPublicKeyBase64();
      return c.meta?.label || pubkey;
    }) || [],
  );
}

// Create context menus on startup
async function createMenus() {
  chrome.contextMenus.removeAll(async () => {
    // Decrypt menu always available
    chrome.contextMenus.create({
      id: "majik_decrypt",
      title: "Decrypt",
      contexts: ["selection", "editable"],
    });

    chrome.contextMenus.create({
      id: "majik_decrypt_page",
      title: "Decrypt Page",
      contexts: ["page"],
    });

    // Encrypt menu + subitems
    chrome.contextMenus.create({
      id: "majik_encrypt",
      title: "Encrypt",
      contexts: ["editable"],
    });

    // Self submenu
    chrome.contextMenus.create({
      id: "encrypt_self",
      parentId: "majik_encrypt",
      title: "Self",
      contexts: ["selection", "editable"],
    });

    // Separator
    chrome.contextMenus.create({
      id: "encrypt_separator",
      type: "separator",
      parentId: "majik_encrypt",
    });

    // Contact submenus
    const contacts = await getContacts();
    contacts.forEach((c, i) => {
      chrome.contextMenus.create({
        id: `encrypt_contact_${i}`,
        parentId: "majik_encrypt",
        title: c,
        contexts: ["selection", "editable"],
      });
    });
  });
}

// IIFE pattern
(async () => {
  await loadScannerState();
  console.log("[Majik] Background initialized with scanner state");

  // Optionally create menus immediately
  await createMenus();
})();

// Create menus on install and startup
chrome.runtime.onInstalled.addListener(createMenus);

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("Clicked menu item:", info.menuItemId, "tab:", tab?.id);
  try {
    if (!tab?.id) return;

    if (info.menuItemId === "majik_decrypt") {
      try {
        console.log("[Majik Debug] Sending Decrypt Message");
        const sent = await chrome.tabs.sendMessage(tab.id, {
          type: "decrypt_selection",
        });
        console.log("[Majik Debug] Message sent to tab:", sent);
      } catch (err) {
        console.error("[Majik Debug] Failed to send message:", err);
      }
      return;
    }

    if (info.menuItemId === "majik_decrypt_page") {
      try {
        console.log("[Majik Debug] Sending Decrypt Everything");
        const sent = await chrome.tabs.sendMessage(tab.id, {
          type: "decrypt_everything",
        });
        console.log("[Majik Debug] Message sent to tab:", sent);
      } catch (err) {
        console.error("[Majik Debug] Failed to send message:", err);
      }
      return;
    }

    // Determine encryption target
    let target: string | undefined;
    if (info.menuItemId === "encrypt_self") {
      target = "self";
    } else if (info.menuItemId.toString().startsWith("encrypt_contact_")) {
      const index = parseInt(
        info.menuItemId.toString().replace("encrypt_contact_", ""),
      );
      const contacts = await getContacts();
      target = contacts[index];
    }


    if (target) {
      const majik = await initMajik();

      // Get current selection text
      const [tabText] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => window.getSelection()?.toString() ?? "",
      });

      const selectionText = tabText.result || "";
      if (!selectionText) return;

      // Encrypt selection
      const encrypted = await majik.encryptForTarget(target, selectionText);

      if (encrypted) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "replace_selection",
          encrypted, // encrypted text
        });
      }
    } else {
      console.warn("Unknown encrypt menu item:", info.menuItemId);
    }
  } catch (e) {
    console.error("Context menu click handler error:", e);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log("[Majik Debug] Received message in background server:", msg);

  switch (msg.type) {
    case "getMajik": {
      // kick off async logic
      initMajik()
        .then((majik) => majik.toJSON()) // ✅ call async toJSON
        .then((jsonData) => {
          sendResponse({ data: JSON.stringify(jsonData) });
        })
        .catch((err) => {
          console.error("[Majik] Get Majik Error", err);
          sendResponse({ error: err.message || err });
        });

      // tell Chrome we will respond asynchronously
      return true;
    }
    case "decryptEnvelope": {
      console.log(
        "[Majik Message] Received decryption request in background server:",
        msg.encryptedText,
      );
      if (!msg?.encryptedText) {
        console.error("No text to decrypt");
        return;
      }

      if (!msg?.passphrase) {
        console.error("No passphrase provided");
        return;
      }

      const encryptedText = base64DecodeUtf8(msg.encryptedText);
      const passphrase = msg.passphrase;

      initMajik()
        .then(async (majik) => {
          const envelope = MessageEnvelope.fromMatchedString(encryptedText);

          const activeAccount = majik.getActiveAccount();
          if (!activeAccount) {
            throw new Error("No active account found");
          }
          console.log("[Majik] Account found", activeAccount.id);

          // return the Promise from unlockIdentity for next then
          return MajikKeyStore.unlockIdentity(
            activeAccount.id,
            passphrase,
          ).then(() => ({ majik, envelope }));
        })
        .then(({ majik, envelope }) => {
          console.log("[Majik] Identity unlocked", passphrase);

          // return the Promise from decryptEnvelope
          return majik.decryptEnvelope(envelope);
        })
        .then((decryptedString) => {
          sendResponse({ text: decryptedString });
        })
        .catch((err) => {
          console.error("[Majik] Envelope Decryption Request Error", err);
          sendResponse({ error: err.message || err });
        });

      // tell Chrome we will respond asynchronously
      return true;
    }
    case "ENABLE_SCANNING": {
      scanningEnabled = true;
      globalPassphrase = msg.passphrase;
      saveScannerState().then(() => {
        console.log("Scanner state saved");
      });
      // notify all tabs to start decrypting
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "decrypt_everything",
              passphrase: globalPassphrase,
            });
          }
        }
      });
      return true;
    }
    case "DISABLE_SCANNING": {
      scanningEnabled = false;
      globalPassphrase = null;
      saveScannerState().then(() => {
        console.log("Scanner state saved");
      });
      return true;
    }
    case "REQUEST_SCANNING_STATE": {
      sendResponse({ enabled: scanningEnabled, passphrase: globalPassphrase });
      return true;
    }

    default: {
      return true;
    }
  }
});

// Save current scanning state
async function saveScannerState() {
  try {
    await chrome.storage.session.set({
      scanningEnabled,
      globalPassphrase,
    });
    console.log("[Majik] Scanner state saved");
  } catch (err) {
    console.error("[Majik] Failed to save scanner state", err);
  }
}

// Load scanning state on startup
async function loadScannerState() {
  try {
    const result = await chrome.storage.session.get([
      "scanningEnabled",
      "globalPassphrase",
    ]);
    scanningEnabled = (result.scanningEnabled as boolean) ?? false;
    globalPassphrase = (result.globalPassphrase as string) ?? null;
    console.log("[Majik] Scanner state loaded", {
      scanningEnabled,
      globalPassphrase,
    });
  } catch (err) {
    console.error("[Majik] Failed to load scanner state", err);
    scanningEnabled = false;
    globalPassphrase = null;
  }
}
