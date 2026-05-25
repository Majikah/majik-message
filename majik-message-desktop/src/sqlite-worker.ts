// sqlite-worker.ts
import { MAJIKAH_SQL_SCHEMA_FULL_V_0 } from "@majikah/majik-message";
import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";

let promiser: any = null;
let dbId: string | null = null;
let ready = false;
const queue: MessageEvent[] = [];

const SCHEMA = MAJIKAH_SQL_SCHEMA_FULL_V_0;
const PRODUCT_CODE = "majik_message";

async function handleMessage(e: MessageEvent) {
  const { id, type, sql, params } = e.data;

  try {
    if (type === "run") {
      await promiser("exec", {
        dbId,
        sql,
        bind: params?.length ? params : undefined,
      });
      self.postMessage({ id, ok: true });
    }

    if (type === "get") {
      const result = await promiser("exec", {
        dbId,
        sql,
        bind: params?.length ? params : undefined,
        returnValue: "resultRows",
        rowMode: "object",
      });
      const row = result.result.resultRows?.[0] ?? null;
      self.postMessage({ id, ok: true, result: row });
    }

    if (type === "all") {
      const result = await promiser("exec", {
        dbId,
        sql,
        bind: params?.length ? params : undefined,
        returnValue: "resultRows",
        rowMode: "object",
      });
      self.postMessage({
        id,
        ok: true,
        result: result.result.resultRows ?? [],
      });
    }

    if (type === "exec") {
      const result = await promiser("exec", {
        dbId,
        sql,
        bind: params?.length ? params : undefined,
      });

      self.postMessage({
        id,
        ok: true,
        result: result.result,
      });
    }
  } catch (err: any) {
    console.log(err);
    self.postMessage({ id, ok: false, error: err.message });
  }
}

async function init() {
  promiser = await new Promise((resolve) => {
    const _promiser = sqlite3Worker1Promiser({
      onready: () => resolve(_promiser),
    });
  });

  const configResult = await promiser("config-get", {});
  const hasOPFS = configResult.result.vfsList?.includes("opfs");
  console.debug("OPFS available:", hasOPFS);

  const openResult = await promiser("open", {
    filename: hasOPFS
      ? `file:majikah_${PRODUCT_CODE}.db?vfs=opfs`
      : `file:majikah_${PRODUCT_CODE}.db?vfs=memdb`,
  });

  dbId = openResult.result.dbId;
  console.debug("DB opened:", {
    vfs: openResult.result.vfs, // should say "opfs"
    filename: openResult.result.filename, // should show the file path
  });
  await promiser("exec", { dbId, sql: SCHEMA });

  ready = true;
  for (const msg of queue) {
    await handleMessage(msg);
  }
  queue.length = 0;
}

init().catch((err) => console.error("SQLite init failed:", err));

self.onmessage = (e) => {
  if (!ready) queue.push(e);
  else handleMessage(e);
};
