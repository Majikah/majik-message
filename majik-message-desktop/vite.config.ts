import path, { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sqliteWasm } from "./plugins/sqlite-wasm";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    plugins: [
      react(),
      tailwindcss(),
      sqliteWasm(),
      // {
      //   name: "sqlite-wasm-no-hash",
      //   renderChunk(code, chunk) {
      //     // Apply to ALL chunks, not just sqlite-worker chunks
      //     return {
      //       code: code
      //         .replace(/sqlite-worker-[a-zA-Z0-9_-]+\.js/g, "sqlite-worker.js")
      //         .replace(
      //           /sqlite3-opfs-async-proxy-[a-zA-Z0-9_-]+\.js/g,
      //           "sqlite3-opfs-async-proxy.js",
      //         )
      //         .replace(/sqlite3-[a-zA-Z0-9_-]+\.wasm/g, "sqlite3.wasm"),
      //       map: null,
      //     };
      //   },
      //   generateBundle(_, bundle) {
      //     for (const [fileName, chunk] of Object.entries(bundle)) {
      //       if (fileName.includes("sqlite3") && fileName.endsWith(".wasm")) {
      //         // rename it in the bundle to remove hash
      //         const newName = "assets/sqlite3.wasm";
      //         if (fileName !== newName) {
      //           bundle[newName] = { ...chunk, fileName: newName } as any;
      //           delete bundle[fileName];
      //         }
      //       }

      //       // Fix sqlite3-opfs-async-proxy.js
      //       if (
      //         fileName.includes("sqlite3-opfs-async-proxy") &&
      //         fileName.endsWith(".js")
      //       ) {
      //         const newName = "assets/sqlite3-opfs-async-proxy.js";
      //         if (fileName !== newName) {
      //           bundle[newName] = { ...chunk, fileName: newName } as any;
      //           delete bundle[fileName];
      //         }
      //       }

      //       if (fileName.match(/sqlite-worker-\w+\.js$/)) {
      //         const newName = "assets/sqlite-worker.js";
      //         if (fileName !== newName) {
      //           bundle[newName] = { ...chunk, fileName: newName } as any;
      //           delete bundle[fileName];
      //         }
      //       }
      //     }
      //   },
      // },
    ],

    clearScreen: false,

    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
      fs: {
        allow: [
          path.resolve(__dirname),
          path.resolve(__dirname, "src"),
          path.resolve(__dirname, "node_modules"),
          path.resolve(__dirname, "../majik-message-sdk"),
          path.resolve(__dirname, "../majik-message-sdk/node_modules"),
        ],
      },
    },

    preview: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },

    optimizeDeps: {
      exclude: isProd
        ? [
            "@majikah/majik-message",
            "@bokuweb/zstd-wasm",
            "@sqlite.org/sqlite-wasm",
          ]
        : ["@bokuweb/zstd-wasm", "@sqlite.org/sqlite-wasm"],
    },
    esbuild: {
      target: "es2020",
    },

    assetsInclude: ["**/*.wasm"],

    publicDir: resolve(__dirname, "public"),

    build: {
      outDir: resolve(__dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
        external: [], // don't externalize
        output: {
          assetFileNames: (assetInfo) => {
            // Don't hash sqlite wasm
            if (assetInfo.name?.endsWith(".wasm")) {
              return "assets/[name][extname]";
            }
            return "assets/[name]-[hash][extname]";
          },
          chunkFileNames: (chunkInfo) => {
            if (chunkInfo.name?.includes("sqlite")) {
              return "assets/[name].js";
            }
            return "assets/[name]-[hash].js";
          },
        },
      },
      // Tauri uses Chromium so you can target modern output
      target: "es2020",
    },

    base: "./",

    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@src": resolve(__dirname, "src"),
        "@majikah/majik-message-client": isProd
          ? resolve(__dirname, "node_modules/@majikah/majik-message")
          : resolve(__dirname, "../majik-message-sdk/src/index.ts"), // 👈 point to file, not folder
      },
    },
  };
});
