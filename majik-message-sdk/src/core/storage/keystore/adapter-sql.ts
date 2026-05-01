import { MajikKeyJSON } from "@majikah/majik-key";
import { MajikKeyStorageAdapter } from "./_types";
import { SQLiteDatabase } from "../sql-db-manager";

export class SQLiteKeystoreAdapter implements MajikKeyStorageAdapter {
  constructor(private db: SQLiteDatabase) {}

  async save(key: MajikKeyJSON): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO majik_keys 
       (id, json, timestamp, public_key)
       VALUES (?, ?, ?, ?)`,
      [
        key.id,
        JSON.stringify(key),
        key.timestamp ?? new Date().toISOString(),
        key.publicKey,
      ],
    );
  }

  async getById(id: string): Promise<MajikKeyJSON | null> {
    const row = await this.db.get<{ json: string }>(
      "SELECT json FROM majik_keys WHERE id = ?",
      [id],
    );

    return row ? JSON.parse(row.json) : null;
  }

  async list(): Promise<MajikKeyJSON[]> {
    const rows = await this.db.all<{ json: string }>(
      "SELECT json FROM majik_keys",
    );

    return rows.map((r) => JSON.parse(r.json));
  }

  async remove(id: string): Promise<boolean> {
    const exists = await this.exists(id);
    if (!exists) return false;

    await this.db.run("DELETE FROM majik_keys WHERE id = ?", [id]);

    return true;
  }

  async clear(): Promise<void> {
    await this.db.run("DELETE FROM majik_keys");
  }

  async count(): Promise<number> {
    const row = await this.db.get<{ n: number }>(
      "SELECT COUNT(*) as n FROM majik_keys",
    );

    return row?.n ?? 0;
  }

  async exists(id: string): Promise<boolean> {
    const row = await this.db.get("SELECT 1 FROM majik_keys WHERE id = ?", [
      id,
    ]);

    return !!row;
  }

  async bulkSave(keys: MajikKeyJSON[]): Promise<void> {
    if (keys.length === 0) return;

    await this.db.transaction(async (tx) => {
      for (const g of keys) {
        await tx.run(
          `INSERT OR REPLACE INTO majik_keys 
           (id, json, timestamp, public_key)
           VALUES (?, ?, ?, ?)`,
          [
            g.id,
            JSON.stringify(g),
            g.timestamp ?? new Date().toISOString(),
            g.publicKey,
          ],
        );
      }
    });
  }

  async bulkRemove(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.db.transaction(async (tx) => {
      for (const id of ids) {
        await tx.run("DELETE FROM majik_keys WHERE id = ?", [id]);
      }
    });
  }
}
