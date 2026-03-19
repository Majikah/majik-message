import path, { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    plugins: [react(), tailwindcss()],

    clearScreen: false,

    server: {
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

    optimizeDeps: {
      exclude: isProd
        ? ["@majikah/majik-message", "@bokuweb/zstd-wasm"]
        : ["@bokuweb/zstd-wasm"],
    },
    esbuild: {
      target: "es2020",
    },

    assetsInclude: ["**/*.wasm"],

    publicDir: resolve(__dirname, "src/public"),

    build: {
      outDir: resolve(__dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
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
