import {
  MAJIKAH_SQL_SCHEMA_MAJIK_CLIENT_STATE,
  MAJIKAH_SQL_SCHEMA_MAJIK_KEYS,
  MAJIKAH_SQL_TABLE_MAJIK_KEY,
  MAJIKAH_SQL_TABLE_MAJIK_KEY_CLIENT_STATE,
} from "@majikah/majik-key-client";

type MajikahSQLSchema = string;

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

function normalizeSQL(sql: MajikahSQLSchema): string {
  return sql
    .trim()
    .replace(/\s+/g, " ") // collapse all whitespace
    .toLowerCase();
}

export function buildSchemaSQL(schemas: MajikahSQLSchema[]): MajikahSQLSchema {
  const seen = new Set<MajikahSQLSchema>();

  return schemas
    .map((schema) => schema.trim())
    .filter(Boolean)
    .filter((schema) => {
      const normalized = normalizeSQL(schema);

      if (seen.has(normalized)) return false; // silently skip
      seen.add(normalized);

      return true;
    })
    .join("\n\n");
}

export const MAJIKAH_SQL_SCHEMA_MAJIK_MESSAGE_CHATS: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS} (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'local' 
    CHECK(source IN ('local', 'cloud'))
);

CREATE INDEX IF NOT EXISTS idx_majik_message_chats_created_at 
ON ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS}(created_at);


CREATE INDEX IF NOT EXISTS idx_majik_message_chats_source 
ON ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_CHATS}(source);
`;

export const MAJIKAH_SQL_SCHEMA_MAJIK_MESSAGE_FILES: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_FILES} (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  binary BLOB,
  source TEXT NOT NULL DEFAULT 'local' 
    CHECK(source IN ('local', 'cloud'))
);

CREATE INDEX IF NOT EXISTS idx_majik_message_files_created_at 
ON ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_FILES}(created_at);


CREATE INDEX IF NOT EXISTS idx_majik_message_files_source 
ON ${MAJIKAH_SQL_TABLES.MAJIK_MESSAGE_FILES}(source);
`;

export const MAJIKAH_SQL_SCHEMA_MAJIK_CONTACTS: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS ${MAJIKAH_SQL_TABLES.MAJIK_CONTACTS} (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  fingerprint TEXT,
  label TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_majik_contacts_created_at
ON ${MAJIKAH_SQL_TABLES.MAJIK_CONTACTS}(created_at);
`;

export const MAJIKAH_SQL_SCHEMA_MAJIK_CONTACT_GROUPS: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS ${MAJIKAH_SQL_TABLES.MAJIK_CONTACT_GROUPS} (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  name TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_system INTEGER DEFAULT 0 CHECK(is_system IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_majik_contact_groups_created_at
ON ${MAJIKAH_SQL_TABLES.MAJIK_CONTACT_GROUPS}(created_at);
`;

export const MAJIKAH_SQL_SCHEMA_FULL: MajikahSQLSchema = buildSchemaSQL([
  MAJIKAH_SQL_SCHEMA_MAJIK_CLIENT_STATE,
  MAJIKAH_SQL_SCHEMA_MAJIK_KEYS,
  MAJIKAH_SQL_SCHEMA_MAJIK_MESSAGE_CHATS,
  MAJIKAH_SQL_SCHEMA_MAJIK_CONTACTS,
  MAJIKAH_SQL_SCHEMA_MAJIK_CONTACT_GROUPS,
  MAJIKAH_SQL_SCHEMA_MAJIK_MESSAGE_FILES,
]);
