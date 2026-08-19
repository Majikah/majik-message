import { MajikMessageChatJSON } from "../../database/chat/types";

import { SQLiteDatabase } from "../sqlite/sql-db-manager";

import { MAJIKAH_SQL_TABLES } from "../sql-schema";
import { StorageSource } from "../storage-adapter";
import { MajikMessageChatStorageAdapter } from "./_types";

export class SQLiteMessageChatsAdapter implements MajikMessageChatStorageAdapter {
  constructor(private db: SQLiteDatabase) {}

  async save(
    message: MajikMessageChatJSON,
    source: StorageSource = `local`,
  ): Promise<void> {
    const resolvedSource: StorageSource = source ?? `local`;

    await this.db.run(
      `INSERT OR REPLACE INTO ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} 
     (id, json, created_at, source)
     VALUES (?, ?, ?, ?)`,
      [message.id, JSON.stringify(message), message.timestamp, resolvedSource],
    );
  }

  async getById(
    id: string,
    source?: StorageSource,
  ): Promise<MajikMessageChatJSON | null> {
    const row = source
      ? await this.db.get<{ json: string }>(
          `SELECT json FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE id = ? AND source = ?`,
          [id, source],
        )
      : await this.db.get<{ json: string }>(
          `SELECT json FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE id = ?`,
          [id],
        );

    return row ? JSON.parse(row.json) : null;
  }

  async list(source?: StorageSource): Promise<MajikMessageChatJSON[]> {
    const rows = source
      ? await this.db.all<{ json: string }>(
          `SELECT json FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE source = ?`,
          [source],
        )
      : await this.db.all<{ json: string }>(
          `SELECT json FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS}`,
        );

    return rows.map((r) => JSON.parse(r.json));
  }

  async remove(id: string, source?: StorageSource): Promise<boolean> {
    const exists = await this.exists(id, source);
    if (!exists) return false;

    if (source) {
      await this.db.run(
        `DELETE FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE id = ? AND source = ?`,
        [id, source],
      );
    } else {
      await this.db.run(`DELETE FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE id = ?`, [id]);
    }

    return true;
  }

  async clear(source?: StorageSource): Promise<void> {
    if (source) {
      await this.db.run(`DELETE FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE source = ?`, [
        source,
      ]);
    } else {
      await this.db.run(`DELETE FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS}`);
    }
  }

  async count(source?: StorageSource): Promise<number> {
    const row = source
      ? await this.db.get<{ n: number }>(
          `SELECT COUNT(*) as n FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE source = ?`,
          [source],
        )
      : await this.db.get<{ n: number }>(
          `SELECT COUNT(*) as n FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS}`,
        );

    return row?.n ?? 0;
  }

  async exists(id: string, source?: StorageSource): Promise<boolean> {
    const row = source
      ? await this.db.get(
          `SELECT 1 FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE id = ? AND source = ?`,
          [id, source],
        )
      : await this.db.get(`SELECT 1 FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE id = ?`, [id]);

    return !!row;
  }

  async bulkSave(
    messages: MajikMessageChatJSON[],
    source: StorageSource = `local`,
  ): Promise<void> {
    if (messages.length === 0) return;

    const resolvedSource: StorageSource = source ?? `local`;

    await this.db.transaction(async (tx) => {
      for (const msg of messages) {
        await tx.run(
          `INSERT OR REPLACE INTO ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} 
         (id, json, created_at, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
          [msg.id, JSON.stringify(msg), msg.timestamp, resolvedSource],
        );
      }
    });
  }

  async bulkRemove(ids: string[], source?: StorageSource): Promise<void> {
    if (ids.length === 0) return;

    await this.db.transaction(async (tx) => {
      for (const id of ids) {
        if (source) {
          await tx.run(
            `DELETE FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE id = ? AND source = ?`,
            [id, source],
          );
        } else {
          await tx.run(`DELETE FROM ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} WHERE id = ?`, [id]);
        }
      }
    });
  }
}
