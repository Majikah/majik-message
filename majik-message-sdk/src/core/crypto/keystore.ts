import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64ToUtf8,
  utf8ToBase64,
  concatUint8Arrays,
  arrayToBase64,
} from "../utils/utilities";
import { KEY_ALGO, MAJIK_MNEMONIC_SALT, MAJIK_SALT } from "./constants";
import { EncryptionEngine } from "./encryption-engine";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import {
  generateRandomBytes,
  deriveKeyFromPassphrase as providerDeriveKeyFromPassphrase,
  deriveKeyFromMnemonic as providerDeriveKeyFromMnemonic,
  aesGcmEncrypt,
  aesGcmDecrypt,
  IV_LENGTH,
} from "./crypto-provider";
import { MajikKey } from "@majikah/majik-key";

/* -------------------------------
 * Types
 * ------------------------------- */

export interface KeyStoreIdentity {
  id: string;
  publicKey: CryptoKey | { raw: Uint8Array };
  fingerprint: string;
  privateKey?: CryptoKey | { raw: Uint8Array }; // ephemeral, only when unlocked
  encryptedPrivateKey?: ArrayBuffer; // encrypted at rest
  unlocked?: boolean;
}

export interface SerializedIdentity {
  id: string;
  publicKey: string; // base64
  fingerprint: string;
  encryptedPrivateKey?: string; // base64
  salt?: string; // base64 per-identity salt for PBKDF2
}

/* -------------------------------
 * Errors
 * ------------------------------- */

export class KeyStoreError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "KeyStoreError";
    this.cause = cause;
  }
}

/* -------------------------------
 * KeyStore Class
 * ------------------------------- */

/**
 * KeyStore
 * ----------------
 * Secure storage for MajikMessage identities.
 * Stores public keys and fingerprints in plaintext,
 * encrypts private keys with a passphrase.
 *
 * ⚠️ Background-only. Never expose private keys to content scripts.
 */
export class KeyStore {
  private static deviceID: string = "default";

  private static STORE_NAME = "identities";
  private static DB_VERSION = 1;

  private static dbPromise: Promise<IDBDatabase> | null = null;
  // In-memory unlocked identities (id -> identity)
  private static unlockedIdentities: Map<string, KeyStoreIdentity> = new Map();
  // Optional callback: invoked when UI needs to request a passphrase to unlock an identity.
  // Should return the passphrase string or a Promise<string>.
  static onUnlockRequested?: (id: string) => string | Promise<string>;

  /* ================================
   * IndexedDB Helpers
   * ================================ */

  static init(deviceID: string) {
    this.deviceID = deviceID;
  }

  private static async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    const dbName = this.deviceID;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new KeyStoreError("IndexedDB open failed", request.error));
    });

    return this.dbPromise;
  }

  static async addMajikKey(key: MajikKey): Promise<void> {
    const serializedIdentity = key.toSerializedIdentity();
    const keyIdentity = key.toKeyIdentity();

    this.unlockedIdentities.set(keyIdentity.id, keyIdentity);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, "readwrite");
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.put(serializedIdentity);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new KeyStoreError("Failed to store identity", req.error));
    });
  }

  private static async putSerializedIdentity(
    identity: SerializedIdentity,
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, "readwrite");
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.put(identity);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new KeyStoreError("Failed to store identity", req.error));
    });
  }

  private static async getSerializedIdentity(
    id: string,
  ): Promise<SerializedIdentity | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, "readonly");
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () =>
        reject(new KeyStoreError("Failed to retrieve identity", req.error));
    });
  }

  /* ================================
   * Public API
   * ================================ */

  /**
   * Validates whether a passphrase can decrypt the stored private key.
   * Does NOT unlock or mutate any in-memory state.
   */
  static async isPassphraseValid(
    id: string,
    passphrase: string,
  ): Promise<boolean> {
    if (!passphrase) return false;

    try {
      const serialized = await this.getSerializedIdentity(id);
      if (!serialized || !serialized.encryptedPrivateKey) return false;

      const encrypted = base64ToArrayBuffer(serialized.encryptedPrivateKey);

      const salt = serialized.salt
        ? new Uint8Array(base64ToArrayBuffer(serialized.salt))
        : new TextEncoder().encode(MAJIK_SALT);

      // Attempt authenticated decryption
      await this.decryptPrivateKey(encrypted, passphrase, salt);

      // If no error → passphrase is valid
      return true;
    } catch {
      return false;
    }
  }

  static async updatePassphrase(
    id: string,
    currentPassphrase: string,
    newPassphrase: string,
  ): Promise<void> {
    if (!newPassphrase || typeof newPassphrase !== "string") {
      throw new KeyStoreError("New passphrase must be a non-empty string");
    }

    const serialized = await this.getSerializedIdentity(id);
    if (!serialized || !serialized.encryptedPrivateKey) {
      throw new KeyStoreError("Identity not found or has no private key");
    }

    // ✅ Validate current passphrase
    const valid = await this.isPassphraseValid(id, currentPassphrase);
    if (!valid) {
      throw new KeyStoreError("Current passphrase is incorrect");
    }

    // 1. Decrypt with current passphrase (we already know it's valid)
    const encrypted = base64ToArrayBuffer(serialized.encryptedPrivateKey);
    const salt = serialized.salt
      ? new Uint8Array(base64ToArrayBuffer(serialized.salt))
      : new TextEncoder().encode(MAJIK_SALT);

    const privateKeyBuffer = await this.decryptPrivateKey(
      encrypted,
      currentPassphrase,
      salt,
    );

    // 2. Re-encrypt with new passphrase + new salt
    const newSalt = generateRandomBytes(16);
    const newEncryptedPrivateKey = await this.encryptPrivateKey(
      privateKeyBuffer,
      newPassphrase,
      newSalt,
    );

    // 3. Persist updated identity
    const updated: SerializedIdentity = {
      ...serialized,
      encryptedPrivateKey: arrayBufferToBase64(newEncryptedPrivateKey),
      salt: arrayToBase64(newSalt),
    };

    await this.putSerializedIdentity(updated);

    // 4. Update in-memory unlocked identity (if present)
    const unlocked = this.unlockedIdentities.get(id);
    if (unlocked) {
      unlocked.encryptedPrivateKey = newEncryptedPrivateKey;
    }
  }

  /**
   * Check if an identity exists in memory or in storage
   */
  static async hasIdentity(fingerprint: string): Promise<boolean> {
    // First, check in-memory unlocked identities
    for (const ident of this.unlockedIdentities.values()) {
      if (ident.fingerprint === fingerprint) return true;
    }

    // Then, check IndexedDB (persistent storage)
    const allStored = await this.listStoredIdentities();
    return allStored.some((i) => i.fingerprint === fingerprint);
  }

  /**
   * Creates a new identity and stores it securely.
   */
  static async createIdentity(passphrase: string): Promise<KeyStoreIdentity> {
    if (!passphrase || typeof passphrase !== "string") {
      throw new KeyStoreError("Passphrase must be a non-empty string");
    }

    try {
      const identity = await EncryptionEngine.generateIdentity();
      const id = crypto.randomUUID();

      let exportedPrivateKey: ArrayBuffer;
      try {
        exportedPrivateKey = await crypto.subtle.exportKey(
          "raw",
          identity.privateKey as CryptoKey,
        );
      } catch (e) {
        const anyPriv: any = identity.privateKey as any;
        if (anyPriv && anyPriv.raw instanceof Uint8Array) {
          exportedPrivateKey = anyPriv.raw.buffer.slice(
            anyPriv.raw.byteOffset,
            anyPriv.raw.byteOffset + anyPriv.raw.byteLength,
          );
        } else {
          throw e;
        }
      }
      const salt = generateRandomBytes(16);
      const encryptedPrivateKey = await this.encryptPrivateKey(
        exportedPrivateKey,
        passphrase,
        salt,
      );

      const serialized: SerializedIdentity = {
        id,
        publicKey: await this.exportPublicKeyBase64(identity.publicKey),
        fingerprint: identity.fingerprint,
        encryptedPrivateKey: arrayBufferToBase64(encryptedPrivateKey),
        salt: arrayToBase64(salt),
      };

      await this.putSerializedIdentity(serialized);

      const ksIdentity: KeyStoreIdentity = {
        id,
        publicKey: identity.publicKey,
        fingerprint: identity.fingerprint,
        encryptedPrivateKey,
        unlocked: true,
        privateKey: identity.privateKey,
      };

      // Cache unlocked identity in-memory for quick access
      this.unlockedIdentities.set(id, ksIdentity);

      return ksIdentity;
    } catch (err) {
      throw new KeyStoreError("Failed to create identity", err);
    }
  }

  /**
   * Create a deterministic identity from a mnemonic and store it encrypted with passphrase.
   * The identity `id` is set to the fingerprint for stable referencing.
   */
  static async createIdentityFromMnemonic(
    mnemonic: string,
    passphrase: string,
  ): Promise<KeyStoreIdentity> {
    if (!mnemonic || typeof mnemonic !== "string") {
      throw new KeyStoreError("Mnemonic must be a non-empty string");
    }

    if (!passphrase?.trim()) {
      throw new Error("Passphrase cannot be empty or undefined");
    }

    try {
      const identity =
        await EncryptionEngine.deriveIdentityFromMnemonic(mnemonic);
      const id = identity.fingerprint; // stable id

      let exportedPrivate: ArrayBuffer;
      try {
        exportedPrivate = await crypto.subtle.exportKey(
          "raw",
          identity.privateKey as CryptoKey,
        );
      } catch (e) {
        const anyPriv: any = identity.privateKey as any;
        if (anyPriv && anyPriv.raw instanceof Uint8Array) {
          exportedPrivate = anyPriv.raw.buffer.slice(
            anyPriv.raw.byteOffset,
            anyPriv.raw.byteOffset + anyPriv.raw.byteLength,
          );
        } else {
          throw e;
        }
      }
      const salt = generateRandomBytes(16);
      const encryptedPrivateKey = await this.encryptPrivateKey(
        exportedPrivate,
        passphrase,
        salt,
      );

      const serialized: SerializedIdentity = {
        id,
        publicKey: await this.exportPublicKeyBase64(identity.publicKey),
        fingerprint: identity.fingerprint,
        encryptedPrivateKey: arrayBufferToBase64(encryptedPrivateKey),
        salt: arrayToBase64(salt),
      };

      await this.putSerializedIdentity(serialized);

      const ksIdentity: KeyStoreIdentity = {
        id,
        publicKey: identity.publicKey,
        fingerprint: identity.fingerprint,
        encryptedPrivateKey,
        unlocked: true,
        privateKey: identity.privateKey,
      };

      this.unlockedIdentities.set(id, ksIdentity);

      return ksIdentity;
    } catch (err) {
      throw new KeyStoreError("Failed to create identity from mnemonic", err);
    }
  }

  /**
   * Unlocks a stored identity with the passphrase.
   */
  static async unlockIdentity(
    id: string,
    passphrase: string,
  ): Promise<KeyStoreIdentity> {
    const serialized = await this.getSerializedIdentity(id);
    if (!serialized) throw new KeyStoreError("Identity not found");

    if (!serialized.encryptedPrivateKey)
      throw new KeyStoreError("No private key stored");

    const encrypted = base64ToArrayBuffer(serialized.encryptedPrivateKey);
    // Use stored per-identity salt if present, otherwise fall back to global salt
    const salt = serialized.salt
      ? new Uint8Array(base64ToArrayBuffer(serialized.salt))
      : new TextEncoder().encode(MAJIK_SALT);

    const privateKeyBuffer = await this.decryptPrivateKey(
      encrypted,
      passphrase,
      salt,
    );

    let privateKey: CryptoKey | any;
    try {
      privateKey = await crypto.subtle.importKey(
        "raw",
        privateKeyBuffer,
        KEY_ALGO,
        true,
        ["deriveKey", "deriveBits"],
      );
    } catch (e) {
      // WebCrypto doesn't support importing X25519; keep raw wrapper
      privateKey = {
        type: "private",
        raw: new Uint8Array(privateKeyBuffer),
      } as any;
    }

    const publicKey = await this.importPublicKeyBase64(serialized.publicKey);

    const ksIdentity: KeyStoreIdentity = {
      id,
      publicKey,
      fingerprint: serialized.fingerprint,
      encryptedPrivateKey: encrypted,
      unlocked: true,
      privateKey: privateKey,
    };

    // Cache unlocked identity
    this.unlockedIdentities.set(id, ksIdentity);

    return ksIdentity;
  }

  /**
   * Get the private key of an unlocked identity by ID or fingerprint.
   * Throws if the identity is not found or not unlocked.
   */
  static async getPrivateKey(
    idOrFingerprint: string,
  ): Promise<CryptoKey | { raw: Uint8Array }> {
    // First, check in-memory unlocked identities by id
    const byId = this.unlockedIdentities.get(idOrFingerprint);
    if (byId && byId.privateKey) return byId.privateKey as any;

    // Then check unlocked identities by fingerprint
    for (const ident of this.unlockedIdentities.values()) {
      if (ident.fingerprint === idOrFingerprint && ident.privateKey)
        return ident.privateKey as any;
    }

    // Not unlocked in memory -- instruct caller to unlock first
    throw new KeyStoreError(
      `Identity with ID/fingerprint "${idOrFingerprint}" must be unlocked first via unlockIdentity()`,
    );
  }

  /**
   * Locks a stored identity (removes private key from memory).
   */
  static async lockIdentity(
    identity: KeyStoreIdentity,
  ): Promise<KeyStoreIdentity> {
    // Remove from in-memory cache
    if (identity && identity.id) this.unlockedIdentities.delete(identity.id);
    return { ...identity, unlocked: false, privateKey: undefined };
  }

  /**
   * Gets a stored identity's public key.
   */
  static async getPublicKey(
    id: string,
  ): Promise<CryptoKey | { raw: Uint8Array }> {
    const serialized = await this.getSerializedIdentity(id);
    if (!serialized) throw new KeyStoreError("Identity not found");

    return this.importPublicKeyBase64(serialized.publicKey) as any;
  }

  /**
   * Gets a stored identity's fingerprint.
   */
  static async getFingerprint(id: string): Promise<string> {
    const serialized = await this.getSerializedIdentity(id);
    if (!serialized) throw new KeyStoreError("Identity not found");

    return serialized.fingerprint;
  }

  /* ================================
   * Private Helpers
   * ================================ */

  private static async encryptPrivateKey(
    buffer: ArrayBuffer,
    passphrase: string,
    salt: Uint8Array,
  ): Promise<ArrayBuffer> {
    if (!passphrase?.trim()) {
      throw new Error("Passphrase cannot be empty or undefined");
    }

    const keyBytes = providerDeriveKeyFromPassphrase(passphrase, salt);
    const iv = generateRandomBytes(IV_LENGTH);
    const ciphertext = aesGcmEncrypt(keyBytes, iv, new Uint8Array(buffer));
    return concatUint8Arrays(iv, ciphertext).buffer as ArrayBuffer;
  }

  private static async decryptPrivateKey(
    buffer: ArrayBuffer,
    passphrase: string,
    salt: Uint8Array,
  ): Promise<ArrayBuffer> {
    const keyBytes = providerDeriveKeyFromPassphrase(passphrase, salt);

    const full = new Uint8Array(buffer);
    const iv = full.slice(0, IV_LENGTH);
    const ciphertext = full.slice(IV_LENGTH);

    const plain = aesGcmDecrypt(keyBytes, iv, ciphertext);
    if (!plain)
      throw new KeyStoreError("Failed to decrypt private key (auth failed)");
    return plain.buffer as ArrayBuffer;
  }

  private static async exportPublicKeyBase64(
    key: CryptoKey | { raw: Uint8Array },
  ): Promise<string> {
    const anyKey: any = key as any;
    if (anyKey && anyKey.raw instanceof Uint8Array) {
      return arrayBufferToBase64(anyKey.raw.buffer);
    }
    const raw = await crypto.subtle.exportKey("raw", key as CryptoKey);
    return arrayBufferToBase64(raw);
  }

  private static async importPublicKeyBase64(
    base64: string,
  ): Promise<CryptoKey | { raw: Uint8Array }> {
    const raw = base64ToArrayBuffer(base64);
    try {
      return await crypto.subtle.importKey("raw", raw, KEY_ALGO, true, []);
    } catch (e) {
      // WebCrypto may not support X25519; return a raw-key wrapper as fallback
      const ua = new Uint8Array(raw);
      const wrapper: any = { type: "public", raw: ua };
      return wrapper as unknown as CryptoKey | { raw: Uint8Array };
    }
  }

  /**
   * Export a stored identity as a compact base64 backup blob (JSON -> base64).
   * The exported blob contains the encrypted private key (already encrypted with user's passphrase)
   * so the caller must preserve it securely. This is not a human-readable mnemonic.
   */
  static async exportIdentityBackup(id: string): Promise<string> {
    const serialized = await this.getSerializedIdentity(id);
    if (!serialized) throw new KeyStoreError("Identity not found");

    const payload = {
      id: serialized.id,
      publicKey: serialized.publicKey,
      fingerprint: serialized.fingerprint,
      encryptedPrivateKey: serialized.encryptedPrivateKey || null,
    };

    return utf8ToBase64(JSON.stringify(payload));
  }

  /**
   * Import an identity backup previously exported via `exportIdentityBackup`.
   * This stores the serialized identity in IndexedDB. Caller can then call `unlockIdentity`.
   */
  static async importIdentityBackup(backupBase64: string): Promise<void> {
    try {
      const jsonStr = base64ToUtf8(backupBase64);
      const obj = JSON.parse(jsonStr) as SerializedIdentity;
      if (!obj.id || !obj.publicKey || !obj.fingerprint) {
        throw new KeyStoreError("Malformed backup blob");
      }

      await this.putSerializedIdentity(obj);
    } catch (err) {
      throw new KeyStoreError("Failed to import identity backup", err);
    }
  }

  /**
   * List all serialized identities stored in IndexedDB.
   */
  static async listStoredIdentities(): Promise<SerializedIdentity[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, "readonly");
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () =>
        reject(new KeyStoreError("Failed to list identities", req.error));
    });
  }

  /**
   * Delete an identity by id from storage and in-memory caches.
   */
  static async deleteIdentity(id: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, "readwrite");
      const store = tx.objectStore(this.STORE_NAME);

      store.delete(id);

      tx.oncomplete = async () => {
        try {
          // In-memory cleanup
          this.unlockedIdentities.delete(id);

          resolve();
        } catch (err) {
          reject(err);
        }
      };

      tx.onerror = () =>
        reject(new KeyStoreError("Failed to delete identity", tx.error));
    });
  }

  /**
   * Generate a BIP39 mnemonic (default 12 words / 128 bits entropy).
   */
  static generateMnemonic(strength: 128 = 128): string {
    // @scure/bip39's generateMnemonic accepts entropy bits (128 -> 12 words)
    // Call with strength only; use default English wordlist
    return generateMnemonic(wordlist, strength);
  }

  /**
   * Export an identity encrypted with a mnemonic-derived key.
   * Requires the identity to be unlocked in memory (privateKey available).
   * Returns a base64 string containing iv+ciphertext and publicKey/fingerprint in JSON.
   */
  static async exportIdentityMnemonicBackup(
    id: string,
    mnemonic: string,
  ): Promise<string> {
    const unlocked = this.unlockedIdentities.get(id);
    if (!unlocked || !unlocked.privateKey) {
      throw new KeyStoreError(
        "Identity must be unlocked before exporting mnemonic backup",
      );
    }

    // Export private key (raw) and public key (raw)
    // Export private key (raw) and public key (raw)
    let privRawBuf: ArrayBuffer;
    let pubRawBuf: ArrayBuffer;
    try {
      privRawBuf = await crypto.subtle.exportKey(
        "raw",
        unlocked.privateKey as CryptoKey,
      );
      pubRawBuf = await crypto.subtle.exportKey(
        "raw",
        unlocked.publicKey as CryptoKey,
      );
    } catch (e) {
      const anyPriv: any = unlocked.privateKey as any;
      const anyPub: any = unlocked.publicKey as any;
      if (anyPriv && anyPriv.raw instanceof Uint8Array) {
        privRawBuf = anyPriv.raw.buffer.slice(
          anyPriv.raw.byteOffset,
          anyPriv.raw.byteOffset + anyPriv.raw.byteLength,
        );
      } else {
        throw e;
      }
      if (anyPub && anyPub.raw instanceof Uint8Array) {
        pubRawBuf = anyPub.raw.buffer.slice(
          anyPub.raw.byteOffset,
          anyPub.raw.byteOffset + anyPub.raw.byteLength,
        );
      } else {
        throw e;
      }
    }

    // Derive AES key from mnemonic using Stablelib provider
    const salt = new TextEncoder().encode(MAJIK_MNEMONIC_SALT);
    const keyBytes = providerDeriveKeyFromMnemonic(mnemonic, salt);
    const iv = generateRandomBytes(IV_LENGTH);
    const ciphertext = aesGcmEncrypt(keyBytes, iv, new Uint8Array(privRawBuf));

    const packaged = {
      id: unlocked.id,
      iv: arrayToBase64(iv),
      ciphertext: arrayToBase64(ciphertext),
      publicKey: arrayBufferToBase64(pubRawBuf),
      fingerprint: unlocked.fingerprint,
    };

    return utf8ToBase64(JSON.stringify(packaged));
  }

  /**
   * Import an identity from a mnemonic-encrypted backup blob and store it encrypted with `passphrase`.
   */
  static async importIdentityFromMnemonicBackup(
    backupBase64: string,
    mnemonic: string,
    passphrase: string,
  ): Promise<KeyStoreIdentity> {
    try {
      if (!passphrase?.trim()) {
        throw new Error("Passphrase cannot be empty or undefined");
      }

      if (!mnemonic?.trim()) {
        throw new Error("Seed phrase cannot be empty or undefined");
      }

      const jsonStr = base64ToUtf8(backupBase64);

      const obj = JSON.parse(jsonStr) as {
        id?: string;
        iv: string;
        ciphertext: string;
        publicKey: string;
        fingerprint: string;
      };

      if (!obj.iv || !obj.ciphertext || !obj.publicKey || !obj.fingerprint) {
        throw new KeyStoreError("Malformed mnemonic backup");
      }

      const fullKey = await this.deriveKeyFromMnemonic(mnemonic);
      const iv = new Uint8Array(base64ToArrayBuffer(obj.iv));
      const ciphertext = base64ToArrayBuffer(obj.ciphertext);

      const raw = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        fullKey,
        ciphertext,
      );

      let privateKey: CryptoKey | { raw: Uint8Array };

      try {
        privateKey = await crypto.subtle.importKey("raw", raw, KEY_ALGO, true, [
          "deriveKey",
          "deriveBits",
        ]);
      } catch (e) {
        // WebCrypto does not support X25519 – store raw key
        privateKey = {
          type: "private",
          raw: new Uint8Array(raw),
        };
      }

      const publicKey = await this.importPublicKeyBase64(obj.publicKey);

      // Now encrypt private key with user passphrase for storage and put into IndexedDB
      const exportedPrivateKey = raw;
      const salt = generateRandomBytes(16);
      const encryptedPrivateKey = await this.encryptPrivateKey(
        exportedPrivateKey,
        passphrase,
        salt,
      );

      const id = obj.id || crypto.randomUUID();
      const serialized: SerializedIdentity = {
        id,
        publicKey: obj.publicKey,
        fingerprint: obj.fingerprint,
        encryptedPrivateKey: arrayBufferToBase64(encryptedPrivateKey),
        salt: arrayToBase64(salt),
      };

      await this.putSerializedIdentity(serialized);

      const ksIdentity: KeyStoreIdentity = {
        id: serialized.id,
        publicKey,
        fingerprint: serialized.fingerprint,
        encryptedPrivateKey: encryptedPrivateKey,
        unlocked: true,
        privateKey,
      };

      // Cache unlocked identity
      this.unlockedIdentities.set(ksIdentity.id, ksIdentity);

      return ksIdentity;
    } catch (err) {
      throw new KeyStoreError("Failed to import mnemonic backup", err);
    }
  }

  private static async deriveKeyFromMnemonic(
    mnemonic: string,
  ): Promise<CryptoKey> {
    const salt = new TextEncoder().encode(MAJIK_MNEMONIC_SALT);
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(mnemonic),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 200_000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
}
