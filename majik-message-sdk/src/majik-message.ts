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
import { MajikKeyStore } from "./core/crypto/keystore";
import {
  MajikContactDirectory,
  type MajikContactDirectoryData,
} from "./core/contacts/majik-contact-directory";
import {
  arrayBufferToBase64,
  arrayToBase64,
  base64ToArrayBuffer,
  base64ToUint8Array,
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
import type {
  DecryptFileOptions,
  EncryptFileOptions,
  EncryptFileResult,
  MAJIK_API_RESPONSE,
  MajikMessagePublicKey,
} from "./core/types";
import { MajikMessageChat } from "./core/database/chat/majik-message-chat";
import { MajikMessageIdentity } from "./core/database/system/identity";
import { MajikKey } from "@majikah/majik-key";
import {
  MajikEnvelope,
  type MajikRecipient,
  type MajikIdentity,
} from "@majikah/majik-envelope";
import {
  MajikFile,
  MajikFileError,
  type MajikFileIdentity,
  type MajikFileRecipient,
} from "@majikah/majik-file";

import { gzipSync, gunzipSync } from "fflate";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  keyStore?: typeof MajikKeyStore; // optional — MajikKeyStore is static
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

// ─── MajikMessage ─────────────────────────────────────────────────────────────

export class MajikMessage {
  private userProfile: string = "default";
  private pinHash?: string | null = null;
  private id: string;
  private contactDirectory: MajikContactDirectory;
  private envelopeCache: EnvelopeCache;
  private scanner: ScannerEngine;
  private listeners: Map<MajikMessageEvents, EventCallback[]> = new Map();
  private ownAccounts: Map<string, MajikContact> = new Map();
  private ownAccountsOrder: string[] = [];
  private autosaveTimer: number | null = null;
  private autosaveIntervalId: number | null = null;
  private readonly autosaveIntervalMs = 15_000;
  private readonly autosaveDebounceMs = 500;

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

    this.scanner = new ScannerEngine({
      contactDirectory: this.contactDirectory,
      onEnvelopeFound: (env) => this.handleEnvelope(env),
      onUntrusted: (raw) => this.emit("untrusted", raw),
      onError: (err, ctx) => this.emit("error", err, ctx),
    });

    const events: MajikMessageEvents[] = [
      "message",
      "envelope",
      "untrusted",
      "error",
      "new-account",
      "new-contact",
      "removed-account",
      "removed-contact",
      "active-account-change",
    ];
    events.forEach((e) => this.listeners.set(e, []));

    this.attachAutosaveHandlers();
  }

  // ── Private: Envelope helpers ────────────────────────────────────────────

  /**
   * Resolve a list of account/contact IDs into MajikRecipient objects.
   * Each recipient needs their ML-KEM public key from MajikKeyStore.
   */
  private async _resolveRecipients(ids: string[]): Promise<MajikRecipient[]> {
    return Promise.all(
      ids.map(async (id) => {
        const contact = this.contactDirectory.getContact(id);
        if (!contact) throw new Error(`No contact found for id "${id}"`);

        // const key = await MajikKeyStore.load(id);

        const mlPubKey = base64ToUint8Array(contact.mlKey);

        if (!mlPubKey) {
          throw new Error(
            `Contact "${id}" has no ML-KEM public key. ` +
              `They may need to upgrade their account via importFromMnemonicBackup().`,
          );
        }

        return {
          fingerprint: contact.fingerprint,
          mlKemPublicKey: mlPubKey,
        } satisfies MajikRecipient;
      }),
    );
  }

  /**
   * Resolve a list of account/contact IDs into MajikRecipient objects.
   * Each recipient needs their ML-KEM public key from MajikKeyStore.
   */
  private async _resolveRecipientsByPublicKey(
    publicKeys: MajikMessagePublicKey[],
  ): Promise<MajikRecipient[]> {
    return Promise.all(
      publicKeys.map(async (pkey) => {
        const contact =
          await this.contactDirectory.getContactByPublicKeyBase64(pkey);
        if (!contact)
          throw new Error(`No contact found for public key "${pkey}"`);

        const mlPubKey = base64ToUint8Array(contact.mlKey);

        if (!mlPubKey) {
          throw new Error(
            `Contact "${pkey}" has no ML-KEM public key. ` +
              `They may need to upgrade their account via importFromMnemonicBackup().`,
          );
        }

        return {
          fingerprint: contact.fingerprint,
          mlKemPublicKey: mlPubKey,
        } satisfies MajikRecipient;
      }),
    );
  }

  /**
   * Resolve the decryption identity for an own account.
   * Ensures the account is unlocked and has ML-KEM keys.
   */
  private async _resolveIdentity(
    id: string,
    promptFn?: (id: string) => string | Promise<string>,
  ): Promise<MajikIdentity> {
    await MajikKeyStore.ensureUnlocked(id, promptFn);
    const key = MajikKeyStore.get(id);
    if (!key) throw new Error(`Account not found: ${id}`);
    if (!key.hasMlKem) {
      throw new Error(
        `Account "${id}" has no ML-KEM keys. ` +
          `Re-import via importAccountFromMnemonicBackup() to upgrade.`,
      );
    }
    return {
      fingerprint: key.fingerprint,
      mlKemSecretKey: key.getMlKemSecretKey(),
    } satisfies MajikIdentity;
  }

  /**
   * Resolve the full MajikFileIdentity for an own account.
   *
   * Carries both the public key (needed for encryption) and the secret key
   * (needed for decryption), unlike _resolveIdentity() which only returns the
   * secret key for MajikEnvelope.
   *
   * @param accountId  Own account ID. Defaults to the active account.
   */
  private async _resolveFileIdentity(
    accountId?: string,
  ): Promise<MajikFileIdentity> {
    const id = accountId ?? this.getActiveAccount()?.id;
    if (!id)
      throw new Error("No active account — call setActiveAccount() first");

    await MajikKeyStore.ensureUnlocked(id);
    const key = MajikKeyStore.get(id);
    if (!key) throw new Error(`Account not found in keystore: "${id}"`);
    if (!key.hasMlKem) {
      throw new Error(
        `Account "${id}" has no ML-KEM keys. ` +
          `Re-import via importAccountFromMnemonicBackup() to upgrade.`,
      );
    }

    return {
      publicKey: key.publicKeyBase64,
      fingerprint: key.fingerprint,
      mlKemPublicKey: key.mlKemPublicKey,
      mlKemSecretKey: key.getMlKemSecretKey(),
    } satisfies MajikFileIdentity;
  }

  /**
   * Resolve a list of contact IDs into MajikFileRecipient objects.
   *
   * Used for group file encryption — each recipient only needs their ML-KEM
   * public key. Secret keys never leave their respective devices.
   *
   * @param ids  Contact IDs from the contact directory.
   */
  private async _resolveFileRecipientsByPublicKey(
    publicKeys: MajikMessagePublicKey[],
  ): Promise<MajikFileRecipient[]> {
    return Promise.all(
      publicKeys.map(async (pkey) => {
        const contact =
          await this.contactDirectory.getContactByPublicKeyBase64(pkey);
        if (!contact)
          throw new Error(`No contact found for public key "${pkey}"`);

        const mlPubKey = base64ToUint8Array(contact.mlKey);

        if (!mlPubKey) {
          throw new Error(
            `Contact "${pkey}" has no ML-KEM public key. ` +
              `They may need to upgrade their account via importFromMnemonicBackup().`,
          );
        }
        return {
          fingerprint: contact.fingerprint,
          mlKemPublicKey: mlPubKey,
          publicKey: pkey,
        } satisfies MajikFileRecipient;
      }),
    );
  }

  /** Canonical source for the scanner hostname tag. */
  private get _source(): string {
    return typeof window !== "undefined" && window.location
      ? window.location.hostname
      : "extension";
  }

  // ── Account Management ────────────────────────────────────────────────────

  generateMnemonic(): string {
    return MajikKeyStore.generateMnemonic();
  }

  async exportAccountMnemonicBackup(
    id: string,
    mnemonic: string,
  ): Promise<string> {
    return MajikKeyStore.exportMnemonicBackup(id, mnemonic);
  }

  /**
   * Import an account from a mnemonic-encrypted backup.
   * Fully upgrades to Argon2id KDF + ML-KEM keys in one step.
   */
  async importAccountFromMnemonicBackup(
    backupBase64: string,
    mnemonic: string,
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string }> {
    const key = await MajikKeyStore.importFromMnemonicBackup(
      backupBase64,
      mnemonic,
      passphrase,
      label,
    );

    if (this.getOwnAccountById(key.id)) {
      throw new Error("Account with the same ID already exists");
    }
    const keyContact = key.toContact();
    const contactJSON = await keyContact.toJSON();
    const reParsedContact = MajikContact.fromJSON(contactJSON);

    this.addOwnAccount(reParsedContact);
    return { id: key.id, fingerprint: key.fingerprint };
  }

  /**
   * Create a new account from a mnemonic, store it encrypted with passphrase.
   */
  async createAccountFromMnemonic(
    mnemonic: string,
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string; backup: string }> {
    const key = await MajikKey.create(mnemonic, passphrase, label);
    await MajikKeyStore.addMajikKey(key);

    const keyContact = await key.toContact().toJSON();

    const reParsedContact = MajikContact.fromJSON(keyContact);

    this.addOwnAccount(reParsedContact);
    return { id: key.id, fingerprint: key.fingerprint, backup: key.backup };
  }

  addOwnAccount(account: MajikContact): void {
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
      }
      this.emit("new-account", account);
    } catch {
      // ignore if contact can't be added
    }
    this.scheduleAutosave();
  }

  listOwnAccounts(majikahOnly = false): MajikContact[] {
    let accounts = this.ownAccountsOrder
      .map((id) => this.ownAccounts.get(id))
      .filter((c): c is MajikContact => !!c);

    if (majikahOnly) {
      accounts = accounts.filter((a) => this.isContactMajikahRegistered(a.id));
    }
    return accounts;
  }

  getOwnAccountById(id: string): MajikContact | undefined {
    return this.ownAccounts.get(id);
  }

  async setActiveAccount(id: string, bypassIdentity = false): Promise<boolean> {
    if (!this.ownAccounts.has(id)) return false;

    if (!bypassIdentity) {
      try {
        await this.ensureIdentityUnlocked(id);
      } catch {
        return false;
      }
    }

    const previousActive = this.getActiveAccount()?.id;
    const index = this.ownAccountsOrder.indexOf(id);
    if (index > -1) this.ownAccountsOrder.splice(index, 1);
    this.ownAccountsOrder.unshift(id);
    this.scheduleAutosave();

    if (previousActive !== id) {
      this.emit(
        "active-account-change",
        this.getActiveAccount(),
        previousActive,
      );
    }
    return true;
  }

  getActiveAccount(): MajikContact | null {
    if (!this.ownAccountsOrder.length) return null;
    return this.ownAccounts.get(this.ownAccountsOrder[0]) ?? null;
  }

  isAccountActive(id: string): boolean {
    return !!this.ownAccounts.has(id) && this.ownAccountsOrder[0] === id;
  }

  removeOwnAccount(id: string): boolean {
    if (!this.ownAccounts.has(id)) return false;
    this.ownAccounts.delete(id);
    const idx = this.ownAccountsOrder.indexOf(id);
    if (idx > -1) this.ownAccountsOrder.splice(idx, 1);
    this.removeContact(id);
    this.envelopeCache.deleteByFingerprint(id).catch(() => {});
    this.emit("removed-account", id);
    this.scheduleAutosave();
    return true;
  }

  async hasOwnIdentity(fingerprint: string): Promise<boolean> {
    return MajikKeyStore.hasIdentity(fingerprint);
  }

  async updatePassphrase(
    currentPassphrase: string,
    newPassphrase: string,
    id?: string,
  ): Promise<void> {
    const target = id ? this.getOwnAccountById(id) : this.getActiveAccount();
    if (!target) throw new Error("No target account specified");
    await MajikKeyStore.updatePassphrase(
      target.id,
      currentPassphrase,
      newPassphrase,
    );
    this.scheduleAutosave();
  }

  // ── Contact Management ────────────────────────────────────────────────────

  getContactByID(id: string): MajikContact | null {
    if (!id?.trim()) throw new Error("Invalid contact ID");
    return this.contactDirectory.getContact(id) ?? null;
  }

  async getContactByPublicKey(
    publicKeyBase64: string,
  ): Promise<MajikContact | null> {
    if (!publicKeyBase64?.trim()) throw new Error("Invalid public key");
    return (
      (await this.contactDirectory.getContactByPublicKeyBase64(
        publicKeyBase64,
      )) ?? null
    );
  }

  async exportContactAsJSON(contactId: string): Promise<string | null> {
    const contact = this.contactDirectory.getContact(contactId);
    if (!contact) return null;

    let publicKeyBase64: string;
    const anyPub: any = contact.publicKey;
    if (anyPub?.raw instanceof Uint8Array) {
      publicKeyBase64 = arrayBufferToBase64(anyPub.raw.buffer);
    } else {
      const raw = await crypto.subtle.exportKey(
        "raw",
        contact.publicKey as CryptoKey,
      );
      publicKeyBase64 = arrayBufferToBase64(raw);
    }

    return JSON.stringify(
      {
        id: contact.id,
        label: contact.meta?.label || "",
        publicKey: publicKeyBase64,
        fingerprint: contact.fingerprint,
        mlKey: contact.mlKey,
      } satisfies MajikContactCard,
      null,
      2,
    );
  }

  async exportContactAsString(contactId: string): Promise<string | null> {
    const contact = this.contactDirectory.getContact(contactId);
    if (!contact) return null;

    const compressedString = this.exportContactCompressed(contact);
    return compressedString;
  }

  async importContactFromJSON(jsonStr: string): Promise<MAJIK_API_RESPONSE> {
    try {
      const data: MajikContactCard = JSON.parse(jsonStr);
      if (!data.id || !data.publicKey || !data.fingerprint) {
        return { success: false, message: "Invalid contact JSON" };
      }

      const rawBuffer = base64ToArrayBuffer(data.publicKey as string);
      let publicKey: CryptoKey | { raw: Uint8Array };
      try {
        publicKey = await crypto.subtle.importKey(
          "raw",
          rawBuffer,
          KEY_ALGO,
          true,
          [],
        );
      } catch {
        publicKey = { raw: new Uint8Array(rawBuffer) };
      }

      this.addContact(
        new MajikContact({
          id: data.id,
          publicKey,
          fingerprint: data.fingerprint,
          meta: { label: data.label },
          mlKey: data.mlKey,
        }),
      );

      return { success: true, message: "Contact imported successfully" };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async importContactFromString(
    base64Str: string,
  ): Promise<MAJIK_API_RESPONSE> {
    try {
      const parsedContact = await this.importContactCompressed(base64Str);

      this.addContact(parsedContact);
      return { success: true, message: "Contact imported successfully" };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async exportContactCompressed(contact: MajikContact): Promise<string> {
    // Prepare JSON with raw keys
    let publicKeyBase64: string;
    const anyPub: any = contact.publicKey;
    if (anyPub?.raw instanceof Uint8Array) {
      publicKeyBase64 = arrayBufferToBase64(anyPub.raw.buffer);
    } else {
      const raw = await crypto.subtle.exportKey(
        "raw",
        contact.publicKey as CryptoKey,
      );
      publicKeyBase64 = arrayBufferToBase64(raw);
    }

    const jsonObj: MajikContactCard = {
      id: contact.id,
      label: contact.meta?.label || "",
      publicKey: publicKeyBase64,
      fingerprint: contact.fingerprint,
      mlKey: contact.mlKey,
    };

    const jsonStr = JSON.stringify(jsonObj);

    const utf8 = new TextEncoder().encode(jsonStr);

    // Compress with gzip or Brotli
    const compressed = gzipSync(utf8);

    // Encode for string export
    return arrayToBase64(compressed);
  }

  async importContactCompressed(base64Str: string): Promise<MajikContact> {
    const compressed = base64ToArrayBuffer(base64Str);
    const decompressed = gunzipSync(new Uint8Array(compressed));
    const jsonStr = new TextDecoder().decode(decompressed);

    const data: any = JSON.parse(jsonStr);

    const rawBuffer = base64ToArrayBuffer(data.publicKey as string);
    let publicKey: CryptoKey | { raw: Uint8Array };
    try {
      publicKey = await crypto.subtle.importKey(
        "raw",
        rawBuffer,
        KEY_ALGO,
        true,
        [],
      );
    } catch {
      publicKey = { raw: new Uint8Array(rawBuffer) };
    }

    return new MajikContact({
      id: data.id,
      publicKey,
      fingerprint: data.fingerprint,
      meta: { label: data.label },
      mlKey: data.mlKey,
    });
  }

  addContact(contact: MajikContact): void {
    this.contactDirectory.addContact(contact);
    this.emit("new-contact", contact);
    this.scheduleAutosave();
  }

  removeContact(id: string): void {
    const result = this.contactDirectory.removeContact(id);
    if (!result.success) throw new Error(result.message);
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

  listContacts(all = true, majikahOnly = false): MajikContact[] {
    const contacts = this.contactDirectory.listContacts(true, majikahOnly);
    if (all) return contacts;
    const ownIds = new Set(this.listOwnAccounts(majikahOnly).map((a) => a.id));
    return contacts.filter((c) => !ownIds.has(c.id));
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

  // ── Encryption / Decryption ───────────────────────────────────────────────

  /**
   * Compose and encrypt a message for one or more recipients.
   * Single recipient → solo envelope. Two or more → group envelope.
   * Returns a scanner-ready string: ~*$MJKMSG:<base64>
   */
  async composeMessage(
    recipientPublicKeys: MajikMessagePublicKey[],
    plaintext: string,
    cache = true,
  ): Promise<string> {
    if (!recipientPublicKeys.length)
      throw new Error("At least one recipient is required");

    const recipients =
      await this._resolveRecipientsByPublicKey(recipientPublicKeys);
    const sender = this.getActiveAccount();

    const envelope = await MajikEnvelope.encrypt({
      plaintext,
      recipients,
      senderFingerprint:
        recipients.length > 1 ? sender?.fingerprint : undefined,
      compress: true,
    });

    const scannerString = envelope.toScannerString();

    if (cache) {
      await this.envelopeCache.set(
        new MessageEnvelope(envelope.toBinary()),
        this._source,
      );
    }

    this.scheduleAutosave();
    this.emit("envelope", envelope);
    return scannerString;
  }

  /**
   * Decrypt a MessageEnvelope (from scanner or cache).
   * Tries all own accounts for group envelopes.
   * Returns plaintext string.
   */
  async decryptEnvelope(envelope: MessageEnvelope): Promise<string> {
    const majikEnvelope = MajikEnvelope.fromBinary(envelope.raw);

    if (majikEnvelope.isGroup) {
      for (const account of this.listOwnAccounts()) {
        try {
          const identity = await this._resolveIdentity(account.id);
          const plaintext = await majikEnvelope.decrypt(identity);
          await this.envelopeCache.set(envelope, this._source);
          return plaintext;
        } catch {
          continue;
        }
      }
      throw new Error("None of your accounts can decrypt this group message");
    } else {
      const fingerprint = envelope.extractFingerprint();
      const account = this.listOwnAccounts().find(
        (a) => a.fingerprint === fingerprint,
      );
      if (!account)
        throw new Error("No matching account to decrypt this envelope");

      const identity = await this._resolveIdentity(account.id);
      const plaintext = await majikEnvelope.decrypt(identity);
      await this.envelopeCache.set(envelope, this._source);
      return plaintext;
    }
  }

  /**
   * Encrypt text and return a scanner string.
   * Defaults to first own account if no recipients given.
   */
  async encryptTextForScanner(
    plaintext: string,
    recipientPubKeys: MajikMessagePublicKey[] = [],
    cache = true,
  ): Promise<string | null> {
    if (!plaintext?.trim()) return null;

    try {
      if (!recipientPubKeys.length) {
        const first = this.listOwnAccounts()[0];
        if (!first) throw new Error("No own account available for encryption");
        recipientPubKeys = [first.id];
      }
      return await this.composeMessage(recipientPubKeys, plaintext, cache);
    } catch (err) {
      console.warn("Error: ", err);
      this.emit("error", err, { context: "encryptTextForScanner" });
      return null;
    }
  }

  /**
   * Encrypt the current browser selection.
   */
  async encryptSelectedTextForScanner(
    recipientPublicKeys: MajikMessagePublicKey[] = [],
  ): Promise<string | null> {
    const plaintext = window.getSelection()?.toString().trim() ?? "";
    return this.encryptTextForScanner(plaintext, recipientPublicKeys);
  }

  /**
   * Encrypt for a target by ID or label.
   * If target is another contact, auto-includes self as a recipient (group message).
   */
  async encryptForTarget(
    target: string,
    plaintext: string,
  ): Promise<string | null> {
    const activeAccount = this.getActiveAccount();
    if (!activeAccount) throw new Error("No active account available");

    const contact =
      this.listContacts(false).find((c) => c.id === target) ||
      this.listContacts(false).find((c) => c.meta?.label === target);

    if (!contact || contact.id === activeAccount.id) {
      return this.encryptTextForScanner(plaintext, [activeAccount.id]);
    }

    return this.encryptTextForScanner(plaintext, [
      activeAccount.id,
      contact.id,
    ]);
  }

  // ── MajikMessageChat ──────────────────────────────────────────────────────

  /**
   * Create a MajikMessageChat, compress the content, encrypt it, and return
   * the scanner string and chat instance together.
   */
  async createEncryptedMajikMessageChat(
    account: MajikMessageIdentity,
    recipientsKeys: MajikMessagePublicKey[],
    plaintext: string,
    expiresInMs?: number,
  ): Promise<{ messageChat: MajikMessageChat; scannerString: string }> {
    if (!plaintext?.trim()) throw new Error("No text provided to encrypt");
    if (!account)
      throw new Error("No active account available to send message");

    if (!recipientsKeys.length) {
      const first = this.listOwnAccounts()[0];
      if (!first) throw new Error("No own account available for encryption");
      const senderPublicKey = await first.getPublicKeyBase64();
      recipientsKeys = [senderPublicKey];
    }

    const trimmedMessage = MajikMessageChat.trimMessage(plaintext);

    try {
      // MajikMessageChat compresses the plaintext internally
      const messageChat = await MajikMessageChat.create(
        account,
        trimmedMessage,
        recipientsKeys,
        expiresInMs,
      );

      // Encrypt the compressed message via MajikEnvelope (compress: false —
      // MajikMessageChat already compressed it)
      const recipients =
        await this._resolveRecipientsByPublicKey(recipientsKeys);
      const sender = this.getActiveAccount();

      const envelope = await MajikEnvelope.encrypt({
        plaintext: messageChat.getCompressedMessage(),
        recipients,
        senderFingerprint:
          recipients.length > 1 ? sender?.fingerprint : undefined,
        compress: false, // already compressed by MajikMessageChat
      });

      const scannerString = envelope.toScannerString();
      messageChat.setMessage(scannerString);

      return { messageChat, scannerString };
    } catch (err) {
      this.emit("error", err, { context: "createEncryptedMajikMessageChat" });
      throw err;
    }
  }

  /**
   * Decrypt a stored MajikMessageChat encrypted payload back to plaintext.
   */
  async decryptMajikMessageChat(
    encryptedPayload: string,
    recipientId?: string,
  ): Promise<string> {
    const account = recipientId
      ? this.getOwnAccountById(recipientId)
      : this.getActiveAccount();

    if (!account) throw new Error("No recipient account found for decryption");

    try {
      const identity = await this._resolveIdentity(account.id);
      const envelope = MajikEnvelope.fromJSON(JSON.parse(encryptedPayload));
      return await envelope.decrypt(identity);
    } catch (err) {
      this.emit("error", err, { context: "decryptMajikMessageChat" });
      throw err;
    }
  }

  // ── File Encryption / Decryption ──────────────────────────────────────────

  /**
   * Encrypt a binary file and return everything the caller needs to persist it.

   * @throws Error if no active account, account has no ML-KEM keys, or a
   *         recipient cannot be resolved from the contact directory.
   * @throws MajikFileError on validation failures or crypto errors (re-thrown
   *         from MajikFile.create() so the caller gets typed errors).
   *
   * @example — self-encrypted user upload
   * ```ts
   * const result = await majik.encryptFile({
   *   data: fileBytes,
   *   context: "user_upload",
   *   originalName: "document.pdf",
   * });
   * await r2.put(result.metadata.r2_key, result.binary);
   * await supabase.from("majik_files").insert(result.metadata);
   * ```
   *
   * @example — group chat image
   * ```ts
   * const result = await majik.encryptFile({
   *   data: imageBytes,
   *   context: "chat_image",
   *   originalName: "photo.png",
   *   conversationId: "conv_abc123",
   *   recipientIds: ["contact_id_1", "contact_id_2"],
   *   isTemporary: true,
   *   expiresAt: MajikFile.buildExpiryDate(15),
   * });
   * ```
   */
  async encryptFile(options: EncryptFileOptions): Promise<EncryptFileResult> {
    const {
      data,
      context,
      originalName,
      mimeType,
      recipients = [],
      conversationId,
      isTemporary = false,
      expiresAt,
      bypassSizeLimit = false,
      chatMessageId,
      threadMessageId,
      threadId,
      userId,
      compressionLevel,
    } = options;

    // ── 1. Resolve sender identity ──────────────────────────────────────────
    // Builds MajikFileIdentity with both public + secret keys from keystore.
    const identity = await this._resolveFileIdentity();

    const finalUserID = userId ?? identity.publicKey;

    // ── 2. Resolve additional recipients ───────────────────────────────────
    // MajikFile.create() will silently drop the sender's own fingerprint if
    // it appears in this list, and will deduplicate any repeated entries.
    // An empty list → single-recipient (self-encrypted) file.
    const recipientPubKeys =
      recipients.length > 0
        ? await this._resolveFileRecipientsByPublicKey(recipients)
        : [];

    // ── 3. Delegate to MajikFile.create() ──────────────────────────────────
    const file = await MajikFile.create({
      data,
      identity,
      context,
      recipients: recipientPubKeys,
      originalName,
      mimeType,
      conversationId,
      isTemporary,
      expiresAt,
      bypassSizeLimit,
      chatMessageId,
      threadMessageId,
      userId: finalUserID,
      threadId: threadId,
      compressionLevel,
    });

    // ── 4. Package the result ───────────────────────────────────────────────
    return {
      file,
      metadata: file.toJSON(),
      binary: file.toMJKB(),
    };
  }

  /**
   * Decrypt a .mjkb binary and return the original raw bytes.
   *
   * Flow:
   *  1. If `accountId` is provided, that account is tried first.
   *     Otherwise the active account is tried first.
   *  2. For group files (multiple recipients), if the first account fails,
   *     every own account is tried in sequence until one succeeds.
   *     This mirrors the behaviour of decryptEnvelope() for group messages.
   *  3. Delegates to MajikFile.decrypt() — which handles:
   *       • .mjkb binary parsing and magic-byte validation
   *       • Single vs group payload discrimination
   *       • ML-KEM decapsulation
   *       • AES-256-GCM decryption
   *       • Zstd decompression (if the file was compressed)
   *
   * @returns Raw plaintext bytes — the original file content before encryption.
   *
   * @throws Error if no own account can decrypt the file.
   * @throws MajikFileError (re-thrown) on corrupt binary, wrong key, or format
   *         errors — callers can import MajikFileError for typed catch blocks.
   *
   * @example — basic usage
   * ```ts
   * const mjkbBlob = await r2.get(metadata.r2_key);
   * const rawBytes = await majik.decryptFile({ source: mjkbBlob });
   * const url = URL.createObjectURL(new Blob([rawBytes], { type: metadata.mime_type }));
   * ```
   *
   * @example — explicit account (e.g. non-active account in a multi-account UI)
   * ```ts
   * const rawBytes = await majik.decryptFile({
   *   source: mjkbBytes,
   *   accountId: "acc_xyz",
   * });
   * ```
   */
  async decryptFile(options: DecryptFileOptions): Promise<{
    bytes: Uint8Array;
    originalName: string | null;
    mimeType: string | null;
  }> {
    const { source, accountId } = options;

    // Build a prioritised list of own accounts to try.
    // If an explicit accountId was requested, put that account first so it is
    // tried before falling back to the full list — saves unnecessary work for
    // single-recipient files and the common case where the caller knows which
    // account holds the key.
    const allAccounts = this.listOwnAccounts();
    const orderedAccounts: typeof allAccounts = [];

    if (accountId) {
      const preferred = this.getOwnAccountById(accountId);
      if (!preferred) throw new Error(`Account not found: "${accountId}"`);
      orderedAccounts.push(preferred);
    }

    // Append any remaining accounts not already in the list
    for (const account of allAccounts) {
      if (!orderedAccounts.some((a) => a.id === account.id)) {
        orderedAccounts.push(account);
      }
    }

    if (orderedAccounts.length === 0) {
      throw new Error("No own accounts available for decryption");
    }

    let lastError: unknown;

    for (const account of orderedAccounts) {
      try {
        // Resolve the secret key for this account.
        // _resolveFileIdentity() calls ensureUnlocked() internally, so the
        // keystore will prompt for a passphrase if the account is locked.
        const identity = await this._resolveFileIdentity(account.id);

        const {
          bytes: rawBytes,
          originalName,
          mimeType,
        } = await MajikFile.decryptWithMetadata(source, {
          fingerprint: identity.fingerprint,
          mlKemSecretKey: identity.mlKemSecretKey,
        });

        return { bytes: rawBytes, originalName, mimeType };
      } catch (err) {
        // MajikFileError.decryptionFailed means the key didn't match — keep
        // trying. Any other error (corrupt binary, format error) is terminal
        // and re-thrown immediately so the caller gets an accurate diagnosis.
        if (err instanceof MajikFileError && err.code === "DECRYPTION_FAILED") {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    // None of the own accounts could decrypt the file
    throw new Error(
      `None of your accounts can decrypt this file. ` +
        `It may have been encrypted for different recipients. ` +
        `Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  // ── Envelope Cache ────────────────────────────────────────────────────────

  async listCachedEnvelopes(
    offset = 0,
    limit = 50,
  ): Promise<EnvelopeCacheItem[]> {
    return this.envelopeCache.listRecent(offset, limit);
  }

  async clearCachedEnvelopes(): Promise<boolean> {
    const response = await this.envelopeCache.clear();
    if (!response?.success) throw new Error(response.message);
    this.scheduleAutosave();
    return response.success;
  }

  // ── Identity / Passphrase ─────────────────────────────────────────────────

  /**
   * Ensure an identity is unlocked.
   * Delegates entirely to MajikKeyStore.ensureUnlocked() — passphrase prompting
   * is handled there via onUnlockRequested or the optional promptFn.
   */
  async ensureIdentityUnlocked(
    id: string,
    promptFn?: (id: string) => string | Promise<string>,
  ): Promise<CryptoKey | { raw: Uint8Array }> {
    return MajikKeyStore.ensureUnlocked(id, promptFn);
  }

  async isPassphraseValid(passphrase: string, id?: string): Promise<boolean> {
    const target = id ? this.getOwnAccountById(id) : this.getActiveAccount();
    if (!target) return false;
    return MajikKeyStore.isPassphraseValid(target.id, passphrase);
  }

  // ── DOM Scanning ──────────────────────────────────────────────────────────

  scanDOM(rootNode: Node): void {
    this.scanner.scanDOM(rootNode);
  }
  startDOMObserver(rootNode: Node): void {
    this.scanner.startDOMObserver(rootNode);
  }
  stopDOMObserver(): void {
    this.scanner.stopDOMObserver();
  }

  // ── Events ────────────────────────────────────────────────────────────────

  on(event: MajikMessageEvents, callback: EventCallback): void {
    this.listeners.get(event)?.push(callback);
  }

  off(event: MajikMessageEvents, callback?: EventCallback): void {
    const cbs = this.listeners.get(event);
    if (!cbs?.length) return;
    if (callback) {
      const i = cbs.indexOf(callback);
      if (i !== -1) cbs.splice(i, 1);
    } else {
      this.listeners.set(event, []);
    }
  }

  private emit(event: MajikMessageEvents, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  // ── Private: Envelope Handler (Scanner) ───────────────────────────────────

  private async handleEnvelope(envelope: MessageEnvelope): Promise<void> {
    const cached = await this.envelopeCache.get(envelope);
    if (cached) return;

    let majikEnvelope: MajikEnvelope;
    try {
      majikEnvelope = MajikEnvelope.fromBinary(envelope.raw);
    } catch {
      this.emit("untrusted", envelope);
      return;
    }

    if (majikEnvelope.isGroup) {
      for (const account of this.listOwnAccounts()) {
        try {
          const identity = await this._resolveIdentity(account.id);
          const plaintext = await majikEnvelope.decrypt(identity);
          await this.envelopeCache.set(envelope, this._source);
          this.scheduleAutosave();
          this.emit("message", plaintext, envelope, account);
          return;
        } catch {
          continue;
        }
      }
      this.emit("untrusted", envelope);
    } else {
      const fingerprint = envelope.extractFingerprint();
      const account = this.listOwnAccounts().find(
        (a) => a.fingerprint === fingerprint,
      );
      if (!account) {
        this.emit("untrusted", envelope);
        return;
      }

      try {
        const identity = await this._resolveIdentity(account.id);
        const plaintext = await majikEnvelope.decrypt(identity);
        await this.envelopeCache.set(envelope, this._source);
        this.scheduleAutosave();
        this.emit("message", plaintext, envelope, account);
      } catch (err) {
        this.emit("error", err, { envelope });
      }
    }
  }

  // ── PIN ───────────────────────────────────────────────────────────────────

  async setPIN(pin: string): Promise<void> {
    if (!pin) throw new Error("PIN must be a non-empty string");
    this.pinHash = await MajikMessage._hashPIN(pin);
    this.scheduleAutosave();
  }

  async clearPIN(): Promise<void> {
    this.pinHash = null;
    this.scheduleAutosave();
  }

  async isValidPIN(pin: string): Promise<boolean> {
    if (!this.pinHash) return true;
    return (await MajikMessage._hashPIN(pin)) === this.pinHash;
  }

  getPinHash(): string | null {
    return this.pinHash ?? null;
  }

  private static async _hashPIN(pin: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(pin),
    );
    return arrayBufferToBase64(digest as ArrayBuffer);
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  async toJSON(): Promise<MajikMessageJSON> {
    const json: MajikMessageJSON = {
      id: this.id,
      contacts: await this.contactDirectory.toJSON(),
      envelopeCache: this.envelopeCache.toJSON(),
    };

    try {
      const accounts: Awaited<ReturnType<MajikContact["toJSON"]>>[] = [];
      for (const id of this.ownAccountsOrder) {
        const acct = this.ownAccounts.get(id);
        if (acct) accounts.push(await acct.toJSON());
      }
      json.ownAccounts = { accounts, order: [...this.ownAccountsOrder] };
    } catch (e) {
      console.warn("Failed to serialize ownAccounts:", e);
    }

    (json as any).pinHash = this.pinHash ?? null;
    return json;
  }

  static async fromJSON<T extends MajikMessage>(
    this: new (config: MajikMessageConfig, id?: string) => T,
    json: MajikMessageJSON,
  ): Promise<T> {
    const directory = new MajikContactDirectory();
    const contacts = await directory.fromJSON(json.contacts);
    const envelopeCache = EnvelopeCache.fromJSON(json.envelopeCache);

    const instance = new this(
      { contactDirectory: contacts, envelopeCache },
      json.id,
    );

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
            instance.ownAccounts.set(contact.id, contact);
          } catch (e) {
            console.info(
              "Fallback restoring own account (raw-key wrapper)",
              (acct as any).id,
              e,
            );
          }
        }

        if (Array.isArray(json.ownAccounts.order)) {
          instance.ownAccountsOrder = [...json.ownAccounts.order];
        }

        // Fallback: populate from contactDirectory if accounts array failed
        if (instance.ownAccounts.size === 0) {
          for (const id of instance.ownAccountsOrder) {
            const c = instance.contactDirectory.getContact(id);
            if (c) instance.ownAccounts.set(id, c);
          }
        }

        // Ensure own accounts are in contactDirectory
        instance.ownAccountsOrder.forEach((id) => {
          const c = instance.ownAccounts.get(id);
          if (c && !instance.contactDirectory.hasContact(c.id)) {
            instance.contactDirectory.addContact(c);
          }
        });
      }
    } catch (e) {
      console.warn("Error restoring ownAccounts:", e);
    }

    const anyJson: any = json;
    if (anyJson.pinHash) instance.pinHash = anyJson.pinHash;

    return instance;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private attachAutosaveHandlers(): void {
    if (typeof window === "undefined") return;
    try {
      window.addEventListener("beforeunload", () => void this.saveState());
    } catch {
      /* ignore */
    }
    this.startAutosave();
  }

  startAutosave(): void {
    if (this.autosaveIntervalId || typeof window === "undefined") return;
    this.autosaveIntervalId = window.setInterval(
      () => void this.saveState(),
      this.autosaveIntervalMs,
    ) as unknown as number;
  }

  stopAutosave(): void {
    if (!this.autosaveIntervalId || typeof window === "undefined") return;
    window.clearInterval(this.autosaveIntervalId);
    this.autosaveIntervalId = null;
  }

  private scheduleAutosave(): void {
    if (typeof window === "undefined") return;
    if (this.autosaveTimer) window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => {
      void this.saveState();
      this.autosaveTimer = null;
    }, this.autosaveDebounceMs) as unknown as number;
  }

  async saveState(): Promise<void> {
    try {
      const json = await this.toJSON();
      await idbSaveBlob(
        "majik-message-state",
        autoSaveMajikFileData(json),
        this.userProfile,
      );
    } catch (err) {
      console.error("Failed to save MajikMessage state:", err);
    }
  }

  async loadState(): Promise<void> {
    try {
      const saved = await idbLoadBlob("majik-message-state", this.userProfile);
      if (!saved?.data) return;
      const loaded = await loadSavedMajikFileData(saved.data);
      const restored = await MajikMessage.fromJSON(
        loaded.j as MajikMessageJSON,
      );
      this.id = restored.id;
      this.contactDirectory = restored.contactDirectory;
      this.envelopeCache = restored.envelopeCache;
      this.ownAccounts = restored.ownAccounts;
      this.ownAccountsOrder = [...restored.ownAccountsOrder];
    } catch (err) {
      console.error("Failed to load MajikMessage state:", err);
    }
  }

  static async loadOrCreate<T extends MajikMessage>(
    this: MajikMessageStatic<T>,
    config: MajikMessageConfig,
    userProfile = "default",
  ): Promise<T> {
    try {
      const saved = await idbLoadBlob("majik-message-state", userProfile);
      if (saved?.data) {
        const loaded = await loadSavedMajikFileData(saved.data);
        const instance = (await this.fromJSON(
          loaded.j as MajikMessageJSON,
        )) as T;
        instance.attachAutosaveHandlers();
        return instance;
      }
    } catch (err) {
      console.warn("Error loading saved MajikMessage state:", err);
    }

    const created = new this(config);
    await created.saveState();
    created.attachAutosaveHandlers();
    return created;
  }

  async resetData(userProfile = "default"): Promise<void> {
    try {
      await this.clearCachedEnvelopes();

      for (const id of [...this.ownAccountsOrder]) {
        await MajikKeyStore.deleteIdentity(id).catch(() => {});
      }

      this.ownAccounts.clear();
      this.ownAccountsOrder = [];

      try {
        this.contactDirectory.clear();
      } catch {
        /* ignore */
      }

      this.pinHash = null;
      this.id = arrayToBase64(randomBytes(32));

      try {
        await clearAllBlobs(userProfile);
      } catch {
        /* ignore */
      }

      this.stopAutosave();
      this.startAutosave();

      this.emit("active-account-change", null);
    } catch (err) {
      throw new Error(
        `Failed to reset data: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
