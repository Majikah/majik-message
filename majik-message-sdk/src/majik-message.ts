// MajikMessage.ts

import {
  MajikContact,
  type MajikContactCard,
  type MajikContactMeta,
  type SerializedMajikContact,
} from "./core/contacts/majik-contact";
import { KEY_ALGO } from "./core/crypto/constants";
import { ScannerEngine } from "./core/scanner/scanner-engine";
import { MessageEnvelope } from "./core/messages/message-envelope";
import {
  EnvelopeCache,
  type EnvelopeCacheItem,
  type EnvelopeCacheJSON,
} from "./core/messages/envelope-cache";
import { EncryptionEngine } from "./core/crypto/encryption-engine";
import { KeyStore } from "./core/crypto/keystore";
import {
  MajikContactDirectory,
  type MajikContactDirectoryData,
} from "./core/contacts/majik-contact-directory";
import {
  arrayBufferToBase64,
  arrayToBase64,
  base64ToArrayBuffer,
  base64ToUtf8,
  MnemonicJSON,
  seedStringToArray,
  utf8ToBase64,
} from "./core/utils/utilities";
import {
  autoSaveMajikFileData,
  loadSavedMajikFileData,
} from "./core/utils/majik-file-utils";
import { randomBytes } from "@stablelib/random";
import {
  clearAllBlobs,
  idbLoadBlob,
  idbSaveBlob,
} from "./core/utils/idb-majik-system";
import type { MAJIK_API_RESPONSE, MultiRecipientPayload } from "./core/types";
import { MajikMessageChat } from "./core/database/chat/majik-message-chat";
import { MajikCompressor } from "./core/compressor/majik-compressor";
import { MajikMessageIdentity } from "./core/database/system/identity";
import { MajikKey } from "@majikah/majik-key";

type MajikMessageEvents =
  | "message"
  | "envelope"
  | "untrusted"
  | "error"
  | "new-account"
  | "new-contact"
  | "removed-account"
  | "removed-contact"
  | "active-account-change";

interface MajikMessageStatic<T extends MajikMessage> {
  new (config: MajikMessageConfig, id?: string): T;
  fromJSON(json: MajikMessageJSON): Promise<T>;
}

export interface MajikMessageConfig {
  keyStore: KeyStore;
  contactDirectory?: MajikContactDirectory;
  envelopeCache?: EnvelopeCache;
}

export interface MajikMessageJSON {
  id: string;
  contacts: MajikContactDirectoryData;
  envelopeCache: EnvelopeCacheJSON;
  ownAccounts?: {
    accounts: SerializedMajikContact[];
    order: string[];
  };
}

type EventCallback = (...args: any[]) => void;

export class MajikMessage {
  private userProfile: string = "default";

  // Optional PIN protection (hashed). If set, UI should prompt for PIN to unlock.
  private pinHash?: string | null = null;
  private id: string;
  private contactDirectory: MajikContactDirectory;
  private envelopeCache: EnvelopeCache;
  private scanner: ScannerEngine;
  private listeners: Map<MajikMessageEvents, EventCallback[]> = new Map();
  private ownAccounts: Map<string, MajikContact> = new Map();
  private ownAccountsOrder: string[] = []; // keeps the order of IDs, first is active
  private autosaveTimer: number | null = null;
  private autosaveIntervalMs = 15000; // periodic backup interval
  private autosaveDebounceMs = 500; // debounce for rapid changes
  private unlocked = false;

  constructor(
    config: MajikMessageConfig,
    id?: string,
    userProfile: string = "default",
  ) {
    this.userProfile = userProfile || "default";

    this.id = id || arrayToBase64(randomBytes(32));
    this.contactDirectory =
      config.contactDirectory || new MajikContactDirectory();
    this.envelopeCache =
      config.envelopeCache || new EnvelopeCache(undefined, userProfile);

    // Initialize scanner
    this.scanner = new ScannerEngine({
      contactDirectory: this.contactDirectory,
      onEnvelopeFound: (env) => this.handleEnvelope(env),
      onUntrusted: (raw) => this.emit("untrusted", raw),
      onError: (err, ctx) => this.emit("error", err, ctx),
    });

    // Prepare listeners map
    [
      "message",
      "envelope",
      "untrusted",
      "error",
      "new-account",
      "new-contact",
      "removed-account",
      "removed-contact",
      "active-account-change",
    ].forEach((e) => this.listeners.set(e as MajikMessageEvents, []));

    // Attach autosave handlers so state is persisted automatically
    this.attachAutosaveHandlers();
  }
  /* ================================
   * Account Management
   * ================================ */

  /**
   * Create a new account (generates identity via KeyStore) and add it as an own account.
   * Returns the created identity id and a backup blob (base64) that the user should store.
   */
  async createAccount(
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string; backup: string }> {
    const identity = await KeyStore.createIdentity(passphrase);

    // Import public key into a MajikContact
    const contact = new MajikContact({
      id: identity.id,
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      meta: { label: label || "" },
    });

    this.addOwnAccount(contact);

    const backup = await KeyStore.exportIdentityBackup(identity.id);

    return { id: identity.id, fingerprint: identity.fingerprint, backup };
  }

  /**
   * Import an account from a backup blob (created with `exportIdentityBackup`) and unlock it.
   */
  async importAccountFromBackup(
    backupBase64: string,
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string }> {
    await KeyStore.importIdentityBackup(backupBase64);

    // Unlock the imported identity
    const decoded = JSON.parse(base64ToUtf8(backupBase64));
    const id = decoded.id as string;
    const identity = await KeyStore.unlockIdentity(id, passphrase);

    const contact = new MajikContact({
      id: identity.id,
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      meta: { label: label || "" },
    });

    if (!!this.getOwnAccountById(identity.id)) {
      throw new Error("Account with the same ID already exists");
    }

    this.addOwnAccount(contact);
    return { id: identity.id, fingerprint: identity.fingerprint };
  }

  /**
   * Generate a BIP39 mnemonic for backup (12 words by default).
   */
  generateMnemonic(): string {
    return KeyStore.generateMnemonic();
  }

  /**
   * Export a mnemonic-encrypted backup for an unlocked identity.
   */
  async exportAccountMnemonicBackup(
    id: string,
    mnemonic: string,
  ): Promise<string> {
    return KeyStore.exportIdentityMnemonicBackup(id, mnemonic);
  }

  /**
   * Import an account from a mnemonic-encrypted backup blob and store it using `passphrase`.
   */
  async importAccountFromMnemonicBackup(
    backupBase64: string,
    mnemonic: string,
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string }> {
    const mJSON: MnemonicJSON = {
      id: backupBase64,
      seed: seedStringToArray(mnemonic),
      phrase: passphrase,
    };

    const importedIdentity = await MajikKey.fromMnemonicJSON(
      mJSON,
      passphrase,
      label,
    );

    await KeyStore.addMajikKey(importedIdentity);

    const accountContact = await importedIdentity.toContact().toJSON();
    const contact = MajikContact.fromJSON(accountContact);

    if (!!this.getOwnAccountById(importedIdentity.id)) {
      throw new Error("Account with the same ID already exists");
    }

    this.addOwnAccount(contact);
    return {
      id: importedIdentity.id,
      fingerprint: importedIdentity.fingerprint,
    };
  }

  /**
   * Create a new account deterministically from `mnemonic` and store it encrypted with `passphrase`.
   * Returns the created identity id (which equals fingerprint) and fingerprint.
   */
  async createAccountFromMnemonic(
    mnemonic: string,
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string; backup: string }> {
    const newAccount = await MajikKey.create(mnemonic, passphrase, label);

    await KeyStore.addMajikKey(newAccount);

    const accountContact = await newAccount.toContact().toJSON();
    const contact = MajikContact.fromJSON(accountContact);

    this.addOwnAccount(contact);
    return {
      id: newAccount.id,
      fingerprint: newAccount.fingerprint,
      backup: newAccount.backup,
    };
  }

  addOwnAccount(account: MajikContact) {
    if (!this.ownAccounts.has(account.id)) {
      this.ownAccounts.set(account.id, account);
      this.ownAccountsOrder.push(account.id);
    }
    try {
      if (!this.contactDirectory.hasContact(account.id)) {
        this.contactDirectory.addContact(account);
      }
      if (!this.getActiveAccount()) {
        this.setActiveAccount(account.id);
        this.unlocked = true;
      }
      this.emit("new-account", account);
    } catch (e) {
      // ignore if contact can't be added
    }
    this.scheduleAutosave();
  }

  listOwnAccounts(majikahOnly: boolean = false): MajikContact[] {
    let userAccounts = this.ownAccountsOrder
      .map((id) => this.ownAccounts.get(id))
      .filter((c): c is MajikContact => !!c);

    if (majikahOnly) {
      userAccounts = userAccounts.filter((acct) =>
        this.isContactMajikahRegistered(acct.id),
      );
    }

    return userAccounts;
  }

  getOwnAccountById(id: string) {
    return this.ownAccounts.get(id);
  }

  /**
   * Set an active account (moves it to index 0)
   */
  async setActiveAccount(
    id: string,
    bypassIdentity: boolean = false,
  ): Promise<boolean> {
    if (!this.ownAccounts.has(id)) return false;

    if (!bypassIdentity) {
      // Ensure identity is unlocked
      try {
        await this.ensureIdentityUnlocked(id);
      } catch (err) {
        console.warn("Failed to unlock account:", err);
        return false; // don't set as active if unlock fails
      }
    }

    const previousActive = this.getActiveAccount()?.id;

    // Remove ID from current position
    const index = this.ownAccountsOrder.indexOf(id);
    if (index > -1) this.ownAccountsOrder.splice(index, 1);

    // Add to the front
    this.ownAccountsOrder.unshift(id);
    this.scheduleAutosave();

    // 🔔 Emit the active account changed event
    if (previousActive !== id) {
      const newActive = this.getActiveAccount();
      this.emit("active-account-change", newActive, previousActive);
    }
    return true;
  }

  getActiveAccount(): MajikContact | null {
    if (this.ownAccountsOrder.length === 0) return null;
    return this.ownAccounts.get(this.ownAccountsOrder[0]) || null;
  }

  isAccountActive(id: string): boolean {
    if (!this.ownAccounts.has(id)) return false;
    if (this.ownAccountsOrder.length === 0) return false;
    return this.ownAccountsOrder[0] === id;
  }

  /**
   * Remove an own account from the in-memory registry.
   */
  removeOwnAccount(id: string): boolean {
    if (!this.ownAccounts.has(id)) return false;
    this.ownAccounts.delete(id);
    const idx = this.ownAccountsOrder.indexOf(id);
    if (idx > -1) this.ownAccountsOrder.splice(idx, 1);
    this.removeContact(id);
    // remove cached envelopes addressed to this identity
    this.envelopeCache.deleteByFingerprint(id).catch((error) => {
      console.warn("Account not found in cache: ", error);
    });
    this.emit("removed-account", id);
    this.scheduleAutosave();
    return true;
  }

  /**
   * Retrieve a contact from the directory by ID.
   * Validates that the input is a non-empty string.
   * Returns the MajikContact instance or null if not found.
   */
  getContactByID(id: string): MajikContact | null {
    if (typeof id !== "string" || !id.trim()) {
      throw new Error("Invalid contact ID: must be a non-empty string");
    }

    if (!this.contactDirectory.hasContact(id)) {
      return null; // Not found
    }

    return this.contactDirectory.getContact(id) ?? null;
  }

  /**
   * Retrieve a contact from the directory by its public key.
   * Validates that the input is a non-empty string.
   * Returns the MajikContact instance or null if not found.
   */
  async getContactByPublicKey(id: string): Promise<MajikContact | null> {
    if (typeof id !== "string" || !id.trim()) {
      throw new Error("Invalid contact ID: must be a non-empty string");
    }

    return (
      (await this.contactDirectory.getContactByPublicKeyBase64(id)) ?? null
    );
  }

  /**
   * Returns a JSON string representation of a contact
   * suitable for sharing.
   */
  async exportContactAsJSON(contactId: string): Promise<string | null> {
    const contact = this.contactDirectory.getContact(contactId);
    if (!contact) return null;

    // Support raw-key wrappers produced by the Stablelib provider
    let publicKeyBase64: string;
    const anyPub: any = contact.publicKey as any;
    if (anyPub && anyPub.raw instanceof Uint8Array) {
      publicKeyBase64 = arrayBufferToBase64(anyPub.raw.buffer);
    } else {
      const raw = await crypto.subtle.exportKey(
        "raw",
        contact.publicKey as CryptoKey,
      );
      publicKeyBase64 = arrayBufferToBase64(raw);
    }

    const payload: MajikContactCard = {
      id: contact.id,
      label: contact.meta?.label || "",
      publicKey: publicKeyBase64,
      fingerprint: contact.fingerprint,
    };

    return JSON.stringify(payload, null, 2); // pretty-print for easier copy-paste
  }

  /**
   * Returns a compact base64 string for sharing a contact.
   * Encodes JSON payload into base64.
   */
  async exportContactAsString(contactId: string): Promise<string | null> {
    const json = await this.exportContactAsJSON(contactId);
    if (!json) return null;

    return utf8ToBase64(json);
  }

  /* ================================
   * Contact Management
   * ================================ */

  async importContactFromJSON(jsonStr: string): Promise<MAJIK_API_RESPONSE> {
    try {
      const data: MajikContactCard = JSON.parse(jsonStr);
      if (!data.id || !data.publicKey || !data.fingerprint)
        return {
          success: false,
          message: "Invalid contact JSON",
        };

      // If publicKey is a base64 string, import it
      let publicKeyPromise: CryptoKey | { raw: Uint8Array };
      if (typeof data.publicKey === "string") {
        try {
          const rawBuffer = base64ToArrayBuffer(data.publicKey);

          try {
            publicKeyPromise = await crypto.subtle.importKey(
              "raw",
              rawBuffer,
              KEY_ALGO,
              true,
              [],
            );
          } catch (e) {
            // Fallback: create a raw-key wrapper when the browser does not support the namedCurve
            publicKeyPromise = { raw: new Uint8Array(rawBuffer) };
          }
        } catch (e) {
          console.error("Failed to parse publicKey base64", e);
          return {
            success: false,
            message: "Failed to parse publicKey base64",
          };
        }
      } else {
        // assume already a CryptoKey
        publicKeyPromise = await Promise.resolve(data.publicKey as CryptoKey);
      }

      const contact = new MajikContact({
        id: data.id,
        publicKey: publicKeyPromise,
        fingerprint: data.fingerprint,
        meta: { label: data.label },
      });
      this.addContact(contact);

      return {
        success: true,
        message: "Contact imported successfully",
      };
    } catch (err) {
      console.error("Failed to import contact from JSON:", err);
      return {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * List cached envelopes stored in the local cache (most recent first).
   * Returns objects: { id, envelope, timestamp, source }
   */
  async listCachedEnvelopes(
    offset = 0,
    limit = 50,
  ): Promise<EnvelopeCacheItem[]> {
    return await this.envelopeCache.listRecent(offset, limit);
  }

  /**
   * Clear cached envelopes stored in the local cache.
   */
  async clearCachedEnvelopes(): Promise<boolean> {
    const response = await this.envelopeCache.clear();

    if (!response?.success) {
      throw new Error(response.message);
    }

    this.scheduleAutosave();
    return response.success;
  }

  async hasOwnIdentity(fingerprint: string): Promise<boolean> {
    return await KeyStore.hasIdentity(fingerprint);
  }

  /**
   * Attempt to decrypt a given envelope and return the plaintext string.
   * Will prompt to unlock identity if necessary.
   */
  async decryptEnvelope(
    envelope: MessageEnvelope,
    bypassIdentity: boolean = false,
  ): Promise<string> {
    if (envelope.isGroup()) {
      // Group message - try all own accounts
      const ownAccounts = this.listOwnAccounts();

      if (ownAccounts.length === 0) {
        throw new Error("No own accounts available to decrypt group message");
      }

      for (const ownAccount of ownAccounts) {
        try {
          const privateKey = await this.ensureIdentityUnlocked(ownAccount.id);

          const decrypted = await EncryptionEngine.decryptGroupMessage(
            envelope.extractEncryptedPayload() as MultiRecipientPayload,
            privateKey,
            ownAccount.fingerprint,
          );

          // Decompress if needed
          let plaintext = decrypted;
          if (decrypted.startsWith("mjkcmp:")) {
            plaintext = (await MajikCompressor.decompress(
              "plaintext",
              decrypted,
            )) as string;
          }

          await this.envelopeCache.set(
            envelope,
            typeof window !== "undefined" && window.location
              ? window.location.hostname
              : "extension",
          );

          return plaintext;
        } catch (err) {
          // This account can't decrypt, try next
          continue;
        }
      }

      throw new Error("None of your accounts can decrypt this group message");
    } else {
      // Solo message - original logic
      const fingerprint = envelope.extractFingerprint();
      const ownAccount = this.listOwnAccounts().find(
        (a) => a.fingerprint === fingerprint,
      );

      if (!ownAccount) {
        throw new Error("No matching account to decrypt this envelope");
      }

      const privateKey = await this.ensureIdentityUnlocked(ownAccount.id);
      const decrypted = await EncryptionEngine.decryptSoloMessage(
        envelope.extractEncryptedPayload(),
        privateKey,
      );

      let plaintext = decrypted;
      if (decrypted.startsWith("mjkcmp:")) {
        plaintext = (await MajikCompressor.decompress(
          "plaintext",
          decrypted,
        )) as string;
      }

      await this.envelopeCache.set(
        envelope,
        typeof window !== "undefined" && window.location
          ? window.location.hostname
          : "extension",
      );

      return plaintext;
    }
  }

  async importContactFromString(base64Str: string): Promise<void> {
    const jsonStr = base64ToUtf8(base64Str);
    const isImportSuccess = await this.importContactFromJSON(jsonStr);

    if (!isImportSuccess.success) throw new Error(isImportSuccess.message);
  }

  addContact(contact: MajikContact): void {
    this.contactDirectory.addContact(contact);
    this.emit("new-contact", contact);
    this.scheduleAutosave();
  }

  removeContact(id: string): void {
    const removalStatus = this.contactDirectory.removeContact(id);
    if (!removalStatus.success) {
      throw new Error(removalStatus.message);
    }
    this.emit("removed-contact", id);
    this.scheduleAutosave();
  }

  updateContactMeta(id: string, meta: Partial<MajikContactMeta>): void {
    this.contactDirectory.updateContactMeta(id, meta);
    this.scheduleAutosave();
  }

  blockContact(id: string): void {
    this.contactDirectory.blockContact(id);
    this.scheduleAutosave();
  }

  unblockContact(id: string): void {
    this.contactDirectory.unblockContact(id);
    this.scheduleAutosave();
  }

  listContacts(
    all: boolean = true,
    majikahOnly: boolean = false,
  ): MajikContact[] {
    const contacts = this.contactDirectory.listContacts(true, majikahOnly);

    if (all) {
      return contacts;
    }

    const userAccounts = this.listOwnAccounts(majikahOnly);
    const userAccountIds = new Set(userAccounts.map((a) => a.id));

    return contacts.filter((contact) => !userAccountIds.has(contact.id));
  }

  isContactMajikahRegistered(id: string): boolean {
    return this.contactDirectory.isMajikahRegistered(id);
  }
  isContactMajikahIdentityChecked(id: string): boolean {
    return this.contactDirectory.isMajikahIdentityChecked(id);
  }

  setContactMajikahStatus(id: string, status: boolean): void {
    this.contactDirectory.setMajikahStatus(id, status);
    this.scheduleAutosave();
  }

  /**
   * Update the passphrase for an identity.
   * - `id` defaults to the current active account if not provided.
   * - Throws if no active account exists or passphrase is invalid.
   */
  async updatePassphrase(
    currentPassphrase: string,
    newPassphrase: string,
    id?: string,
  ): Promise<void> {
    // Determine target account
    const targetAccount = id
      ? this.getOwnAccountById(id)
      : this.getActiveAccount();

    if (!targetAccount) {
      throw new Error(
        "No target account specified and no active account available",
      );
    }

    // Delegate to KeyStore
    await KeyStore.updatePassphrase(
      targetAccount.id,
      currentPassphrase,
      newPassphrase,
    );

    // Optionally emit an event or autosave
    this.scheduleAutosave();
  }

  /* ================================
   * Encryption / Decryption
   * ================================ */

  /**
   * Encrypts a plaintext message for a single recipient (solo message)
   * Returns a MessageEnvelope instance and caches it automatically.
   */
  async encryptSoloMessage(
    toId: string,
    plaintext: string,
    cache: boolean = true,
  ): Promise<MessageEnvelope> {
    const contact = this.contactDirectory.getContact(toId);
    if (!contact) throw new Error(`No contact with id "${toId}"`);

    const payload = await EncryptionEngine.encryptSoloMessage(
      plaintext,
      contact.publicKey,
    );
    const payloadJSON = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payloadJSON);

    // Envelope: [version byte][fingerprint][payload]
    const versionByte = new Uint8Array([1]);
    const fingerprintBytes = new Uint8Array(
      base64ToArrayBuffer(contact.fingerprint),
    );

    const blob = new Uint8Array(
      versionByte.length + fingerprintBytes.length + payloadBytes.length,
    );
    blob.set(versionByte, 0);
    blob.set(fingerprintBytes, versionByte.length);
    blob.set(payloadBytes, versionByte.length + fingerprintBytes.length);

    const envelope = new MessageEnvelope(blob.buffer);

    if (!!cache) {
      // Cache envelope
      await this.envelopeCache.set(
        envelope,
        typeof window !== "undefined" && window.location
          ? window.location.hostname
          : "extension",
      );
    }

    this.scheduleAutosave();
    this.emit("envelope", envelope);

    return envelope;
  }

  /**
   * Encrypts a plaintext message for a group of recipients.
   * Returns a unified group MessageEnvelope instance.
   */
  async encryptGroupMessage(
    recipientIds: string[],
    plaintext: string,
    cache: boolean = true,
  ): Promise<MessageEnvelope> {
    if (!recipientIds.length) {
      throw new Error("No recipients provided");
    }

    // Resolve recipients and their keys
    const recipients = recipientIds.map((id) => {
      const contact = this.contactDirectory.getContact(id);
      if (!contact) throw new Error(`No contact with id "${id}"`);
      return {
        id: contact.id,
        publicKey: contact.publicKey,
        fingerprint: contact.fingerprint,
      };
    });

    // 🔐 Encrypt once for all recipients
    const payload = await EncryptionEngine.encryptGroupMessage(
      plaintext,
      recipients,
    );

    // Serialize payload
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

    // Envelope structure: [version byte][sender fingerprint][payload bytes]
    const versionByte = new Uint8Array([2]);

    // // Use sender fingerprint for group envelope
    // const activeAccount = this.getActiveAccount();
    // if (!activeAccount) throw new Error("No active account to send from");
    // const fingerprintBytes = new Uint8Array(
    //   base64ToArrayBuffer(activeAccount.fingerprint),
    // );

    // ✅ Use a special marker instead of a specific fingerprint
    // Option 1: All zeros to indicate "multi-recipient"
    const markerBytes = new Uint8Array(32).fill(0);

    // Combine all parts into a single Uint8Array
    const blob = new Uint8Array(
      versionByte.length + markerBytes.length + payloadBytes.length,
    );
    blob.set(versionByte, 0);
    blob.set(markerBytes, versionByte.length);
    blob.set(payloadBytes, versionByte.length + markerBytes.length);

    // Wrap as MessageEnvelope
    const envelope = new MessageEnvelope(blob.buffer);

    if (!!cache) {
      // Cache envelope
      await this.envelopeCache.set(
        envelope,
        typeof window !== "undefined" && window.location
          ? window.location.hostname
          : "extension",
      );
    }

    this.scheduleAutosave();
    this.emit("envelope", envelope);

    return envelope;
  }

  async sendMessage(
    recipients: string[],
    plaintext: string,
  ): Promise<MessageEnvelope> {
    if (recipients.length === 0 || !recipients) {
      throw new Error(
        "No recipients provided. At least one recipient is required.",
      );
    }

    if (recipients.length === 1) {
      return await this.encryptSoloMessage(recipients[0], plaintext);
    } else {
      return await this.encryptGroupMessage(recipients, plaintext);
    }
  }

  /* ================================
   * High-Level DOM Wrapper
   * ================================ */

  /**
   * Create a new MajikMessageChat with compression, then encrypt it.
   * Returns the scanner-ready string containing the encrypted compressed message.
   *
   * Flow: Plaintext → Compress (MajikMessageChat) → Encrypt (EncryptionEngine) → Scanner String
   */
  async createEncryptedMajikMessageChat(
    account: MajikMessageIdentity,
    recipients: string[],
    plaintext: string,
    expiresInMs?: number,
  ): Promise<{ messageChat: MajikMessageChat; scannerString: string }> {
    if (!plaintext?.trim()) {
      throw new Error("No text provided to encrypt.");
    }

    if (!recipients || recipients.length === 0) {
      const firstOwn = this.listOwnAccounts()[0];
      if (!firstOwn) {
        throw new Error("No own account available for encryption.");
      }
      recipients = [firstOwn.id];
    }

    if (!account) {
      throw new Error("No active account available to send message");
    }

    try {
      // Step 1: Create MajikMessageChat (compresses plaintext)
      const messageChat = await MajikMessageChat.create(
        account,
        plaintext,
        recipients,
        expiresInMs,
      );

      // Step 2: Get compressed message for encryption
      const compressedMessage = messageChat.getCompressedMessage();

      // Step 3: Encrypt the compressed message using EncryptionEngine
      let encryptedPayload: any;

      if (recipients.length === 1) {
        // Solo encryption
        const contact = this.contactDirectory.getContact(recipients[0]);
        if (!contact) {
          throw new Error(`No contact found for recipient: ${recipients[0]}`);
        }

        encryptedPayload = await EncryptionEngine.encryptSoloMessage(
          compressedMessage,
          contact.publicKey,
        );
      } else {
        // Group encryption
        const recipientData = recipients.map((id) => {
          const contact = this.contactDirectory.getContact(id);
          if (!contact) {
            throw new Error(`No contact found for recipient: ${id}`);
          }
          return {
            id: contact.id,
            publicKey: contact.publicKey,
          };
        });

        encryptedPayload = await EncryptionEngine.encryptGroupMessage(
          compressedMessage,
          recipientData,
        );
      }

      // Step 4: Convert encrypted payload to base64 string
      const payloadJSON = JSON.stringify(encryptedPayload);
      const payloadBase64 = utf8ToBase64(payloadJSON);

      // Step 5: Create scanner string with MAJIK prefix
      const scannerString = `${MessageEnvelope.PREFIX}:${payloadBase64}`;

      // Step 6: Update the messageChat with encrypted payload for storage
      messageChat.setMessage(payloadJSON); // Store encrypted version

      return { messageChat, scannerString };
    } catch (err) {
      this.emit("error", err, { context: "createEncryptedMajikMessageChat" });
      throw err;
    }
  }

  /**
   * Decrypt and decompress a MajikMessageChat message.
   *
   * Flow: Encrypted Payload → Decrypt (EncryptionEngine) → Decompress (MajikCompressor) → Plaintext
   */
  async decryptMajikMessageChat(
    encryptedPayload: string,
    recipientId?: string,
  ): Promise<string> {
    const recipient = recipientId
      ? this.getOwnAccountById(recipientId)
      : this.getActiveAccount();

    if (!recipient) {
      throw new Error("No recipient account found for decryption");
    }

    try {
      // Step 1: Ensure identity is unlocked
      const privateKey = await this.ensureIdentityUnlocked(recipient.id);

      // Step 2: Parse the encrypted payload
      const payload = JSON.parse(encryptedPayload);

      // Step 3: Decrypt using EncryptionEngine
      let decryptedCompressed: string;

      if (payload.keys) {
        // Group message
        decryptedCompressed = await EncryptionEngine.decryptGroupMessage(
          payload,
          privateKey,
          recipient.fingerprint,
        );
      } else {
        // Solo message
        decryptedCompressed = await EncryptionEngine.decryptSoloMessage(
          payload,
          privateKey,
        );
      }

      // Step 4: Decompress the message
      const plaintext =
        await MajikCompressor.decompressString(decryptedCompressed);

      return plaintext;
    } catch (err) {
      this.emit("error", err, { context: "decryptMajikMessageChat" });
      throw err;
    }
  }

  /**
   * Encrypts currently selected text in the browser DOM for given recipients.
   * If `recipients` is empty, defaults to the first own account.
   * Returns the fully serialized base64 envelope string for the scanner.
   */
  async encryptSelectedTextForScanner(
    recipients: string[] = [],
  ): Promise<string | null> {
    // Delegate to textarea-agnostic implementation
    const plaintext = window.getSelection()?.toString().trim() ?? "";
    return await this.encryptTextForScanner(plaintext, recipients);
  }

  /**
   * Encrypt a provided plaintext string and return a serialized MajikMessage envelope string.
   * Supports single or multiple recipients. Safe to call from background contexts.
   */
  async encryptTextForScanner(
    plaintext: string,
    recipients: string[] = [],
    cache: boolean = true,
  ): Promise<string | null> {
    if (!plaintext?.trim()) {
      console.warn("No text provided to encrypt.");
      return null;
    }

    try {
      // Determine recipients: default to first own account if none provided
      if (recipients.length === 0) {
        const firstOwn = this.listOwnAccounts()[0];
        if (!firstOwn)
          throw new Error("No own account available for encryption.");
        recipients = [firstOwn.id];
      }

      let envelope: MessageEnvelope;

      if (recipients.length === 1) {
        // Single recipient → solo message
        envelope = await this.encryptSoloMessage(
          recipients[0],
          plaintext,
          cache,
        );
      } else {
        // Multiple recipients → unified group message
        envelope = await this.encryptGroupMessage(recipients, plaintext, cache);
      }

      // Convert envelope to base64 for scanner
      const envelopeBase64 = arrayBufferToBase64(envelope.raw);
      return `${MessageEnvelope.PREFIX}:${envelopeBase64}`;
    } catch (err) {
      this.emit("error", err, { context: "encryptTextForScanner" });
      return null;
    }
  }

  /**
   * Encrypt text for a given target (label or ID).
   * - If target is self or not found, just encrypt normally.
   * - If target is another contact, always make a group message including self + target.
   */
  async encryptForTarget(
    target: string, // can be label or id
    plaintext: string,
  ): Promise<string | null> {
    const activeAccount = this.getActiveAccount();
    if (!activeAccount) throw new Error("No active account available");

    // Try to find contact by ID first
    let contact = this.listContacts(false).find((c) => c.id === target);

    // If not found by ID, try by label
    if (!contact) {
      contact = this.listContacts(false).find((c) => c.meta?.label === target);
    }

    // If still not found or it's self → solo encryption
    if (!contact || contact.id === activeAccount.id) {
      return this.encryptTextForScanner(plaintext, [activeAccount.id]);
    }

    // Otherwise → group with self + target contact
    return this.encryptTextForScanner(plaintext, [
      activeAccount.id,
      contact.id,
    ]);
  }

  /* ================================
   * DOM Scanning
   * ================================ */
  scanDOM(rootNode: Node): void {
    this.scanner.scanDOM(rootNode);
  }

  startDOMObserver(rootNode: Node): void {
    this.scanner.startDOMObserver(rootNode);
  }

  stopDOMObserver(): void {
    this.scanner.stopDOMObserver();
  }

  /* ================================
   * Event Handling
   * ================================ */
  on(event: MajikMessageEvents, callback: EventCallback): void {
    this.listeners.get(event)?.push(callback);
  }

  /**
   * Remove a previously registered event listener.
   * If `callback` is omitted, all listeners for the event are removed.
   */
  off(event: MajikMessageEvents, callback?: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks || callbacks.length === 0) return;

    if (callback) {
      // Remove only the specific callback
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    } else {
      // Remove all callbacks for this event
      this.listeners.set(event, []);
    }
  }

  private emit(event: MajikMessageEvents, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  /* ================================
   * Envelope Handling
   * ================================ */

  private async handleEnvelope(envelope: MessageEnvelope): Promise<void> {
    // Skip if already cached
    const cached = await this.envelopeCache.get(envelope);
    if (cached) return;

    const fingerprint = envelope.extractFingerprint();

    // Check if this is a group message (all zeros or special marker)
    const isGroupMessage = envelope.isGroup();

    if (isGroupMessage) {
      // For group messages, try all own accounts until one works
      const ownAccounts = this.listOwnAccounts();

      if (ownAccounts.length === 0) {
        this.emit("untrusted", envelope);
        return;
      }

      let decrypted: string | null = null;
      let successfulAccount: MajikContact | null = null;

      for (const ownAccount of ownAccounts) {
        try {
          const privateKey = await this.ensureIdentityUnlocked(ownAccount.id);

          // Try to decrypt with this account
          decrypted = await EncryptionEngine.decryptGroupMessage(
            envelope.extractEncryptedPayload() as MultiRecipientPayload,
            privateKey,
            ownAccount.fingerprint, // Use THIS account's fingerprint
          );

          successfulAccount = ownAccount;
          break; // Success! Stop trying other accounts
        } catch (err) {
          // This account doesn't have access, try next one
          continue;
        }
      }

      if (!decrypted || !successfulAccount) {
        this.emit("untrusted", envelope);
        return;
      }

      // Cache and emit
      await this.envelopeCache.set(
        envelope,
        typeof window !== "undefined" && window.location
          ? window.location.hostname
          : "extension",
      );

      this.scheduleAutosave();
      this.emit("message", decrypted, envelope, successfulAccount);
    } else {
      // Solo message - original logic
      const ownAccount = this.listOwnAccounts().find(
        (a) => a.fingerprint === fingerprint,
      );

      if (!ownAccount) {
        this.emit("untrusted", envelope);
        return;
      }

      try {
        const privateKey = await this.ensureIdentityUnlocked(ownAccount.id);
        const decrypted = await EncryptionEngine.decryptSoloMessage(
          envelope.extractEncryptedPayload(),
          privateKey,
        );

        await this.envelopeCache.set(
          envelope,
          typeof window !== "undefined" && window.location
            ? window.location.hostname
            : "extension",
        );

        this.scheduleAutosave();
        this.emit("message", decrypted, envelope, ownAccount);
      } catch (err) {
        this.emit("error", err, { envelope });
      }
    }
  }

  /**
   * Ensure an identity is unlocked. If locked, prompt the user for a passphrase.
   * `promptFn` can be provided to show a custom UI: either synchronous returning string
   * or async Promise<string>. If omitted, falls back to `window.prompt`.
   */
  async ensureIdentityUnlocked(
    id: string,
    promptFn?: (identityId: string) => string | Promise<string>,
  ): Promise<CryptoKey | { raw: Uint8Array }> {
    try {
      return await KeyStore.getPrivateKey(id);
    } catch (err: any) {
      // If KeyStore indicates unlocking is required, prompt the user
      const needsUnlock =
        err instanceof Error &&
        /must be unlocked|unlockIdentity/.test(err.message);
      if (!needsUnlock) throw err;

      // Ask for passphrase
      let passphrase: string | null = null;
      if (promptFn) {
        const res = promptFn(id);
        passphrase = typeof res === "string" ? res : await res;
      } else if (KeyStore.onUnlockRequested) {
        const res = KeyStore.onUnlockRequested(id);
        passphrase = typeof res === "string" ? res : await res;
      } else if (typeof window !== "undefined" && window.prompt) {
        passphrase = window.prompt("Enter passphrase to unlock identity:", "");
      }

      if (!passphrase) {
        this.unlocked = false;
        throw new Error("Unlock cancelled");
      }

      // Attempt to unlock
      await KeyStore.unlockIdentity(id, passphrase);
      this.unlocked = true;
      return await KeyStore.getPrivateKey(id);
    }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  async isPassphraseValid(passphrase: string, id?: string): Promise<boolean> {
    const target = id ? this.getOwnAccountById(id) : this.getActiveAccount();

    if (!target) return false;

    return KeyStore.isPassphraseValid(target.id, passphrase);
  }

  async toJSON(): Promise<MajikMessageJSON> {
    const finalJSON: MajikMessageJSON = {
      id: this.id,
      contacts: await this.contactDirectory.toJSON(),
      envelopeCache: this.envelopeCache.toJSON(),
    };
    // Serialize own accounts (preserve order)
    try {
      const ownAccountsArr: Awaited<ReturnType<MajikContact["toJSON"]>>[] = [];
      for (const id of this.ownAccountsOrder) {
        const acct = this.ownAccounts.get(id);
        if (!acct) continue;
        ownAccountsArr.push(await acct.toJSON());
      }
      finalJSON.ownAccounts = {
        accounts: ownAccountsArr,
        order: [...this.ownAccountsOrder],
      };
    } catch (e) {
      // ignore serialization errors for own accounts
      console.warn("Failed to serialize ownAccounts:", e);
    }
    // include optional PIN hash
    (finalJSON as any).pinHash = this.pinHash || null;
    return finalJSON;
  }

  static async fromJSON<T extends MajikMessage>(
    this: new (config: MajikMessageConfig, id?: string) => T,
    json: MajikMessageJSON,
  ): Promise<T> {
    const newDirectory = new MajikContactDirectory();
    const parsedContacts = await newDirectory.fromJSON(json.contacts);
    const parsedEnvelopeCache = EnvelopeCache.fromJSON(json.envelopeCache);

    const parsedInstance = new this(
      {
        contactDirectory: parsedContacts,
        envelopeCache: parsedEnvelopeCache,
        keyStore: KeyStore,
      },
      json.id,
    );

    // Restore ownAccounts if present
    try {
      if (json.ownAccounts && Array.isArray(json.ownAccounts.accounts)) {
        for (const acct of json.ownAccounts.accounts) {
          try {
            const raw = base64ToArrayBuffer((acct as any).publicKeyBase64);
            const publicKey = await crypto.subtle.importKey(
              "raw",
              raw,
              KEY_ALGO,
              true,
              [],
            );
            const contact = MajikContact.create(
              (acct as any).id,
              publicKey,
              (acct as any).fingerprint,
              (acct as any).meta,
            );
            parsedInstance.ownAccounts.set(contact.id, contact);
          } catch (e) {
            // SubtleCrypto may not support importing X25519 keys in some environments.
            // This is non-fatal: we fall back to raw-key wrappers elsewhere.
            console.info(
              "Fallback restoring own account (using raw-key wrapper)",
              (acct as any).id,
              e,
            );
          }
        }
        if (Array.isArray(json.ownAccounts.order)) {
          parsedInstance.ownAccountsOrder = [...json.ownAccounts.order];
        }
        // Fallback: if accounts array was empty but order exists, try to populate
        // ownAccounts from the restored contactDirectory entries
        try {
          if (
            Array.isArray(json.ownAccounts.order) &&
            parsedInstance.ownAccounts.size === 0
          ) {
            for (const id of json.ownAccounts.order) {
              try {
                const c = parsedInstance.contactDirectory.getContact(id);
                if (c) parsedInstance.ownAccounts.set(id, c);
              } catch (e) {
                // ignore missing contacts
              }
            }
          }
        } catch (e) {
          // ignore
        }
        // Also add own accounts into contact directory for discoverability
        try {
          parsedInstance.ownAccountsOrder.forEach((id) => {
            const c = parsedInstance.ownAccounts.get(id);
            if (c && !parsedInstance.contactDirectory.hasContact(c.id)) {
              parsedInstance.contactDirectory.addContact(c);
            }
          });
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.warn("Error restoring ownAccounts:", e);
    }
    // restore pin hash if present
    try {
      const anyJson: any = json as any;
      if (anyJson.pinHash) parsedInstance.pinHash = anyJson.pinHash;
    } catch (e) {
      // ignore
    }
    return parsedInstance;
  }

  /**
   * Set a PIN (stores hash). Passphrase is any string; we store SHA-256(base64) of it.
   */
  async setPIN(pin: string): Promise<void> {
    if (!pin) throw new Error("PIN must be a non-empty string");
    const hash = await MajikMessage.hashPIN(pin);
    this.pinHash = hash;
    this.scheduleAutosave();
  }

  async clearPIN(): Promise<void> {
    this.pinHash = null;
    this.scheduleAutosave();
  }

  async isValidPIN(pin: string): Promise<boolean> {
    if (!this.pinHash) return true; // no PIN set => always valid
    const hash = await MajikMessage.hashPIN(pin);
    return hash === this.pinHash;
  }

  getPinHash(): string | null {
    return this.pinHash || null;
  }

  private static async hashPIN(pin: string): Promise<string> {
    const data = new TextEncoder().encode(pin);
    const digest = await crypto.subtle.digest("SHA-256", data);
    // base64 encode
    const b64 = arrayBufferToBase64(digest as ArrayBuffer);
    return b64;
  }

  /* ================================
   * Persistence
   * ================================ */
  private autosaveIntervalId: number | null = null;

  private attachAutosaveHandlers() {
    if (typeof window !== "undefined") {
      // Save before unload (best-effort)
      try {
        window.addEventListener("beforeunload", () => {
          void this.saveState();
        });
      } catch (e) {
        // ignore
      }
      // Start periodic backups
      this.startAutosave();
    }
  }

  startAutosave() {
    if (this.autosaveIntervalId) return;
    if (typeof window === "undefined") return;
    this.autosaveIntervalId = window.setInterval(() => {
      void this.saveState();
    }, this.autosaveIntervalMs) as unknown as number;
  }

  stopAutosave() {
    if (!this.autosaveIntervalId) return;
    if (typeof window !== "undefined") {
      window.clearInterval(this.autosaveIntervalId);
    }
    this.autosaveIntervalId = null;
  }

  private scheduleAutosave() {
    try {
      if (this.autosaveTimer) {
        if (typeof window !== "undefined")
          window.clearTimeout(this.autosaveTimer);
        this.autosaveTimer = null;
      }
      if (typeof window !== "undefined") {
        this.autosaveTimer = window.setTimeout(() => {
          void this.saveState();
          this.autosaveTimer = null;
        }, this.autosaveDebounceMs) as unknown as number;
      }
    } catch (e) {
      // ignore scheduling errors
    }
  }

  /** Save current state into IndexedDB (autosave). */
  async saveState(): Promise<void> {
    try {
      const jsonDocument = await this.toJSON();
      const autosaveBlob = autoSaveMajikFileData(jsonDocument);
      await idbSaveBlob("majik-message-state", autosaveBlob, this.userProfile);
    } catch (err) {
      console.error("Failed to save MajikMessage state:", err);
    }
  }

  /** Load state from IndexedDB and apply to this instance. */
  async loadState(): Promise<void> {
    try {
      const autosaveData = await idbLoadBlob(
        "majik-message-state",
        this.userProfile,
      );
      if (!autosaveData?.data) return;
      const blobFile = autosaveData.data;
      const loadedData = await loadSavedMajikFileData(blobFile);
      const parsedJSON = loadedData.j as MajikMessageJSON;

      // Use fromJSON to ensure ownAccounts and other fields are restored consistently
      const restored = await MajikMessage.fromJSON(parsedJSON);
      this.id = restored.id;
      this.contactDirectory = restored.contactDirectory;
      this.envelopeCache = restored.envelopeCache;
      this.ownAccounts = restored.ownAccounts;
      this.ownAccountsOrder = [...restored.ownAccountsOrder];
    } catch (err) {
      console.error("Failed to load MajikMessage state:", err);
    }
  }

  /**
   * Try to load an existing state from IDB; if none exists, create a fresh instance and save it.
   */
  static async loadOrCreate<T extends MajikMessage>(
    this: MajikMessageStatic<T>,
    config: MajikMessageConfig,
    userProfile: string = "default",
  ): Promise<T> {
    try {
      const saved = await idbLoadBlob("majik-message-state", userProfile);

      if (saved?.data) {
        const loaded = await loadSavedMajikFileData(saved.data);
        const parsedJSON = loaded.j as MajikMessageJSON;

        const instance = (await this.fromJSON(parsedJSON)) as T;
        console.log("Account Loaded Successfully");

        instance.attachAutosaveHandlers();
        return instance;
      }
    } catch (err) {
      console.warn("Error trying to load saved MajikMessage state:", err);
    }

    // No saved state → create new subclass instance
    const created = new this(config);
    await created.saveState();
    created.attachAutosaveHandlers();

    return created;
  }

  /**
   * Reset all data to a fresh state.
   * Clears cache, own accounts, contact directory, keystore, and saved data.
   * WARNING: This operation is irreversible and will delete all user data.
   */
  async resetData(userProfile: string = "default"): Promise<void> {
    try {
      // 1. Clear envelope cache
      await this.clearCachedEnvelopes();

      // 2. Clear all own accounts from keystore
      const accountIds = [...this.ownAccountsOrder];
      for (const id of accountIds) {
        try {
          // Delete from KeyStore storage
          await KeyStore.deleteIdentity?.(id).catch(() => {});
        } catch (e) {
          console.warn(`Failed to delete identity ${id} from KeyStore:`, e);
        }
      }

      // 3. Clear own accounts map and order
      this.ownAccounts.clear();
      this.ownAccountsOrder = [];

      // 4. Clear contact directory

      try {
        this.contactDirectory.clear();
      } catch (e) {
        console.warn(`Failed to clear contacts directory: `, e);
      }

      // 5. Clear PIN hash
      this.pinHash = null;

      // 6. Reset unlocked state
      this.unlocked = false;

      // 7. Clear saved state from IndexedDB
      try {
        await clearAllBlobs(userProfile);
      } catch (e) {
        console.warn("Failed to clear saved state from IndexedDB:", e);
      }

      // 8. Generate new ID for fresh instance
      this.id = arrayToBase64(randomBytes(32));

      // 9. Stop and restart autosave to ensure clean state
      this.stopAutosave();
      this.startAutosave();

      this.emit("active-account-change", null);

      console.log("MajikMessage data reset successfully");
    } catch (err) {
      console.error("Error during resetData:", err);
      throw new Error(
        `Failed to reset data: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
