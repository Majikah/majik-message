import type { MAJIK_API_RESPONSE } from "../types";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../utils/utilities";
import { MessageEnvelope } from "./message-envelope";

/* -------------------------------
 * Errors
 * ------------------------------- */
export class EnvelopeCacheError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "EnvelopeCacheError";
    this.cause = cause;
  }
}

/* -------------------------------
 * EnvelopeCache Config
 * ------------------------------- */
export interface EnvelopeCacheConfig {
  dbName?: string; // defaults to 'MajikEnvelopeDB'
  storeName?: string; // defaults to 'envelopes'
  maxEntries?: number; // optional, for cleanup
  memoryCacheSize?: number; // optional, default 100 envelopes
}

/* -------------------------------
 * EnvelopeCache JSON Shape
 * ------------------------------- */
export interface EnvelopeCacheJSON {
  config: EnvelopeCacheConfig;
  items: Array<EnvelopeCacheItemJSON>;
}

export interface EnvelopeCacheItemJSON {
  id: string;
  base64Payload: string;
  timestamp: number;
  source?: string;
}

export interface EnvelopeCacheItem {
  id: string;
  envelope: MessageEnvelope;
  timestamp: number;
  source?: string;
  message?: string;
}

/* -------------------------------
 * EnvelopeCache
 * ------------------------------- */
export class EnvelopeCache {
  // private userProfile: string = "default";

  private dbPromise: Promise<IDBDatabase>;
  private dbName: string;
  private storeName: string;
  private maxEntries?: number;

  // In-memory cache
  private memoryCache: Map<string, MessageEnvelope>;
  private memoryCacheSize: number;

  constructor(config?: EnvelopeCacheConfig, userProfile: string = "default") {
    this.dbName = config?.dbName || `MajikEnvelopeDB_${userProfile}`;
    this.storeName = config?.storeName || "envelopes";
    this.maxEntries = config?.maxEntries;
    this.memoryCacheSize = config?.memoryCacheSize || 100;
    this.memoryCache = new Map();

    // this.userProfile = userProfile || "default";

    this.dbPromise = this.initDB();
  }

  /* -------------------------------
   * IndexedDB Initialization
   * ------------------------------- */
  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp");
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new EnvelopeCacheError("Failed to open IndexedDB", request.error),
        );
    });
  }

  /* -------------------------------
   * Generate unique ID for envelope (SHA-256)
   * ------------------------------- */
  private async getEnvelopeId(envelope: MessageEnvelope): Promise<string> {
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      envelope.encryptedBlob,
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* -------------------------------
   * Save envelope to cache (IDB + memory)
   * -------------------------------
   */
  async set(envelope: MessageEnvelope, source?: string): Promise<void> {
    const id = await this.getEnvelopeId(envelope);

    try {
      // Add to memory cache
      this.memoryCache.set(id, envelope);
      if (this.memoryCache.size > this.memoryCacheSize) {
        // Remove oldest entry
        const firstKey = this.memoryCache.keys().next().value;
        if (firstKey !== undefined) {
          this.memoryCache.delete(firstKey);
        }
      }

      // Persist to IndexedDB
      const db = await this.dbPromise;
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const timestamp = Date.now();

      await new Promise<void>((resolve, reject) => {
        const req = store.put({ id, envelope, timestamp, source });
        req.onsuccess = () => resolve();
        req.onerror = () =>
          reject(new EnvelopeCacheError("Failed to save envelope", req.error));
      });

      // Optional: enforce maxEntries in IDB
      if (this.maxEntries) await this.enforceMaxEntries();
    } catch (err) {
      console.error("EnvelopeCache set error:", err);
      throw err;
    }
  }

  /* -------------------------------
   * List recent envelopes with pagination (most recent first)
   * Returns array of objects: { id, envelope, timestamp, source }
   * -------------------------------
   */
  async listRecent(offset = 0, limit = 50): Promise<Array<EnvelopeCacheItem>> {
    const results: Array<EnvelopeCacheItem> = [];
    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const index = store.index("timestamp");

      // Iterate newest first
      const req = index.openCursor(null, "prev");

      let skipped = 0;
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (!cursor) return resolve();
          if (skipped < offset) {
            skipped++;
            cursor.continue();
            return;
          }
          if (results.length < limit) {
            const val = cursor.value as any;

            const envelope = new MessageEnvelope(val.envelope.encryptedBlob); // wrap here

            results.push({
              id: val.id,
              envelope: envelope,
              timestamp: val.timestamp,
              source: val.source,
            });
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () =>
          reject(
            new EnvelopeCacheError(
              "Failed to list recent envelopes",
              req.error,
            ),
          );
      });
    } catch (err) {
      console.error("EnvelopeCache listRecent error:", err);
    }
    return results;
  }

  /* -------------------------------
   * Get envelope (checks memory first)
   * ------------------------------- */
  async get(envelope: MessageEnvelope): Promise<MessageEnvelope | undefined> {
    const id = await this.getEnvelopeId(envelope);

    // 1️⃣ Try memory cache
    if (this.memoryCache.has(id)) return this.memoryCache.get(id);

    // 2️⃣ Fallback to IndexedDB
    const dbEnvelope = await this.getById(id);
    if (dbEnvelope) {
      // Populate memory cache
      this.memoryCache.set(id, dbEnvelope);
      if (this.memoryCache.size > this.memoryCacheSize) {
        const firstKey = this.memoryCache.keys().next().value;
        if (firstKey !== undefined) {
          this.memoryCache.delete(firstKey);
        }
      }
    }
    return dbEnvelope;
  }

  /* -------------------------------
   * Get envelope by ID directly
   * ------------------------------- */
  async getById(id: string): Promise<MessageEnvelope | undefined> {
    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);

      return await new Promise<MessageEnvelope | undefined>(
        (resolve, reject) => {
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result?.envelope);
          req.onerror = () =>
            reject(new EnvelopeCacheError("Failed to get envelope", req.error));
        },
      );
    } catch (err) {
      console.error("EnvelopeCache getById error:", err);
      return undefined;
    }
  }

  /* -------------------------------
   * Check if envelope exists
   * ------------------------------- */
  async has(envelope: MessageEnvelope): Promise<boolean> {
    const id = await this.getEnvelopeId(envelope);

    if (this.memoryCache.has(id)) return true;

    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);

      return await new Promise<boolean>((resolve) => {
        const req = store.getKey(id);
        req.onsuccess = () => resolve(req.result !== undefined);
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.error("EnvelopeCache has error:", err);
      return false;
    }
  }

  /* -------------------------------
   * Delete envelope (memory + IDB)
   * ------------------------------- */
  async delete(envelope: MessageEnvelope): Promise<void> {
    const id = await this.getEnvelopeId(envelope);

    // Remove from memory
    this.memoryCache.delete(id);

    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () =>
          reject(
            new EnvelopeCacheError("Failed to delete envelope", req.error),
          );
      });
    } catch (err) {
      console.error("EnvelopeCache delete error:", err);
      throw err;
    }
  }

  /* -------------------------------
   * Delete all envelopes by fingerprint
   * ------------------------------- */
  async deleteByFingerprint(fingerprint: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);

      // First, collect all IDs to delete
      const idsToDelete: string[] = [];

      const cursorReq = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (!cursor) return resolve();

          const val = cursor.value as { id: string; envelope: MessageEnvelope };
          const env = new MessageEnvelope(val.envelope.encryptedBlob);

          const envelopeFingerprint = env.extractFingerprint();

          if (envelopeFingerprint === fingerprint) {
            idsToDelete.push(val.id);
          }
          cursor.continue();
        };
        cursorReq.onerror = () =>
          reject(
            new EnvelopeCacheError(
              "Failed to iterate envelopes",
              cursorReq.error,
            ),
          );
      });

      // Delete from IndexedDB and memory cache
      for (const id of idsToDelete) {
        await new Promise<void>((resolve, reject) => {
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () =>
            reject(
              new EnvelopeCacheError("Failed to delete envelope", req.error),
            );
        });

        // Remove from memory cache
        this.memoryCache.delete(id);
      }
    } catch (err) {
      console.error("EnvelopeCache deleteByFingerprint error:", err);
      throw err;
    }
  }

  /* -------------------------------
   * Clear all envelopes (memory + IDB)
   * ------------------------------- */
  async clear(): Promise<MAJIK_API_RESPONSE> {
    // Clear memory cache
    this.memoryCache.clear();

    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () =>
          reject(
            new EnvelopeCacheError("Failed to clear envelope cache", req.error),
          );
      });
    } catch (err) {
      console.error("EnvelopeCache clear error:", err);
      return {
        message: "Failed to clear envelope cache",
        success: false,
      };
    }

    return {
      success: true,
      message: "Envelope cache cleared successfully",
    };
  }

  /* -------------------------------
   * Enforce max entries in IDB (oldest first)
   * ------------------------------- */
  private async enforceMaxEntries(): Promise<void> {
    if (!this.maxEntries) return;

    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const index = store.index("timestamp");

      const countReq = store.count();
      const total = await new Promise<number>((resolve, reject) => {
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => reject(countReq.error);
      });

      if (total <= this.maxEntries) return;

      const toDelete = total - this.maxEntries;
      const keys: IDBValidKey[] = [];

      const cursorReq = index.openKeyCursor();
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor && keys.length < toDelete) {
            keys.push(cursor.primaryKey);
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });

      for (const key of keys) {
        await new Promise<void>((resolve, reject) => {
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    } catch (err) {
      console.error("EnvelopeCache enforceMaxEntries error:", err);
    }
  }

  toJSON(): EnvelopeCacheJSON {
    const items: EnvelopeCacheJSON["items"] = [];
    this.memoryCache.forEach((envelope, id) => {
      items.push({
        id,
        base64Payload: arrayBufferToBase64(envelope.encryptedBlob),
        timestamp: Date.now(),
      });
    });
    return {
      config: {
        dbName: this.dbName,
        storeName: this.storeName,
        maxEntries: this.maxEntries,
        memoryCacheSize: this.memoryCacheSize,
      },
      items,
    };
  }

  /* -------------------------------
   * Deserialize cache from JSON
   * ------------------------------- */
  static fromJSON(json: EnvelopeCacheJSON): EnvelopeCache {
    const cache = new EnvelopeCache(json.config);
    for (const item of json.items) {
      const envelope = new MessageEnvelope(
        base64ToArrayBuffer(item.base64Payload),
      );
      cache.memoryCache.set(item.id, envelope);
    }
    return cache;
  }
}
