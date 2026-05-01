type MajikahSQLSchema = string;

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

export const MAJIKAH_SQL_SCHEMA_MAJIK_CLIENT_STATE: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS majik_client_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
`;

export const MAJIKAH_SQL_SCHEMA_MAJIK_KEYS: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS majik_keys (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  public_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_majik_keys_timestamp 
ON majik_keys(timestamp);

CREATE INDEX IF NOT EXISTS idx_majik_keys_public_key 
ON majik_keys(public_key);
`;

export const MAJIKAH_SQL_SCHEMA_MAJIK_MESSAGE_CHATS: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS majik_message_chats (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'local' 
    CHECK(source IN ('local', 'cloud'))
);

CREATE INDEX IF NOT EXISTS idx_majik_message_chats_created_at 
ON majik_message_chats(created_at);


CREATE INDEX IF NOT EXISTS idx_majik_message_chats_source 
ON majik_message_chats(source);
`;

export const MAJIKAH_SQL_SCHEMA_MAJIK_MESSAGE_FILES: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS majik_message_files (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  binary BLOB,
  source TEXT NOT NULL DEFAULT 'local' 
    CHECK(source IN ('local', 'cloud'))
);

CREATE INDEX IF NOT EXISTS idx_majik_message_files_created_at 
ON majik_message_files(created_at);


CREATE INDEX IF NOT EXISTS idx_majik_message_files_source 
ON majik_message_files(source);
`;

export const MAJIKAH_SQL_SCHEMA_MAJIK_CONTACTS: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS majik_contacts (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  fingerprint TEXT,
  label TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_majik_contacts_created_at 
ON majik_contacts(created_at);
`;

export const MAJIKAH_SQL_SCHEMA_MAJIK_CONTACT_GROUPS: MajikahSQLSchema = `
CREATE TABLE IF NOT EXISTS majik_contact_groups (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  name TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_system INTEGER DEFAULT 0 CHECK(is_system IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_majik_contact_groups_created_at 
ON majik_contact_groups(created_at);
`;

export const MAJIKAH_SQL_SCHEMA_FULL: MajikahSQLSchema = buildSchemaSQL([
  MAJIKAH_SQL_SCHEMA_MAJIK_CLIENT_STATE,
  MAJIKAH_SQL_SCHEMA_MAJIK_KEYS,
  MAJIKAH_SQL_SCHEMA_MAJIK_MESSAGE_CHATS,
  MAJIKAH_SQL_SCHEMA_MAJIK_CONTACTS,
  MAJIKAH_SQL_SCHEMA_MAJIK_CONTACT_GROUPS,
  MAJIKAH_SQL_SCHEMA_MAJIK_MESSAGE_FILES,
]);
