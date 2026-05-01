

// ---------------------------------------------------------------------------
// InMemoryInvoiceAdapter — default, zero-config, non-persistent
// ---------------------------------------------------------------------------

import { MajikMessageChatJSON } from "../../database/chat/types";
import { MajikMessageChatStorageAdapter } from "./_types";

/**
 * In-memory adapter backed by a plain Map.
 * Default adapter when no other is provided.
 * Does not persist across page loads or restarts.
 *
 * @example
 *   const manager = new MajikInvoiceManager();
 *   // InMemoryInvoiceAdapter is used automatically
 */
export class InMemoryInvoiceAdapter implements MajikMessageChatStorageAdapter {
  private _store: Map<string, MajikMessageChatJSON> = new Map();

  async save(invoice: MajikMessageChatJSON): Promise<void> {
    this._store.set(invoice.id, invoice);
  }

  async getById(id: string): Promise<MajikMessageChatJSON | null> {
    return this._store.get(id) ?? null;
  }

  async list(): Promise<MajikMessageChatJSON[]> {
    return Array.from(this._store.values());
  }

  async remove(id: string): Promise<boolean> {
    return this._store.delete(id);
  }

  async clear(): Promise<void> {
    this._store.clear();
  }

  async count(): Promise<number> {
    return this._store.size;
  }

  async exists(id: string): Promise<boolean> {
    return this._store.has(id);
  }

  async bulkSave(invoices: MajikMessageChatJSON[]): Promise<void> {
    for (const inv of invoices) this._store.set(inv.id, inv);
  }

  async bulkRemove(ids: string[]): Promise<void> {
    for (const id of ids) this._store.delete(id);
  }
}
