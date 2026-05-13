// plugins/sqliteWasm.ts
import type { Plugin } from "vite";

export interface SqliteWasmPluginOptions {
  assetsDir?: string;
}

export function sqliteWasm(options: SqliteWasmPluginOptions = {}): Plugin {
  const assetsDir = options.assetsDir ?? "assets";

  const renameAsset = (
    bundle: Record<string, any>,
    oldName: string,
    newName: string,
  ) => {
    if (oldName === newName) return;

    bundle[newName] = {
      ...bundle[oldName],
      fileName: newName,
    };

    delete bundle[oldName];
  };

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
      for (const fileName of Object.keys(bundle)) {
        // sqlite3.wasm
        if (/^assets\/sqlite3-[a-zA-Z0-9_-]+\.wasm$/.test(fileName)) {
          renameAsset(bundle, fileName, `${assetsDir}/sqlite3.wasm`);

          continue;
        }

        // sqlite3-opfs-async-proxy.js
        if (
          /^assets\/sqlite3-opfs-async-proxy-[a-zA-Z0-9_-]+\.js$/.test(fileName)
        ) {
          renameAsset(
            bundle,
            fileName,
            `${assetsDir}/sqlite3-opfs-async-proxy.js`,
          );

          continue;
        }

        // sqlite-worker.js
        if (/^assets\/sqlite-worker-[a-zA-Z0-9_-]+\.js$/.test(fileName)) {
          renameAsset(bundle, fileName, `${assetsDir}/sqlite-worker.js`);
        }
      }
    },
  };
}
