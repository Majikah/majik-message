import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest(() => {
  const isFirefox = process.env.BROWSER === "firefox";

  return {
    manifest_version: 3,
    name: "Majik Message",
    version: pkg.version,
    version_name: "Early Access",
    description:
      "Encrypt and decrypt messages on any website. Secure chats with keypairs and seed-based accounts. Open source.",
    icons: {
      16: "public/Logo_MajikMessage_16px.png",
      32: "public/Logo_MajikMessage_32px.png",
      48: "public/Logo_MajikMessage_48px.png",
      128: "public/Logo_MajikMessage_128px.png",
      256: "public/Logo_MajikMessage_256px.png",
    },
    minimum_chrome_version: "114",
    commands: {
      toggle_sidepanel: {
        suggested_key: {
          default: "Ctrl+M",
          mac: "Command+M",
        },
        description: "Toggle Majik Message side panel",
      },
    },

    homepage_url: "https://thezelijah.world/tools/communication-majik-message",
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none';",
    },

    action: {
      default_icon: {
        16: "public/Logo_MajikMessage_16px.png",
        32: "public/Logo_MajikMessage_32px.png",
        48: "public/Logo_MajikMessage_48px.png",
        128: "public/Logo_MajikMessage_128px.png",
        256: "public/Logo_MajikMessage_256px.png",
      },
      default_popup: "src/popup/index.html",
    },

    permissions: ["sidePanel", "contextMenus", "scripting", "storage"],
    host_permissions: ["https://*/*", "http://*/*", "chrome-extension://*/*"],

    background: isFirefox
      ? {
          scripts: ["src/extension/background.ts"],
          type: "module",
        }
      : {
          service_worker: "src/extension/background.ts",
          type: "module",
        },

    content_scripts: [
      {
        js: ["src/content/main.tsx"],
        matches: ["<all_urls>"],
      },
    ],

    side_panel: {
      default_path: "src/sidepanel/index.html",
    },
  };
});
