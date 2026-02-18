import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./views/App.tsx";

import { MajikMessageJSON, MessageEnvelope } from "@majikah/majik-message";
import ReduxProvider from "../redux/ReduxProvider.tsx";
import ThemeProviderWrapper from "../globals/ThemeProviderWrapper.tsx";
import { base64EncodeUtf8 } from "../lib/majik-file-utils.ts";
import { MajikMessageWrapper } from "../components/majik-context-wrapper/MajikMessageWrapper.tsx";
import { MajikMessageDatabase } from "../components/majik-context-wrapper/majik-message-database.ts";
import { MajikahProvider } from "../components/majikah-session-wrapper/MajikahSessionWrapper.tsx";

console.log("[Majik Message] Content Script Initialized");

const container = document.createElement("div");
container.id = "crxjs-app";
document.body.appendChild(container);

let majikInstance: MajikMessageDatabase | null = null;

// main.tsx or content script
async function getMajik() {
  if (!majikInstance) {
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "getMajik" }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("[Majik] Get Majik Error", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(resp);
        }
      });
    });

    console.log("[Majik] Raw Response", response);
    if (response?.data) {
      const parsed = JSON.parse(response.data) as MajikMessageJSON;
      majikInstance = await MajikMessageDatabase.fromJSON(parsed);

      console.log(
        "[Majik] Reconstructed instance in content script",
        majikInstance,
      );
    }
  }
  return majikInstance;
}

async function requestDecryption(
  encryptedText: string,
  inputPassPhrase?: string,
): Promise<string> {
  const promptPassphrase = !!inputPassPhrase?.trim()
    ? inputPassPhrase
    : window.prompt(
        "Please enter your passphrase to unlock this message.\n\n" +
          "Make sure it's the passphrase associated with your account.",
        "",
      );

  const response = await new Promise<any>((resolve, reject) => {
    const base64Text = base64EncodeUtf8(encryptedText);
    chrome.runtime.sendMessage(
      {
        type: "decryptEnvelope",
        encryptedText: base64Text,
        passphrase: promptPassphrase,
      },
      (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("[Majik] Get Majik Error", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(resp);
        }
      },
    );
  });

  console.log("[Majik Decryption Request] Raw Response", response);

  if (!response?.text) {
    throw new Error("No text in response");
  }

  const decryptedText = response.text as string;
  return decryptedText;
}

async function requestScanningState(): Promise<void> {
  const response = await new Promise<any>((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "REQUEST_SCANNING_STATE" }, (resp) => {
      if (chrome.runtime.lastError) {
        console.warn("[Majik] Get Majik Error", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(resp);
      }
    });
  });

  console.log("[Majik Scanning Request] Raw Response", response);

  if (!response?.enabled) {
    console.warn("Scanning disabled. Skipping.");
    return;
  }

  if (!response?.passphrase?.trim()) {
    throw new Error("No passphrase in response");
  }

  const passphrase = response.passphrase as string;

  handleDecryptEverything(passphrase);

  return;
}
await waitForDomToSettle();
await requestScanningState();

// Listen for context-menu actions forwarded from the background worker
if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener(async (msg: any) => {
    console.log("[Majik Debug] Received message in content script:", msg);
    if (!msg?.type) return;

    switch (msg.type) {
      case "encrypt_selection":
        await handleEncryptSelection();
        break;
      case "replace_selection":
        if (msg.encrypted) replaceSelection(msg.encrypted);
        break;

      case "decrypt_selection":
        await handleDecryptSelection();
        break;
      case "decrypt_everything":
        await handleDecryptEverything();
        break;
      case "majik_context_alert":
        window.alert(msg.message || "");
        break;
    }
  });
}

async function handleEncryptSelection() {
  const majik = await getMajik();
  if (!majik) {
    console.log("[Majik Error] Majik Message instance not available.");
    return;
  }
  const selectedText = getActiveSelectionText();
  if (!selectedText) return;

  const encrypted = await majik.encryptTextForScanner(selectedText);
  if (!encrypted) return;
  replaceSelection(encrypted);
}

async function handleDecryptSelection() {
  const selectedText = getActiveSelectionText().trim();
  if (!MessageEnvelope.isEnvelopeCandidate(selectedText)) return;

  const plaintext = await requestDecryption(selectedText);
  replaceSelection(plaintext);
}

async function handleDecryptEverything(inputPassPhrase?: string) {
  const majik = await getMajik();
  if (!majik) return;

  if (isGmail()) {
    await handleDecryptEverythingGmail(inputPassPhrase);
    return;
  }

  console.log("[Majik Debug] handleDecryptEverything triggered");

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.nodeValue?.replace(/\u200B/g, "").trim();
        if (!text) return NodeFilter.FILTER_REJECT;

        return MessageEnvelope.isEnvelopeCandidate(text)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  const textNodes: Text[] = [];
  let current: Node | null;

  while ((current = walker.nextNode())) {
    textNodes.push(current as Text);
  }

  if (textNodes.length === 0) {
    console.log("No encrypted messages found on this page.");
    return;
  }

  console.log(`[Majik Debug] Found ${textNodes.length} encrypted text nodes`);

  const passphrase =
    inputPassPhrase ||
    window.prompt(
      "Please enter your passphrase to unlock messages.\n\n" +
        "Make sure it's the passphrase associated with your account.",
      "",
    );
  if (!passphrase?.trim()) return;

  await Promise.all(
    textNodes.map(async (textNode) => {
      const raw = textNode.nodeValue!;
      const cleaned = raw.replace(/\u200B/g, "");

      try {
        const plaintext = await requestDecryption(cleaned, passphrase);
        if (!plaintext) return;

        // 🔐 Replace ONLY the text node
        textNode.nodeValue = plaintext;
      } catch (err) {
        console.error("[Majik Debug] Failed to decrypt text node", err);
      }
    }),
  );
}

async function handleDecryptEverythingGmail(inputPassPhrase?: string) {
  console.log("[Majik Gmail] handleDecryptEverything triggered");

  // Scan page-wide elements (div, p, span)
  const containers = Array.from(document.body.querySelectorAll("div, p, span"));
  const candidates: { el: HTMLElement; text: string }[] = [];

  for (const el of containers) {
    const htmlEl = el as HTMLElement;
    let text = htmlEl.innerText || "";

    // Remove zero-width characters
    text = text.replace(/\u200B/g, "");

    if (MessageEnvelope.isEnvelopeCandidate(text)) {
      candidates.push({ el: htmlEl, text });
    }
  }

  if (candidates.length === 0) {
    window.alert("No encrypted messages found on this Gmail page.");
    return;
  }

  // Prompt passphrase once
  const passphrase =
    inputPassPhrase ||
    window.prompt("Please enter your passphrase to unlock messages.", "");
  if (!passphrase?.trim()) return;

  await Promise.all(
    candidates.map(async ({ el, text }) => {
      try {
        const plaintext = await requestDecryption(text, passphrase);
        if (!plaintext) return;

        // Replace content
        el.innerText = plaintext;
      } catch (err) {
        console.error("[Majik Gmail] Failed to decrypt element:", el, err);
      }
    }),
  );
}

/* =========================================================
   Selection helpers
========================================================= */

function getActiveSelectionText(): string {
  const el = document.activeElement;
  if (!el) return "";

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.substring(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  }

  return window.getSelection()?.toString() ?? "";
}

/* =========================================================
   Smart editor replacement (CORE)
========================================================= */

function replaceEditorSelection(el: HTMLElement, text: string) {
  el.focus();

  // 1️⃣ execCommand (best for Lexical)
  try {
    if (document.execCommand("insertText", false, text)) return;
  } catch {}

  // 2️⃣ Clipboard paste (very reliable)
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    const paste = new ClipboardEvent("paste", {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    if (el.dispatchEvent(paste)) return;
  } catch {}

  // 3️⃣ beforeinput (fire-and-hope)
  try {
    el.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "insertText",
        data: text,
        bubbles: true,
        cancelable: true,
      }),
    );
    return;
  } catch {}

  // 4️⃣ DOM Range fallback
  replaceContentEditableSelection(el, text);
}

function replaceContentEditableSelection(el: HTMLElement, text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);

  range.setStartAfter(node);
  range.collapse(true);

  selection.removeAllRanges();
  selection.addRange(range);

  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

/* =========================================================
   Replace dispatcher
========================================================= */

function replaceSelection(text: string) {
  const el = document.activeElement;
  if (!el) return;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.setRangeText(text, el.selectionStart ?? 0, el.selectionEnd ?? 0, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (el instanceof HTMLElement && el.isContentEditable) {
    replaceEditorSelection(el, text);
  }
}

createRoot(container).render(
  <StrictMode>
    <ReduxProvider>
      <ThemeProviderWrapper>
        <MajikahProvider>
          <MajikMessageWrapper>
            <App />
          </MajikMessageWrapper>
        </MajikahProvider>
      </ThemeProviderWrapper>
    </ReduxProvider>
  </StrictMode>,
);

function isGmail(): boolean {
  return isGmailUrl() && (isGmailDom() || hasGmailTextFragmentation());
}

function isGmailUrl(): boolean {
  return (
    location.hostname === "mail.google.com" ||
    location.hostname.endsWith(".mail.google.com")
  );
}

function isGmailDom(): boolean {
  return !!(
    (document.querySelector('div[role="main"]') &&
      document.querySelector('div[aria-label="Message Body"]')) ||
    document.querySelector('div[dir="ltr"]')
  );
}

function hasGmailTextFragmentation(): boolean {
  return document.body.querySelector("wbr") !== null;
}

function waitForDomToSettle(timeout = 3000, idle = 300): Promise<void> {
  return new Promise((resolve) => {
    let lastMutation = Date.now();

    const observer = new MutationObserver(() => {
      lastMutation = Date.now();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const check = () => {
      if (Date.now() - lastMutation > idle) {
        observer.disconnect();
        resolve();
      }
    };

    const interval = setInterval(check, 100);

    setTimeout(() => {
      clearInterval(interval);
      observer.disconnect();
      resolve(); // fail-safe
    }, timeout);
  });
}
