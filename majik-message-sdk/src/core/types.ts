import type {
  FileContext,
  MajikFile,
  MajikFileJSON,
  TempFileDuration,
} from "@majikah/majik-file";
import { MajikContactManagerJSON } from "./contacts/types";
import { UserAppPreferences } from "./storage";
import { MajikMessageChatJSON } from "./database/chat/types";
import { MajikKeyAddress } from "@majikah/majik-key";

export type ISODateString = string;

export type MajikMessageChatID = string;

export type MajikMessageThreadID = string;
export type MajikMessageMailID = string;

export interface MAJIK_API_RESPONSE {
  success: boolean;
  message: string;
  code?: string;
}
/**
 * types.ts — @majikah/majik-envelope
 *
 * ML-KEM-768 (v3) envelope types only.
 * v1 (X25519 solo) and v2 (X25519 group) have been removed.
 */

// ─── Single Payload ─────────────────────────────────────────────────────────────

/**
 * Single-recipient envelope payload.
 * The ML-KEM shared secret is used directly as the AES-256-GCM key.
 */
export interface SinglePayload {
  iv: string; // base64, 12 bytes
  ciphertext: string; // base64, AES-256-GCM ciphertext
  mlKemCipherText: string; // base64, 1088 bytes (ML-KEM-768 ciphertext)
}

// ─── Group Payload ────────────────────────────────────────────────────────────

/**
 * Per-recipient key entry in a group envelope.
 * encryptedAesKey = groupAesKey XOR mlKemSharedSecret (32-byte XOR one-time-pad).
 */
export interface GroupKey {
  fingerprint: string; // base64 SHA-256 — used to find this entry during decryption
  mlKemCipherText: string; // base64, 1088 bytes (ML-KEM-768 ciphertext for this recipient)
  encryptedAesKey: string; // base64, 32 bytes (aesKey XOR sharedSecret)
}

/**
 * Multi-recipient envelope payload.
 * Message is encrypted once with a random AES key.
 * Each recipient gets their own ML-KEM encapsulation of that AES key.
 */
export interface GroupPayload {
  iv: string; // base64, 12 bytes
  ciphertext: string; // base64, AES-256-GCM ciphertext
  keys: GroupKey[]; // one entry per recipient
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type EnvelopePayload = SinglePayload | GroupPayload;

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isSinglePayload(p: EnvelopePayload): p is SinglePayload {
  return "mlKemCipherText" in p && !("keys" in p);
}

export function isGroupPayload(p: EnvelopePayload): p is GroupPayload {
  return "keys" in p && Array.isArray((p as GroupPayload).keys);
}

// ─── MajikEnvelope JSON ───────────────────────────────────────────────────────

export interface MajikEnvelopeJSON {
  version: 3;
  fingerprint: string;
  payload: EnvelopePayload;
  plaintext?: string; // present only after successful decryption
}

// ─── Shared API Types ─────────────────────────────────────────────────────────

export interface MAJIK_API_RESPONSE {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface MnemonicJSON {
  id: string;
  seed: string[];
  phrase?: string;
}

export interface MajikKeyJSON {
  id: string;
  label: string;
  publicKey: string;
  fingerprint: string;
  encryptedPrivateKey: string;
  salt: string;
  backup: string;
  timestamp: string;
  kdfVersion: number;
  mlKemPublicKey?: string;
  encryptedMlKemSecretKey?: string;
}

export interface MajikKeyMetadata {
  id: string;
  fingerprint: string;
  label: string;
  timestamp: Date;
  isLocked: boolean;
  kdfVersion: number;
  hasMlKem: boolean;
}

// ─── MajikFile integration types ─────────────────────────────────────────────

// ─── Compression Level Type ───────────────────────────────────────────────────

/**
 * Explicit integer compression level for Zstd, 1–22.
 *
 * Recommended values:
 *  - 1   → Fastest possible; still meaningfully compresses text/code.
 *  - 3   → Good speed/ratio balance for real-time paths.
 *  - 6   → Inflection point — noticeably better ratio, modest speed cost.
 *  - 9   → Strong compression; gains plateau significantly after this.
 *  - 15  → High-effort; use only for smaller, latency-insensitive uploads.
 *  - 19  → Near-maximum ratio without WASM memory pressure.
 *  - 22  → Archival-grade; not safe for files > 10 MB in WASM environments.
 *
 * For production use, prefer a CompressionPreset over a raw integer unless
 * you have a specific tuning requirement.
 */
export type CompressionLevel =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22;

/**
 * Options for MajikMessage.encryptFile().
 *
 * Wraps MajikFile.CreateOptions in MajikMessage terms — callers pass contact
 * IDs rather than raw key material. The orchestrator resolves everything from
 * MajikKeyStore and the contact directory internally.
 */
export interface EncryptFileOptions {
  /** Raw binary content of the file to encrypt. */
  data: Uint8Array | ArrayBuffer;
  /** UUID from auth.users — used for R2 key construction and ownership checks. */
  userId?: string;
  /**
   * File context — drives storage routing, WebP conversion, and R2 key prefix.
   *   "user_upload"      → permanent storage,  no WebP conversion
   *   "chat_attachment"  → permanent storage,  images converted to WebP
   *   "chat_image"       → conversation-scoped, always WebP, requires conversationId
   *   "thread_attachment"→ permanent storage,  no WebP conversion
   */
  context: FileContext;
  /** Original filename (e.g. "photo.jpg"). Optional but strongly recommended. */
  originalName?: string;
  /** MIME type (e.g. "image/jpeg"). Falls back to extension inference when omitted. */
  mimeType?: string;
  /**
   * Public keys of additional recipients beyond the sender.
   * The active account (sender) is always included automatically.
   * Duplicates and the sender's own public key are silently discarded.
   * When empty or omitted, a single-recipient (self-encrypted) file is produced.
   */
  recipients?: MajikKeyAddress[];
  /**
   * Conversation ID — required when context is "chat_image".
   * Scopes the R2 key: images/chats/<conversationId>/<userId>_<hash>.mjkb
   */
  conversationId?: string;
  /**
   * Store under files/public/ with 15-day auto-deletion by R2 lifecycle policy.
   * Requires expiresAt. Use MajikFile.buildExpiryDate() to generate.
   * @default false
   */
  isTemporary?: boolean;
  /** TempFileDuration in days. Required when isTemporary is true. */
  expiresAt?: TempFileDuration;
  /** Bypass the 100 MB file size limit. @default false */
  bypassSizeLimit?: boolean;
  /** Foreign-key association with a chat message. */
  chatMessageId?: string;
  /** Foreign-key association with a thread message. */
  threadMessageId?: string;
  /** Foreign-key association with a thread. */
  threadId?: string;
  /**
   * Zstd compression level or preset for this file.
   *
   * Accepts either a raw integer (`CompressionLevel` 1–22) or a named
   * `CompressionPreset` value. The level is always run through
   * `MajikCompressor.adaptiveLevel()` before use, so it will be silently
   * clamped downward for large files to avoid WASM out-of-memory errors.
   *
   * Defaults to ZSTD_MAX_LEVEL (22) when omitted — existing behaviour.
   *
   * @example
   * // Raw integer
   * compressionLevel: 9
   *
   * // Named preset
   * compressionLevel: CompressionPreset.GOOD  // 9
   * compressionLevel: CompressionPreset.BALANCED // 6
   */
  compressionLevel?: CompressionLevel | number;
}

/**
 * Returned by MajikMessage.encryptFile().
 *
 * MajikMessage does NOT upload to R2 or insert into Supabase — that is the
 * caller's responsibility so it can handle its own error handling, progress
 * reporting, and transaction semantics.
 */
export interface EncryptFileResult {
  /**
   * The fully-initialised MajikFile instance.
   * Use file.toMJKB()  → Blob  for R2 upload.
   * Use file.toJSON()  → row   for Supabase insert.
   */
  file: MajikFile;
  /**
   * Supabase-ready metadata row. Equivalent to file.toJSON().
   * Provided as a convenience so callers do not need to call toJSON() themselves.
   */
  metadata: MajikFileJSON;
  /**
   * .mjkb Blob for R2 upload. Equivalent to file.toMJKB().
   */
  binary: Blob;

  /**
   * Signed .mjkb Blob for offline or direct sharing. Equivalent to file.toSignedMJKB().
   */
  signedBinary: Blob;
}

/**
 * Options for MajikMessage.decryptFile().
 */
export interface DecryptFileOptions {
  /**
   * The encrypted .mjkb binary to decrypt.
   * Accepts a Blob (from R2 fetch), Uint8Array, or ArrayBuffer.
   */
  source: Blob | Uint8Array | ArrayBuffer;
  /**
   * ID of the own account to use for decryption.
   * When omitted the active account is tried first.
   * For group files, if the active account fails, all own accounts are tried
   * automatically — you rarely need to set this explicitly.
   */
  accountId?: string;
  /**
   * The MajikFileJSON metadata row from Supabase.
   * When provided, the signature field is automatically threaded into
   * decryptWithMetadata() so the returned signature is populated without
   * a second parse or round-trip.
   */
  metadata?: MajikFileJSON;
}

export interface AppBackUpData {
  chatMessages?: MajikMessageChatJSON[];
  contacts: MajikContactManagerJSON;
  // invoiceDefaults?: InvoiceDefaults;
  preferences?: UserAppPreferences;
}
