// plugins/sqliteWasm.ts
import type { Plugin } from "vite";

export interface SqliteWasmPluginOptions {
  assetsDir?: string;
}

export function sqliteWasm(options: SqliteWasmPluginOptions = {}): Plugin {
  const assetsDir = options.assetsDir ?? "assets";

  return {
    name: "sqlite-wasm-no-hash",
    renderChunk(code) {
      return {
        code: code
          .replace(/sqlite-worker-[a-zA-Z0-9_-]+\.js/g, "sqlite-worker.js")
          .replace(
            /sqlite3-opfs-async-proxy-[a-zA-Z0-9_-]+\.js/g,
            "sqlite3-opfs-async-proxy.js",
          )
          .replace(/sqlite3-[a-zA-Z0-9_-]+\.wasm/g, "sqlite3.wasm"),
        map: null,
      };
    },

    generateBundle(_, bundle) {
      const renameMap: Record<string, string> = {
        "sqlite-worker": `${assetsDir}/sqlite-worker.js`,
        "sqlite3-opfs-async-proxy": `${assetsDir}/sqlite3-opfs-async-proxy.js`,
        sqlite3: `${assetsDir}/sqlite3.wasm`,
      };

      for (const [fileName, chunk] of Object.entries(bundle)) {
        for (const [key, newName] of Object.entries(renameMap)) {
          const matches =
            fileName.includes(key) &&
            (fileName.endsWith(".js") || fileName.endsWith(".wasm"));

          if (!matches) continue;

          if (fileName !== newName) {
            bundle[newName] = {
              ...chunk,
              fileName: newName,
            } as any;

            delete bundle[fileName];
          }
        }
      }
    },
  };
}
