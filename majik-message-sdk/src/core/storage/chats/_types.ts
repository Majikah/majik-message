
import { MajikMessageChatJSON } from "../../database/chat/types";
import { MajikStorageAdapter } from "../storage-adapter";

/**
 * All methods are async — consistent regardless of the backing store.
 * The adapter works only with serialized JSON; it never sees MajikMessageChat
 * instances directly. Deserialization happens in MajikInvoiceManager.
 */
export type MajikMessageChatStorageAdapter = MajikStorageAdapter<MajikMessageChatJSON>;
