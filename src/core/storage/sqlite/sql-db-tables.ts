import {
  MAJIKAH_SQL_TABLE_MAJIK_KEY,
  MAJIKAH_SQL_TABLE_MAJIK_KEY_CLIENT_STATE,
} from "@majikah/majik-key-client";

/**
 * Centralized SQLite table registry.
 * - `as const` keeps literal types
 * - `MajikahSQLTable` becomes a strict union type
 */
export const MAJIKAH_SQL_TABLES = {
  MAJIK_CLIENT_STATE: MAJIKAH_SQL_TABLE_MAJIK_KEY_CLIENT_STATE,
  MAJIK_KEYS: MAJIKAH_SQL_TABLE_MAJIK_KEY,
  MAJIK_MESSAGE_CHATS: "majik_message_chats",
  MAJIK_MESSAGE_FILES: "majik_message_files",
  MAJIK_MESSAGE_THREAD_MAILS: "majik_message_thread_mails",
  MAJIK_CONTACTS: "majik_contacts",
  MAJIK_CONTACT_GROUPS: "majik_contact_groups",
} as const;

export type MajikahSQLTable =
  (typeof MAJIKAH_SQL_TABLES)[keyof typeof MAJIKAH_SQL_TABLES];
