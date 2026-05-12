// MajikMessage.ts

import {
  MajikContact,
  MajikContactGroup,
  MajikContactGroupMeta,
  type MajikContactMeta,
  type SerializedMajikContact,
} from "@majikah/majik-contact";
import { MessageEnvelope } from "./core/messages/message-envelope";
import {
  EnvelopeCache,
  type EnvelopeCacheItem,
  type EnvelopeCacheJSON,
} from "./core/messages/envelope-cache";

import { arrayToBase64, base64ToUint8Array } from "./core/utils/utilities";

import { randomBytes } from "@stablelib/random";

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
  MajikFileJSON,
  type MajikFileIdentity,
  type MajikFileRecipient,
} from "@majikah/majik-file";

import {
  EnvelopeInfo,
  ExpectedSigner,
  MajikSignature,
  SealInfo,
  SealVerificationResult,
  SignatoriesFilter,
  SignatoriesResult,
  SignatoryInfo,
  type MajikSignatureJSON,
  type MajikSignerPublicKeys,
  type VerificationResult,
} from "@majikah/majik-signature";

import {
  MajikContactManager,
  MajikContactManagerAdapters,
} from "./core/contacts/majik-contact-manager";
import { MajikContactManagerJSON } from "./core/contacts/types";
import {
  ClientStateStorageAdapter,
  InMemoryClientStateAdapter,
  InMemoryKeystoreAdapter,
  MajikKeyStorageAdapter,
  SQLiteDatabase,
} from "./core/storage";
import { MajikKeyManager } from "./core/crypto/keystore-manager";
import { ClientStateManager } from "./core/client-state-manager";

// ─── Types ────────────────────────────────────────────────────────────────────

type MajikMessageEvents =
  | "message"
  | "envelope"
  | "untrusted"
  | "error"
  | "new-account"
  | "new-contact"
  | "new-contact-group"
  | "removed-account"
  | "removed-contact"
  | "removed-contact-group"
  | "contact-group-change"
  | "active-account-change";

interface MajikMessageStatic<T extends MajikMessage> {
  new (config: MajikMessageConfig, id?: string): T;
  fromJSON(json: MajikMessageJSON): Promise<T>;
}

export interface MajikMessageConfig {
  dbSQL?: SQLiteDatabase;

  /**
   * Shared contact directory.
   * Pass the same instance used by MajikMessage to keep contacts in sync.
   */
  contactManager?: MajikContactManager;

  /**
   * Pre-constructed key manager. If provided, adapters.keys is ignored.
   * Pass the same instance used by MajikMessage / MajikSignatureClient
   * to share a single keystore across clients.
   */
  keyManager?: MajikKeyManager;

  envelopeCache?: EnvelopeCache;

  /**
   * Pre-constructed client state manager. If provided, adapters.clientState
   * is ignored.
   */
  clientStateManager?: ClientStateManager;

  adapters?: {
    contacts?: MajikContactManagerAdapters;
    keys?: MajikKeyStorageAdapter;
    /**
     * Adapter for client-level state (account order, invoice defaults, etc.).
     * Defaults to IDB_ADAPTER_CLIENT_STATE in browser environments.
     * Pass InMemoryClientStateAdapter for tests or non-browser runtimes.
     */
    clientState?: ClientStateStorageAdapter;
  };
}

export interface MajikMessageJSON {
  id: string;
  contacts: MajikContactManagerJSON;
  envelopeCache: EnvelopeCacheJSON;
  ownAccounts?: {
    accounts: SerializedMajikContact[];
    order: string[];
  };
}

type EventCallback = (...args: any[]) => void;

// ─── MajikMessage ─────────────────────────────────────────────────────────────

export class MajikMessage {
  private readonly _id: string;
  private _db: SQLiteDatabase | null;

  private _contacts: MajikContactManager;
  private _keys: MajikKeyManager;
  private _state: ClientStateManager;

  private envelopeCache: EnvelopeCache;
  private _listeners: Map<MajikMessageEvents, EventCallback[]> = new Map();
  /** MajikContact instances for accounts this client owns. */
  private _ownAccounts: Map<string, MajikContact> = new Map();

  /**
   * Ordered list of own account IDs — head is the active account.
   * Source of truth is ClientStateManager; this array is the in-memory
   * working copy kept in sync on every mutation.
   */
  private _ownAccountsOrder: string[] = [];

  private _autosaveOrderTimer: number | null = null;

  constructor(config: MajikMessageConfig, id?: string) {
    this._id = id || arrayToBase64(randomBytes(32));
    this._db = config.dbSQL || null;

    this.envelopeCache = config.envelopeCache || new EnvelopeCache(undefined);

    this._contacts =
      config.contactManager ??
      new MajikContactManager(undefined, undefined, config.adapters?.contacts);

    this._keys =
      config.keyManager ??
      new MajikKeyManager(
        config.adapters?.keys ?? new InMemoryKeystoreAdapter(),
      );

    this._state =
      config.clientStateManager ??
      new ClientStateManager(
        config.adapters?.clientState ?? new InMemoryClientStateAdapter(),
      );

    const events: MajikMessageEvents[] = [
      "message",
      "envelope",
      "untrusted",
      "error",
      "new-account",
      "new-contact",
      "new-contact-group",
      "removed-account",
      "removed-contact",
      "removed-contact-group",
      "contact-group-change",
      "active-account-change",
    ];
    events.forEach((e) => this._listeners.set(e, []));
  }

  /** Expose the key manager so callers can share it with other clients. */
  get keyManager(): MajikKeyManager {
    return this._keys;
  }

  /** Expose the client state manager for direct access if needed. */
  get stateManager(): ClientStateManager {
    return this._state;
  }

  // ── Hydration ─────────────────────────────────────────────────────────────

  /**
   * Load all domains from their adapters and restore client state.
   * Call once on startup.
   *
   * ```ts
   * const client = new MajikBuwizClient({ adapters: { keys: idbAdapter, ... } });
   * await client.hydrate();
   * ```
   */
  async hydrate(): Promise<void> {
    // 1. Keys — load into manager cache
    await this._keys.hydrate();

    // 2. Contacts + groups
    await this._contacts.hydrate();

    // 4. Client state — account order, invoice defaults, etc.
    await this._state.hydrate();

    // 5. Own accounts — rebuild from keys loaded in step 1
    await this._hydrateOwnAccounts();

    // 6. Account order — restore from state manager, prune stale IDs
    await this._restoreAccountOrder();
  }

  // ── Private hydration helpers ─────────────────────────────────────────────

  private async _hydrateOwnAccounts(): Promise<void> {
    const keys = this._keys.list();
    for (const key of keys) {
      if (!this._ownAccounts.has(key.id)) {
        try {
          const contact = key.toContact();
          if (!this._contacts.hasContact(contact.id)) {
            await this._contacts.addContact(contact);
          }
          this._ownAccounts.set(key.id, contact);
          if (!this._ownAccountsOrder.includes(key.id)) {
            this._ownAccountsOrder.push(key.id);
          }
        } catch (err) {
          console.warn(
            `MajikBuwizClient: failed to hydrate own account "${key.id}":`,
            err,
          );
        }
      }
    }
  }

  private async _restoreAccountOrder(): Promise<void> {
    try {
      const saved = await this._state.getAccountOrder();
      if (saved) {
        // Prune IDs that no longer exist, then append any new ones at the tail
        const valid = saved.filter((id) => this._ownAccounts.has(id));
        const appended = this._ownAccountsOrder.filter(
          (id) => !valid.includes(id),
        );
        this._ownAccountsOrder = [...valid, ...appended];
      }
    } catch {
      // Non-fatal — order defaults to insertion order from _hydrateOwnAccounts
    }
  }

  private _scheduleOrderSave(): void {
    if (this._autosaveOrderTimer !== null) {
      window.clearTimeout(this._autosaveOrderTimer);
    }
    this._autosaveOrderTimer = window.setTimeout(() => {
      void this._persistAccountOrder();
      this._autosaveOrderTimer = null;
    }, 300) as unknown as number;
  }

  private async _persistAccountOrder(): Promise<void> {
    try {
      await this._state.setAccountOrder(this._ownAccountsOrder);
    } catch (err) {
      console.warn("MajikBuwizClient: failed to persist account order:", err);
    }
  }

  /**
   * Construct a client and immediately hydrate it.
   */
  static async create<T extends MajikMessage>(
    this: new (config: MajikMessageConfig) => T,
    config: MajikMessageConfig = {},
  ): Promise<T> {
    const client = new this(config);
    await client.hydrate();
    return client;
  }

  /**
   * Resolve a list of account/contact IDs into MajikRecipient objects.
   * Each recipient needs their ML-KEM public key from this.keyManager.
   */
  private async _resolveRecipientsByPublicKey(
    publicKeys: MajikMessagePublicKey[],
  ): Promise<MajikRecipient[]> {
    return Promise.all(
      publicKeys.map(async (pkey) => {
        const contact = await this._contacts.getContactByPublicKeyBase64(pkey);
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
    await this.keyManager.ensureUnlocked(id, promptFn);
    const key = this.keyManager.get(id);
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

    await this.keyManager.ensureUnlocked(id);
    const key = this.keyManager.get(id);
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
        const contact = await this._contacts.getContactByPublicKeyBase64(pkey);
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

  // ==========================================================================
  // ── ACCOUNT MANAGEMENT ────────────────────────────────────────────────────
  // ==========================================================================

  generateMnemonic(strength: 128 | 256 = 128): string {
    return MajikKeyManager.generateMnemonic(strength);
  }

  async createAccount(
    mnemonic: string,
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string; backup: string }> {
    try {
      const key = await MajikKey.create(mnemonic, passphrase, label);
      await this._keys.save(key);
      const contact = key.toContact();
      this._registerOwnAccount(contact);
      this._emit("new-account", contact);
      return { id: key.id, fingerprint: key.fingerprint, backup: key.backup };
    } catch (err) {
      this._emit("error", err, { context: "createAccount" });
      throw err;
    }
  }

  async importAccountFromMnemonicBackup(
    backupBase64: string,
    mnemonic: string,
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string }> {
    try {
      const key = await this._keys.importFromMnemonicBackup(
        backupBase64,
        mnemonic,
        passphrase,
        label,
      );
      if (this.getOwnAccountById(key.id)) {
        throw new Error("Account with the same ID already exists");
      }
      const contact = key.toContact();
      this._registerOwnAccount(contact);
      this._emit("new-account", contact);
      return { id: key.id, fingerprint: key.fingerprint };
    } catch (err) {
      this._emit("error", err, { context: "importAccountFromMnemonicBackup" });
      throw err;
    }
  }

  async replaceAccountFromMnemonicBackup(
    backupBase64: string,
    mnemonic: string,
    passphrase: string,
    label?: string,
  ): Promise<{ id: string; fingerprint: string }> {
    try {
      const currentAccount = this.getActiveAccountKey();
      const currentContact = this.getActiveAccount();

      const finalLabel = label?.trim() || currentContact?.meta?.label;

      // 1. Import first (no mutation yet)
      const key = await this._keys.importFromMnemonicBackup(
        backupBase64,
        mnemonic,
        passphrase,
        finalLabel,
      );

      // 2. Prevent duplicate (except self-replace)
      if (this.getOwnAccountById(key.id) && key.id !== currentAccount?.id) {
        throw new Error("Account with the same ID already exists");
      }

      const contact = key.toContact();

      // 3. Remove old account if different
      if (currentAccount && currentAccount.id !== key.id) {
        await this.removeOwnAccount(currentAccount.id);
      }

      // 4. Register new account
      this._registerOwnAccount(contact);

      // 5. Set active
      await this.setActiveAccount(contact.id, true);

      this._emit("new-account", contact);

      return { id: key.id, fingerprint: key.fingerprint };
    } catch (err) {
      this._emit("error", err, {
        context: "replaceAccountFromMnemonicBackup",
      });
      throw err;
    }
  }

  async exportAccountMnemonicBackup(
    id: string,
    mnemonic: string,
  ): Promise<string> {
    return this._keys.exportMnemonicBackup(id, mnemonic);
  }

  addOwnAccount(account: MajikContact): void {
    this._registerOwnAccount(account);
    this._emit("new-account", account);
  }

  async removeOwnAccount(id: string): Promise<boolean> {
    if (!this._ownAccounts.has(id)) return false;
    this._ownAccounts.delete(id);
    const idx = this._ownAccountsOrder.indexOf(id);
    if (idx > -1) this._ownAccountsOrder.splice(idx, 1);
    await this._contacts.removeContact(id);
    await this._keys.delete(id);
    this._scheduleOrderSave();
    this._emit("removed-account", id);
    return true;
  }

  getOwnAccountById(id: string): MajikContact | undefined {
    return this._ownAccounts.get(id);
  }

  getActiveAccount(): MajikContact | null {
    if (!this._ownAccountsOrder.length) return null;
    return this._ownAccounts.get(this._ownAccountsOrder[0]) ?? null;
  }

  getActiveAccountKey(): MajikKey | null {
    if (!this._ownAccountsOrder.length) return null;

    const activeKey = this._keys.get(this._ownAccountsOrder[0]);
    if (!activeKey) return null;
    return activeKey;
  }

  isAccountActive(id: string): boolean {
    return this._ownAccounts.has(id) && this._ownAccountsOrder[0] === id;
  }

  async setActiveAccount(id: string, bypassIdentity = false): Promise<boolean> {
    if (!this._ownAccounts.has(id)) return false;
    if (!bypassIdentity) {
      try {
        await this.ensureIdentityUnlocked(id);
      } catch {
        return false;
      }
    }
    const previousActive = this.getActiveAccount()?.id;
    const index = this._ownAccountsOrder.indexOf(id);
    if (index > -1) this._ownAccountsOrder.splice(index, 1);
    this._ownAccountsOrder.unshift(id);
    this._scheduleOrderSave();
    if (previousActive !== id) {
      this._emit(
        "active-account-change",
        this.getActiveAccount(),
        previousActive,
      );
    }
    return true;
  }

  listOwnAccounts(majikahOnly = false): MajikContact[] {
    let accounts = this._ownAccountsOrder
      .map((id) => this._ownAccounts.get(id))
      .filter((c): c is MajikContact => !!c);

    if (majikahOnly) {
      accounts = accounts.filter((a) => this.isContactMajikahRegistered(a.id));
    }
    return accounts;
  }

  isContactMajikahRegistered(id: string): boolean {
    return this._contacts.isMajikahRegistered(id);
  }

  isContactMajikahIdentityChecked(id: string): boolean {
    return this._contacts.isMajikahIdentityChecked(id);
  }

  setContactMajikahStatus(id: string, status: boolean): void {
    this._contacts.setMajikahStatus(id, status);
  }

  async hasOwnIdentity(fingerprint: string): Promise<boolean> {
    return this.keyManager.has(fingerprint);
  }

  // ==========================================================================
  // ── CONTACT MANAGEMENT ────────────────────────────────────────────────────
  // ==========================================================================

  getContactByID(id: string): MajikContact | null {
    if (!id?.trim()) throw new Error("Invalid contact ID");
    return this._contacts.getContact(id) ?? null;
  }

  async getContactByPublicKey(
    publicKeyBase64: string,
  ): Promise<MajikContact | null> {
    if (!publicKeyBase64?.trim()) throw new Error("Invalid public key");
    return (
      (await this._contacts.getContactByPublicKeyBase64(publicKeyBase64)) ??
      null
    );
  }

  getContactsByID(ids: string[], strict = false): MajikContact[] {
    if (!ids?.length) throw new Error("At least 1 id is required");
    return this._contacts.getContactsByIds(ids, strict);
  }

  async getContactsByPublicKey(
    publicKeys: string[],
  ): Promise<MajikContact[]> {
    if (!publicKeys?.length)
      throw new Error("At least 1 public key is required");
    return await this._contacts.getContactsByPublicKeys(publicKeys);
  }

  async getMajikRecipientsByPublicKey(
    publicKeys: string[],
    strict?: boolean,
  ): Promise<MajikRecipient[]> {
    return await this._contacts.getMajikRecipients(
      "public_key",
      publicKeys,
      strict,
    );
  }

  async getExpectedSignersByPublicKey(
    publicKeys: string[],
    strict?: boolean,
  ): Promise<ExpectedSigner[]> {
    return await this._contacts.getExpectedSigners(
      "public_key",
      publicKeys,
      strict,
    );
  }
  async exportContactAsJSON(id: string): Promise<string | null> {
    if (!id?.trim()) throw new Error("Invalid contact ID");
    return this._contacts.exportContactAsJSON(id);
  }

  async exportContactAsString(id: string): Promise<string | null> {
    if (!id?.trim()) throw new Error("Invalid contact ID");
    return this._contacts.exportContactAsString(id);
  }

  async importContactFromJSON(jsonStr: string): Promise<MAJIK_API_RESPONSE> {
    if (!jsonStr?.trim()) throw new Error("Invalid contact JSON");
    return this._contacts.importContactFromJSON(jsonStr);
  }

  async importContactFromString(
    base64Str: string,
  ): Promise<MAJIK_API_RESPONSE> {
    if (!base64Str?.trim()) throw new Error("Invalid contact string");

    const response = await this._contacts.importContactFromString(base64Str);

    if (response.success) {
      this._emit("new-contact", response.data);
    } else {
      this._emit("error", response.message);
    }

    return response;
  }

  async exportContactCompressed(contact: MajikContact): Promise<string> {
    if (!contact?.id?.trim()) throw new Error("Invalid contact");
    return this._contacts.exportContactCompressed(contact);
  }

  async importContactCompressed(base64Str: string): Promise<MajikContact> {
    if (!base64Str?.trim()) throw new Error("Invalid contact string");
    return this._contacts.importContactCompressed(base64Str);
  }

  async addContact(contact: MajikContact): Promise<void> {
    if (
      !contact?.id ||
      !contact?.publicKey ||
      !contact?.fingerprint ||
      !contact?.mlKey
    ) {
      throw new Error("Invalid contact — missing required fields");
    }
    await this._contacts.addContact(contact);
    this._emit("new-contact", contact);
  }

  async removeContact(id: string): Promise<void> {
    const result = await this._contacts.removeContact(id);
    if (!result.success) throw new Error(result.message);
    this._emit("removed-contact", id);
  }

  listContacts(includeOwnAccounts = false): MajikContact[] {
    const contacts = this._contacts.listContacts(true);
    if (includeOwnAccounts) return contacts;
    const ownIds = new Set(this.listOwnAccounts().map((a) => a.id));
    return contacts.filter((c) => !ownIds.has(c.id));
  }

  async updateContactMeta(
    id: string,
    meta: Partial<MajikContactMeta>,
  ): Promise<void> {
    await this._contacts.updateContactMeta(id, meta);
  }

  async createGroup(
    id: string,
    name: string,
    meta?: Partial<Omit<MajikContactGroupMeta, "name">>,
    initialMemberIds?: string[],
  ): Promise<this> {
    const newGroup = await this._contacts.createGroup(
      id,
      name,
      meta,
      initialMemberIds,
    );
    this._emit("new-contact-group", newGroup);
    return this;
  }

  async addGroup(group: MajikContactGroup): Promise<this> {
    await this._contacts.addGroup(group);
    this._emit("new-contact-group", group);
    return this;
  }

  async removeGroup(id: string): Promise<MAJIK_API_RESPONSE> {
    const response = await this._contacts.removeGroup(id);
    this._emit("removed-contact-group", response.data as MajikContactGroup);
    return response;
  }

  getContactGroup(id: string): MajikContactGroup | undefined {
    return this._contacts.getGroup(id);
  }

  getGroupOrThrow(id: string): MajikContactGroup {
    return this._contacts.getGroupOrThrow(id);
  }

  hasGroup(id: string): boolean {
    return this._contacts.hasGroup(id);
  }

  listContactGroups(
    includeSystem = true,
    sortedByName = false,
  ): MajikContactGroup[] {
    return this._contacts.listGroups(includeSystem, sortedByName);
  }

  listUserGroups(sortedByName = true): MajikContactGroup[] {
    return this._contacts.listGroups(false, sortedByName);
  }

  listSystemGroups(): MajikContactGroup[] {
    return this._contacts.listGroups(true).filter((g) => g.isSystem);
  }

  async updateGroupMeta(
    id: string,
    meta: Partial<
      Pick<MajikContactGroupMeta, "name" | "description" | "color">
    >,
  ): Promise<this> {
    const updatedGroup = await this._contacts.updateGroupMeta(id, meta);
    this._emit("contact-group-change", updatedGroup);
    return this;
  }

  async addContactToGroup(groupID: string, contactID: string): Promise<this> {
    const updatedGroup = await this._contacts.addContactToGroup(
      groupID,
      contactID,
    );
    this._emit("contact-group-change", updatedGroup);
    return this;
  }

  async addContactsToGroup(
    groupID: string,
    contactIds: string[],
  ): Promise<this> {
    const updatedGroup = await this._contacts.addContactsToGroup(
      groupID,
      contactIds,
    );
    this._emit("contact-group-change", updatedGroup);
    return this;
  }

  async removeContactFromGroup(
    groupID: string,
    contactID: string,
  ): Promise<this> {
    const updatedGroup = await this._contacts.removeContactFromGroup(
      groupID,
      contactID,
    );
    this._emit("contact-group-change", updatedGroup);
    return this;
  }

  async moveContactBetweenGroups(
    contactID: string,
    fromGroupId: string,
    toGroupId: string,
  ): Promise<this> {
    const updatedGroup = await this._contacts.moveContactBetweenGroups(
      contactID,
      fromGroupId,
      toGroupId,
    );
    this._emit("contact-group-change", updatedGroup);
    return this;
  }

  getContactsInGroup(groupID: string): MajikContact[] {
    return this._contacts.getContactsInGroup(groupID);
  }

  getContactsInGroupSorted(groupID: string): MajikContact[] {
    return this._contacts.getContactsInGroupSorted(groupID);
  }

  isContactInGroup(groupID: string, contactID: string): boolean {
    return this._contacts.isContactInGroup(groupID, contactID);
  }

  getGroupsForContact(contactID: string): MajikContactGroup[] {
    return this._contacts.getGroupsForContact(contactID);
  }

  getGroupIdsForContact(contactID: string): string[] {
    return this._contacts.getGroupIdsForContact(contactID);
  }

  async addContactToFavorites(contactID: string): Promise<this> {
    const updatedGroup = await this._contacts.addToFavorites(contactID);
    this._emit("contact-group-change", updatedGroup);
    return this;
  }

  async removeContactFromFavorites(contactID: string): Promise<this> {
    const updatedGroup = await this._contacts.removeFromFavorites(contactID);
    this._emit("contact-group-change", updatedGroup);
    return this;
  }

  isContactFavorite(contactID: string): boolean {
    return this._contacts.isFavorite(contactID);
  }
  isContactBlocked(contactID: string): boolean {
    return this._contacts.isContactBlocked(contactID);
  }
  getFavoritesGroup(): MajikContactGroup {
    return this._contacts.getFavoritesGroup();
  }
  getBlockedGroup(): MajikContactGroup {
    return this._contacts.getBlockedGroup();
  }

  getFavoriteContacts(): MajikContact[] {
    return this._contacts.getContactsInGroup(
      this._contacts.getFavoritesGroup().id,
    );
  }

  getBlockedContacts(): MajikContact[] {
    return this._contacts.getContactsInGroup(
      this._contacts.getBlockedGroup().id,
    );
  }

  async clearDirectory(): Promise<this> {
    await this._contacts.clear();
    return this;
  }

  resolveSignerLabel(signerId: string): string {
    const ownAccount = this._ownAccounts.get(signerId);
    if (ownAccount?.meta?.label) return ownAccount.meta.label;
    const contact = this._contacts.getContact(signerId);
    if (contact?.meta?.label) return contact.meta.label;
    return `${signerId.slice(0, 16)}…`;
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

    this._emit("envelope", envelope);
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
      this._emit("error", err, { context: "encryptTextForScanner" });
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
      this._emit("error", err, { context: "createEncryptedMajikMessageChat" });
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
      this._emit("error", err, { context: "decryptMajikMessageChat" });
      throw err;
    }
  }

  // ── File Encryption / Decryption ──────────────────────────────────────────

  /**
   * Encrypt a binary file and return everything the caller needs to persist it.
   * Automatically signs the encrypted .mjkb binary using the active account's
   * signing keys if available. Falls back to unsigned encryption for legacy
   * accounts that pre-date signing key support.
   *
   * @throws Error if no active account or a recipient cannot be resolved.
   * @throws MajikFileError on validation or crypto failures (typed, re-thrown).
   *
   * @example — self-encrypted user upload, auto-signed
   * ```ts
   * const result = await majik.encryptFile({
   *   data: fileBytes,
   *   context: "user_upload",
   *   originalName: "document.pdf",
   * });
   * await r2.put(result.metadata.r2_key, result.binary);
   * await supabase.from("majik_files").insert(result.metadata);
   * // result.metadata.signature is populated if the account has signing keys
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
    const identity = await this._resolveFileIdentity();
    const finalUserID = userId ?? identity.publicKey;

    // ── 2. Resolve additional recipients ───────────────────────────────────
    const recipientPubKeys =
      recipients.length > 0
        ? await this._resolveFileRecipientsByPublicKey(recipients)
        : [];

    // ── 3. Get the MajikKey for signing ────────────────────────────────────
    // After _resolveFileIdentity() calls ensureUnlocked(), the key is
    // guaranteed to be in the memory cache — get() is safe here (sync).
    const activeId = this.getActiveAccount()?.id;
    if (!activeId)
      throw new Error("No active account — call setActiveAccount() first");

    const signingKey = this.keyManager.get(activeId);

    // ── 4. Build CreateOptions ─────────────────────────────────────────────
    const createOptions = {
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
      threadId,
      compressionLevel,
    };

    // ── 5. Encrypt (+ sign if signing keys are present) ────────────────────
    // Accounts imported before ML-DSA signing key support won't have
    // hasSigningKeys. We fall back to unsigned create() so the upload never
    // fails for legacy accounts — the file is encrypted but not signed.
    let file: MajikFile;

    if (signingKey?.hasSigningKeys) {
      file = await MajikFile.createAndSign(createOptions, signingKey, {
        // Carry the MIME type into the signature envelope's contentType field
        // so verifiers see a human-readable format label (e.g. "application/pdf").
        contentType:
          mimeType ??
          (originalName
            ? (MajikFile.inferMimeType(originalName) ?? undefined)
            : undefined),
      });
    } else {
      file = await MajikFile.create(createOptions);
    }

    return {
      file,
      metadata: file.toJSON(),
      binary: file.toMJKB(),
      signedBinary: !!signingKey?.hasSigningKeys
        ? file.toSignedMJKB()
        : file.toMJKB(),
    };
  }

  /**
   * Decrypt a .mjkb binary and return the original raw bytes.
   *
   * When `metadata` is provided, the signature field is automatically
   * threaded through so callers receive the deserialized MajikSignature
   * in the result without any extra work. Verify it with verifyMajikFile()
   * or MajikSignature.verify() after decryption.
   *
   * Flow:
   *  1. If `accountId` is provided, that account is tried first.
   *  2. For group files, every own account is tried in sequence.
   *  3. Delegates to MajikFile.decryptWithMetadata() for binary parsing,
   *     ML-KEM decapsulation, AES-256-GCM decryption, and decompression.
   *
   * @returns Raw plaintext bytes, original filename, MIME type, and
   *          deserialized MajikSignature (null if unsigned or no metadata).
   *
   * @throws Error if no own account can decrypt the file.
   * @throws MajikFileError on corrupt binary, wrong key, or format errors.
   *
   * @example — basic usage with metadata row from Supabase
   * ```ts
   * const mjkbBlob = await r2.get(row.r2_key);
   * const { bytes, mimeType, signature } = await majik.decryptFile({
   *   source: mjkbBlob,
   *   metadata: row,
   * });
   * if (signature) {
   *   const result = await majik.verifyMajikFile(file, { contactID: row.user_id });
   * }
   * ```
   */
  async decryptFile(options: DecryptFileOptions): Promise<{
    bytes: Uint8Array;
    originalName: string | null;
    mimeType: string | null;
    signature: MajikSignature | null;
  }> {
    const { source, accountId, metadata } = options;

    const allAccounts = this.listOwnAccounts();
    const orderedAccounts: typeof allAccounts = [];

    if (accountId) {
      const preferred = this.getOwnAccountById(accountId);
      if (!preferred) throw new Error(`Account not found: "${accountId}"`);
      orderedAccounts.push(preferred);
    }

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
        const identity = await this._resolveFileIdentity(account.id);

        return await MajikFile.decryptWithMetadata(
          source,
          {
            fingerprint: identity.fingerprint,
            mlKemSecretKey: identity.mlKemSecretKey,
          },
          metadata?.signature ?? null,
        );
      } catch (err) {
        if (err instanceof MajikFileError && err.code === "DECRYPTION_FAILED") {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `None of your accounts can decrypt this file. ` +
        `It may have been encrypted for different recipients. ` +
        `Last error: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
    );
  }

  // ── MajikFile Signature Methods ───────────────────────────────────────────

  /**
   * Sign an already-created MajikFile using the active (or specified) account
   * and attach the signature to the instance.
   *
   * Use this for deferred signing — when a file was created via create() and
   * signing happens on a second pass (e.g. after user confirmation in the UI).
   * For create + sign in one call, use encryptFile() which calls createAndSign().
   *
   * The file's binary must be loaded (_binary !== null).
   * Call file.toJSON() and persist to Supabase after signing to save the signature.
   *
   * @example
   *   await majik.signMajikFile(file);
   *   await supabase
   *     .from("majik_files")
   *     .update({ signature: file.signatureRaw, last_update: file.lastUpdate })
   *     .eq("id", file.id);
   */
  async signMajikFile(
    file: MajikFile,
    options?: {
      accountId?: string;
      contentType?: string;
      timestamp?: string;
    },
  ): Promise<MajikSignature> {
    const id = options?.accountId ?? this.getActiveAccount()?.id;
    if (!id)
      throw new Error("No active account — call setActiveAccount() first");

    try {
      await this.keyManager.ensureUnlocked(id);
      // get() is safe after ensureUnlocked() — key is in the memory cache.
      const key = this.keyManager.get(id);
      if (!key) throw new Error(`Account not found in keystore: "${id}"`);
      if (!key.hasSigningKeys) {
        throw new Error(
          `Account "${id}" has no signing keys. ` +
            `Re-import via importAccountFromMnemonicBackup() to enable signing.`,
        );
      }

      return file.sign(key, {
        contentType: options?.contentType,
        timestamp: options?.timestamp,
      });
    } catch (err) {
      this._emit("error", err, { context: "signMajikFile" });
      throw err;
    }
  }

  /**
   * Verify the signature attached to a MajikFile.
   *
   * The file's binary must be loaded — call file.attachBinary(r2Bytes) first
   * if the instance was restored from a metadata-only Supabase row.
   *
   * Signer resolution:
   *   - contactID: looked up in the contact directory (own accounts included)
   *   - publicKeyBase64: looked up via contact directory
   *   - key: used directly (skips directory lookup)
   *   - none provided: falls back to public keys embedded in the signature
   *     envelope (self-reported — always cross-check result.signerId)
   *
   * Returns null if the file has no signature.
   *
   * @example — verify against the file's owner contact
   *   file.attachBinary(await r2.get(row.r2_key).arrayBuffer());
   *   const result = await majik.verifyMajikFile(file, {
   *     contactID: ownerContactId,
   *   });
   *   if (result?.valid) console.log("Verified, signed by", result.signerId);
   */
  async verifyMajikFile(
    file: MajikFile,
    options?: {
      contactID?: string;
      publicKeyBase64?: string;
      key?: MajikKey;
    },
  ): Promise<VerificationResult | null> {
    if (!file.isSigned) return null;

    try {
      const publicKeys = await this._resolveSignerPublicKeys(options);

      if (publicKeys) {
        return file.verify(publicKeys);
      }

      // No signer hint — use self-reported keys from the envelope.
      // Caller is responsible for checking result.signerId against a trusted source.
      const sig = file.signature;
      if (!sig) return null;

      return file.verify(sig.extractPublicKeys());
    } catch (err) {
      this._emit("error", err, { context: "verifyMajikFile" });
      throw err;
    }
  }

  /**
   * Full binary verification of a MajikFile — decrypts first, then verifies
   * the signature against the recovered plaintext bytes.
   *
   * Stronger than verifyMajikFile() because it proves both:
   *   1. The ciphertext decrypts correctly (AES-GCM auth tag passes)
   *   2. The plaintext matches what the signer originally signed
   *
   * Requires both a decryption identity (own account) and the signer's
   * public keys. The binary must be loaded.
   *
   * @param decryptAccountId  Which own account to use for decryption.
   *                          Defaults to the active account.
   *
   * @example
   *   const result = await majik.verifyMajikFileBinary(file, {
   *     contactID: "contact_abc",
   *   });
   *   if (result.valid) console.log("Plaintext verified");
   */
  async verifyMajikFileBinary(
    file: MajikFile,
    options?: {
      contactID?: string;
      publicKeyBase64?: string;
      key?: MajikKey;
      decryptAccountId?: string;
    },
  ): Promise<VerificationResult> {
    if (!file.isSigned) {
      throw new Error(
        "verifyMajikFileBinary: this file has no attached signature",
      );
    }

    const decryptId = options?.decryptAccountId ?? this.getActiveAccount()?.id;
    if (!decryptId)
      throw new Error("No active account — call setActiveAccount() first");

    try {
      const identity = await this._resolveFileIdentity(decryptId);
      const decryptIdentity = {
        fingerprint: identity.fingerprint,
        mlKemSecretKey: identity.mlKemSecretKey,
      };

      const publicKeys = await this._resolveSignerPublicKeys(options);

      if (publicKeys) {
        return file.verifyBinary(decryptIdentity, publicKeys);
      }

      // Fall back to self-reported keys from the envelope
      const sig = file.signature;
      if (!sig) {
        throw new Error(
          "verifyMajikFileBinary: signature could not be deserialized",
        );
      }

      return file.verifyBinary(decryptIdentity, sig.extractPublicKeys());
    } catch (err) {
      this._emit("error", err, { context: "verifyMajikFileBinary" });
      throw err;
    }
  }

  /**
   * Check whether the active (or specified) account is the signer of a
   * MajikFile by comparing fingerprints.
   *
   * This is a fast, synchronous fingerprint comparison — it does NOT
   * cryptographically verify the signature. Use verifyMajikFile() for proof.
   *
   * Useful for gating UI actions:
   *   - Show "Re-sign" button only if the active user is the signer
   *   - Show "Signed by you" vs "Signed by [contact]" labels
   *
   * @returns true if the account's fingerprint matches the envelope's signerId.
   *          false if the file is unsigned, the account has no signing keys,
   *          the account is not in the keystore memory cache, or fingerprints
   *          don't match.
   *
   * @example
   *   if (majik.isActiveAccountSigner(file)) {
   *     showResignButton();
   *   }
   */
  isActiveAccountSigner(file: MajikFile, accountId?: string): boolean {
    const id = accountId ?? this.getActiveAccount()?.id;
    if (!id) return false;

    const sigInfo = file.getSignatureInfo();
    if (!sigInfo) return false;

    // get() checks the memory cache — no async needed since the account
    // must already be loaded to be the active account.
    const key = this.keyManager.get(id);
    if (!key) return false;

    return key.fingerprint === sigInfo.signerId;
  }

  /**
   * Return a rich metadata object describing who signed a MajikFile,
   * without performing cryptographic verification.
   *
   * Combines getSignatureInfo() with a contact directory and keystore lookup
   * so the UI can show a human-readable label (e.g. "Signed by Alice") instead
   * of a raw fingerprint, and can distinguish own-account signatures from
   * external ones.
   *
   * Synchronous — reads only local state. Call verifyMajikFile() separately
   * if cryptographic proof is required.
   *
   * @returns null if the file is unsigned or the signature is malformed.
   *
   * @example
   *   const info = majik.getMajikFileSignerInfo(file);
   *   if (info) {
   *     console.log(info.isOwnAccount ? "Signed by you" : `Signed by ${info.signerLabel}`);
   *     console.log("at", info.timestamp);
   *   }
   */
  getMajikFileSignerInfo(file: MajikFile): {
    signerId: string;
    timestamp: string;
    contentType?: string;
    contentHash: string;
    /** Human-readable contact label if the signer is in the contact directory. */
    signerLabel: string | null;
    /** True if the signer is one of your own accounts. */
    isOwnAccount: boolean;
    /** True if the signer is in the contact directory (own or external). */
    isKnownContact: boolean;
  } | null {
    const info = file.getSignatureInfo();
    if (!info) return null;

    // Scan all contacts (including own accounts) for a fingerprint match.
    // listContacts(true) returns own accounts + external contacts.
    const allContacts = this.listContacts(true);
    const contact = allContacts.find((c) => c.fingerprint === info.signerId);

    const isOwnAccount = this.listOwnAccounts().some(
      (a) => a.fingerprint === info.signerId,
    );

    return {
      ...info,
      signerLabel: contact?.meta?.label ?? null,
      isOwnAccount,
      isKnownContact: contact !== undefined,
    };
  }

  /**
   * Remove the signature from a MajikFile and persist the change.
   *
   * A convenience wrapper around file.removeSignature() that handles the
   * Supabase update in one call. Useful for admin flows or when re-signing
   * after a file mutation.
   *
   * Unlike file.removeSignature() which only mutates the in-memory instance,
   * this method also returns the updated metadata row ready for upsert.
   *
   * Note: removing a signature does not re-encrypt or modify the R2 binary —
   * only the Supabase metadata row changes.
   *
   * @returns The updated MajikFileJSON with signature: null.
   *
   * @example
   *   const updatedRow = majik.unsignMajikFile(file);
   *   await supabase
   *     .from("majik_files")
   *     .update({ signature: null, last_update: updatedRow.last_update })
   *     .eq("id", file.id);
   */
  unsignMajikFile(file: MajikFile): MajikFileJSON {
    file.removeSignature();
    return file.toJSON();
  }

  /**
   * Re-sign a MajikFile — removes any existing signature, then signs
   * with the active (or specified) account.
   *
   * Idempotent: calling this multiple times always produces a fresh signature
   * from the specified account. Useful after a contact label change or when
   * rotating signing keys.
   *
   * The file's binary must be loaded. Call file.attachBinary() first if needed.
   * Persist with file.toJSON() after calling this method.
   *
   * @returns The new MajikSignature.
   *
   * @example
   *   file.attachBinary(await r2.get(row.r2_key).arrayBuffer());
   *   const sig = await majik.resignMajikFile(file);
   *   await supabase
   *     .from("majik_files")
   *     .update({ signature: file.signatureRaw, last_update: file.lastUpdate })
   *     .eq("id", file.id);
   */
  async resignMajikFile(
    file: MajikFile,
    options?: {
      accountId?: string;
      contentType?: string;
      timestamp?: string;
    },
  ): Promise<MajikSignature> {
    file.removeSignature();
    return this.signMajikFile(file, options);
  }

  // ── Text / Detached Signing ───────────────────────────────────────────────────

  /**
   * Convenience alias for signing a plain string.
   *
   * Identical to signContent() but accepts only strings — makes call-sites
   * that deal exclusively with text cleaner (no Uint8Array overload noise).
   *
   * @example
   *   const sig = await majik.signText("Hello world", { contentType: "text/plain" });
   *   const b64 = sig.serialize(); // store alongside the text
   */
  async signText(
    text: string,
    options?: {
      contentType?: string;
      timestamp?: string;
      accountId?: string;
    },
  ): Promise<MajikSignature> {
    if (!text?.trim())
      throw new Error("signText: text must be a non-empty string");
    return this.signContent(text, options);
  }

  /**
   * Sign content and return both the MajikSignature instance and a portable
   * base64-serialized string in one call.
   *
   * The serialized string is safe to store in a database column, embed in a
   * JSON field, pass in an HTTP header, or encode in a QR code alongside the
   * original content. Pass it back to verifyDetached() to verify.
   *
   * @example — sign a document and store the detached signature
   *   const { serialized } = await majik.signAndDetach(docBytes, {
   *     contentType: "application/pdf",
   *   });
   *   await db.insert({ doc_id, signature: serialized });
   *
   * @example — sign a text message
   *   const { signature, serialized } = await majik.signAndDetach("Hello!", {
   *     contentType: "text/plain",
   *   });
   */
  async signAndDetach(
    content: Uint8Array | string,
    options?: {
      contentType?: string;
      timestamp?: string;
      accountId?: string;
    },
  ): Promise<{ signature: MajikSignature; serialized: string }> {
    const signature = await this.signContent(content, options);
    return { signature, serialized: signature.serialize() };
  }

  // ── Text / Detached Verification ──────────────────────────────────────────────

  /**
   * Verify a plain string against a MajikSignature.
   *
   * Accepts the signature as a MajikSignature instance, a MajikSignatureJSON
   * object, or a base64-serialized string — whichever form is easiest at the
   * call-site.
   *
   * The signer can be identified by contact ID, raw public key base64, or a
   * MajikKey instance. If none is provided the public keys embedded in the
   * signature envelope are used (self-reported — cross-check result.signerId
   * against a known contact fingerprint before trusting).
   *
   * @example
   *   const result = await majik.verifyText("Hello world", sig, {
   *     contactID: "contact_abc",
   *   });
   *   if (result.valid) console.log("Authentic");
   */
  async verifyText(
    text: string,
    signature: MajikSignature | MajikSignatureJSON | string,
    options?: {
      contactID?: string;
      publicKeyBase64?: string;
      key?: MajikKey;
      expectedSignerId?: string;
    },
  ): Promise<VerificationResult> {
    if (!text?.trim())
      throw new Error("verifyText: text must be a non-empty string");

    const sig =
      typeof signature === "string"
        ? MajikSignature.deserialize(signature)
        : signature;

    return this.verifyContent(text, sig, options);
  }

  /**
   * Verify content against a base64-serialized detached signature string.
   *
   * This is the pair to signAndDetach() — designed for call-sites that retrieve
   * a stored base64 signature from a database or API and want to verify without
   * importing MajikSignature themselves.
   *
   * The signer can be identified by contact ID, raw public key base64, or a
   * MajikKey. If none is provided, self-reported keys from the envelope are used
   * (see security note on verifyContent).
   *
   * @example
   *   const row = await db.findOne({ doc_id });
   *   const result = await majik.verifyDetached(docBytes, row.signature, {
   *     contactID: row.signer_contact_id,
   *   });
   *   if (result.valid) console.log("Signed by", result.signerId);
   */
  async verifyDetached(
    content: Uint8Array | string,
    serializedSignature: string,
    options?: {
      contactID?: string;
      publicKeyBase64?: string;
      key?: MajikKey;
      expectedSignerId?: string;
    },
  ): Promise<VerificationResult> {
    if (!serializedSignature?.trim()) {
      throw new Error(
        "verifyDetached: serializedSignature must be a non-empty string",
      );
    }

    let sig: MajikSignature;
    try {
      sig = MajikSignature.deserialize(serializedSignature);
    } catch {
      // Fallback: maybe caller passed raw JSON rather than base64
      try {
        sig = MajikSignature.fromJSON(serializedSignature);
      } catch {
        throw new Error(
          "verifyDetached: could not parse signature — expected a base64 " +
            "string from sig.serialize() or a JSON string from sig.toJSON()",
        );
      }
    }

    return this.verifyContent(content, sig, options);
  }

  // ── Signature Serialization Helpers ──────────────────────────────────────────

  /**
   * Deserialize a base64 signature string into a MajikSignature instance.
   *
   * Round-trip partner for MajikSignature.serialize() / sig.toString().
   * Use when you have a stored base64 string and need to inspect or pass
   * the instance to another method.
   *
   * Throws MajikSignatureSerializationError on malformed input.
   *
   * @example
   *   const sig = majik.deserializeSignature(storedBase64);
   *   console.log(sig.signerId, sig.timestamp);
   */
  deserializeSignature(serialized: string): MajikSignature {
    if (!serialized?.trim()) {
      throw new Error("deserializeSignature: input must be a non-empty string");
    }
    return MajikSignature.deserialize(serialized);
  }

  /**
   * Extract lightweight metadata from a base64 or JSON signature string
   * without performing cryptographic verification.
   *
   * Useful for displaying "Signed by X at Y" in a UI before the user
   * explicitly triggers a verification step.
   *
   * Returns null if the string cannot be parsed as a MajikSignature.
   *
   * @example
   *   const meta = majik.getSignatureMetadata(storedSig);
   *   if (meta) {
   *     const contact = majik.getContactByID(meta.signerId);
   *     console.log(`Signed by ${contact?.meta?.label ?? meta.signerId} at ${meta.timestamp}`);
   *   }
   */
  getSignatureMetadata(serialized: string): {
    signerId: string;
    timestamp: string;
    contentType: string | undefined;
    contentHash: string;
    version: number;
  } | null {
    if (!serialized?.trim()) return null;

    try {
      let sig: MajikSignature;
      try {
        sig = MajikSignature.deserialize(serialized);
      } catch {
        sig = MajikSignature.fromJSON(serialized);
      }

      return {
        signerId: sig.signerId,
        timestamp: sig.timestamp,
        contentType: sig.contentType,
        contentHash: sig.contentHash,
        version: sig.version,
      };
    } catch {
      return null;
    }
  }

  // ── Signing Capability Guard ──────────────────────────────────────────────────

  /**
   * Check whether an account has signing keys without throwing.
   *
   * Use this as a fast boolean guard before showing signing UI or before
   * calling any sign* method — those methods throw if signing keys are absent,
   * so checking first lets you degrade gracefully (e.g. hide a "Sign" button).
   *
   * Checks the in-memory keystore cache only — the account must be loaded.
   * Returns false for unknown accounts rather than throwing.
   *
   * @example
   *   if (!majik.hasSigningCapability()) {
   *     showUpgradePrompt("Re-import your account to enable signing");
   *     return;
   *   }
   *   const sig = await majik.signText(message);
   */
  hasSigningCapability(accountId?: string): boolean {
    const id = accountId ?? this.getActiveAccount()?.id;
    if (!id) return false;
    const key = this.keyManager.get(id);
    return key?.hasSigningKeys === true;
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
    this._scheduleOrderSave();
    return response.success;
  }

  // ── Identity / Passphrase ─────────────────────────────────────────────────

  /**
   * Ensure an identity is unlocked.
   * Delegates entirely to this.keyManager.ensureUnlocked() — passphrase prompting
   * is handled there via onUnlockRequested or the optional promptFn.
   */
  async ensureIdentityUnlocked(
    id: string,
    promptFn?: (id: string) => string | Promise<string>,
  ): Promise<CryptoKey | { raw: Uint8Array }> {
    return this.keyManager.ensureUnlocked(id, promptFn);
  }

  async isPassphraseValid(passphrase: string, id?: string): Promise<boolean> {
    const target = id ? this.getOwnAccountById(id) : this.getActiveAccount();
    if (!target) return false;
    return this.keyManager.isPassphraseValid(target.id, passphrase);
  }

  // ── Events ────────────────────────────────────────────────────────────────

  on(event: MajikMessageEvents, callback: EventCallback): void {
    this._listeners.get(event)?.push(callback);
  }

  off(event: MajikMessageEvents, callback?: EventCallback): void {
    const cbs = this._listeners.get(event);
    if (!cbs?.length) return;
    if (callback) {
      const i = cbs.indexOf(callback);
      if (i !== -1) cbs.splice(i, 1);
    } else {
      this._listeners.set(event, []);
    }
  }

  private _emit(event: MajikMessageEvents, ...args: any[]): void {
    this._listeners.get(event)?.forEach((cb) => cb(...args));
  }

  // ── Content & File Signing ────────────────────────────────────────────────

  /**
   * Sign raw bytes or a string using the active account.
   *
   * The active account is unlocked automatically if needed.
   * This is the MajikMessage equivalent of MajikSignature.sign() — it resolves
   * the signing key from the keystore so you don't have to manage it yourself.
   *
   * @example
   *   const sig = await majik.signContent(documentBytes, { contentType: "application/pdf" });
   *   const b64 = sig.serialize(); // store alongside the document
   */
  async signContent(
    content: Uint8Array | string,
    options?: {
      contentType?: string;
      timestamp?: string;
      accountId?: string;
    },
  ): Promise<MajikSignature> {
    const id = options?.accountId ?? this.getActiveAccount()?.id;
    if (!id)
      throw new Error("No active account — call setActiveAccount() first");

    try {
      await this.keyManager.ensureUnlocked(id);
      const key = this.keyManager.get(id);
      if (!key) throw new Error(`Account not found in keystore: "${id}"`);
      if (!key.hasSigningKeys) {
        throw new Error(
          `Account "${id}" has no signing keys. ` +
            `Re-import via importAccountFromMnemonicBackup() to enable signing.`,
        );
      }

      return MajikSignature.sign(content, key, {
        contentType: options?.contentType,
        timestamp: options?.timestamp,
      });
    } catch (err) {
      this._emit("error", err, { context: "signContent" });
      throw err;
    }
  }

  /**
   * Sign a file and embed the signature directly into it using the active account.
   *
   * Format is auto-detected from magic bytes — PDF stays PDF, WAV stays WAV, etc.
   * Strips any existing signature before signing (idempotent re-signing).
   * The active account is unlocked automatically if needed.
   *
   * @example
   *   const { blob: signedPdf } = await majik.signFile(pdfBlob);
   *   // signedPdf is a valid PDF with the signature embedded in its metadata
   *
   * @example — non-active account
   *   const { blob } = await majik.signFile(wavBlob, { accountId: "acc_xyz" });
   */
  async signFile(
    file: Blob,
    options?: {
      contentType?: string;
      timestamp?: string;
      mimeType?: string;
      accountId?: string;
      expectedSigners?: ExpectedSigner[];
    },
  ): Promise<{
    blob: Blob;
    signature: MajikSignature;
    handler: string;
    mimeType: string;
  }> {
    const id = options?.accountId ?? this.getActiveAccount()?.id;
    if (!id)
      throw new Error("No active account — call setActiveAccount() first");

    try {
      await this.keyManager.ensureUnlocked(id);
      const key = this.keyManager.get(id);
      if (!key) throw new Error(`Account not found in keystore: "${id}"`);
      if (!key.hasSigningKeys) {
        throw new Error(
          `Account "${id}" has no signing keys. ` +
            `Re-import via importAccountFromMnemonicBackup() to enable signing.`,
        );
      }

      return MajikSignature.signFile(file, key, {
        contentType: options?.contentType,
        timestamp: options?.timestamp,
        mimeType: options?.mimeType,
        expectedSigners: options?.expectedSigners,
      });
    } catch (err) {
      this._emit("error", err, { context: "signFile" });
      throw err;
    }
  }

  /**
   * Sign multiple file blobs with the active (or specified) account in one call.
   *
   * Each file is signed independently — a failure on one does not abort the
   * others. Check result.error on each item to handle partial failures.
   *
   * The hasSigningKeys check is done once upfront before any signing begins,
   * so the whole batch fails fast if the account can't sign rather than
   * discovering it mid-batch.
   *
   * @example
   *   const results = await majik.batchSignFiles([
   *     { file: pdfBlob, contentType: "application/pdf" },
   *     { file: wavBlob, contentType: "audio/wav" },
   *     { file: mp4Blob, contentType: "video/mp4" },
   *   ]);
   *   for (const r of results) {
   *     if (r.error) console.error("Failed:", r.error.message);
   *     else await r2.put(key, await r.blob!.arrayBuffer());
   *   }
   */
  async batchSignFiles(
    files: Array<{
      file: Blob;
      contentType?: string;
      timestamp?: string;
      mimeType?: string;
    }>,
    options?: { accountId?: string },
  ): Promise<
    Array<{
      blob: Blob | null;
      signature: MajikSignature | null;
      serialized: string | null;
      handler: string | null;
      mimeType: string | null;
      error: Error | null;
    }>
  > {
    const id = options?.accountId ?? this.getActiveAccount()?.id;
    if (!id)
      throw new Error("No active account — call setActiveAccount() first");

    await this.keyManager.ensureUnlocked(id);
    const key = this.keyManager.get(id);
    if (!key) throw new Error(`Account not found in keystore: "${id}"`);
    if (!key.hasSigningKeys) {
      throw new Error(
        `Account "${id}" has no signing keys. ` +
          `Re-import via importAccountFromMnemonicBackup() to enable signing.`,
      );
    }

    return Promise.all(
      files.map(async ({ file, contentType, timestamp, mimeType }) => {
        try {
          const result = await MajikSignature.signFile(file, key, {
            contentType,
            timestamp,
            mimeType,
          });
          return {
            blob: result.blob,
            signature: result.signature,
            serialized: result.signature.serialize(),
            handler: result.handler,
            mimeType: result.mimeType,
            error: null,
          };
        } catch (err) {
          this._emit("error", err, { context: "batchSignFiles" });
          return {
            blob: null,
            signature: null,
            serialized: null,
            handler: null,
            mimeType: null,
            error: err instanceof Error ? err : new Error(String(err)),
          };
        }
      }),
    );
  }

  // ── Verification ──────────────────────────────────────────────────────────

  /**
   * Verify raw bytes or a string against a MajikSignature.
   *
   * The signer can be identified by:
   *   - A contact ID from the contact directory
   *   - A raw base64 public key string (same format used in contacts)
   *   - A MajikKey instance directly
   *
   * If no signer is provided, the public keys embedded in the signature
   * envelope are used (self-reported — see security note below).
   *
   * > ⚠️ When no signer is provided, the extracted public keys are self-reported
   * > by whoever created the signature. Always cross-check `result.signerId`
   * > against a known contact fingerprint before trusting the result.
   *
   * @example — verify against a known contact
   *   const result = await majik.verifyContent(docBytes, sig, { contactID: "contact_abc" });
   *   if (result.valid) console.log("Authentic, signed by:", result.signerId);
   *
   * @example — verify using embedded keys (self-reported)
   *   const result = await majik.verifyContent(docBytes, sig);
   *   // always check result.signerId matches a known fingerprint
   */
  async verifyContent(
    content: Uint8Array | string,
    signature: MajikSignature | MajikSignatureJSON,
    options?: {
      contactID?: string;
      publicKeyBase64?: string;
      key?: MajikKey;
      expectedSignerId?: string;
    },
  ): Promise<VerificationResult> {
    try {
      const publicKeys = await this._resolveSignerPublicKeys(options);

      if (publicKeys) {
        return MajikSignature.verify(content, signature, publicKeys);
      }

      // No signer provided — extract keys from envelope (self-reported)
      const sig =
        signature instanceof MajikSignature
          ? signature
          : MajikSignature.fromJSON(signature);

      return MajikSignature.verify(content, sig, sig.extractPublicKeys());
    } catch (err) {
      this._emit("error", err, { context: "verifyContent" });
      throw err;
    }
  }

  /**
   * Verify a file's embedded signature.
   *
   * The signer can be identified by:
   *   - A contact ID from the contact directory
   *   - A raw base64 public key string
   *   - A MajikKey instance directly
   *
   * If no signer is provided, the public keys embedded in the signature
   * envelope are used (self-reported — see security note on verifyContent).
   *
   * @example — verify a signed PDF against a known contact
   *   const result = await majik.verifyFile(signedPdf, { contactID: "contact_abc" });
   *   if (result.valid) console.log("Verified:", result.signerId, result.timestamp);
   *
   * @example — check own signed file using active account
   *   const result = await majik.verifyFile(signedWav, {
   *     contactID: majik.getActiveAccount()?.id,
   *   });
   */
  async verifyFile(
    file: Blob,
    options?: {
      contactID?: string;
      publicKeyBase64?: string;
      key?: MajikKey;
      expectedSignerId?: string;
      mimeType?: string;
    },
  ): Promise<VerificationResult & { handler?: string; reason?: string }> {
    try {
      const publicKeys = await this._resolveSignerPublicKeys(options);

      if (publicKeys) {
        const results = await MajikSignature.verifyFile(
          file,
          publicKeys,
          {
            expectedSignerId: options?.expectedSignerId,
            mimeType: options?.mimeType,
          },
          true,
        );
        return results[0];
      }

      // No signer provided — extract and use self-reported keys from first signature.
      // For full multi-sig verification, pass a contactID or publicKeyBase64.
      const extracted = await MajikSignature.extractFrom(file, {
        mimeType: options?.mimeType,
      });
      if (!extracted.length) {
        return {
          valid: false,
          signerId: "",
          contentHash: "",
          timestamp: new Date().toISOString(),
          reason: "No embedded signature found",
        };
      }

      const firstSig = extracted[0];
      const results = await MajikSignature.verifyFile(
        file,
        firstSig.extractPublicKeys(),
        {
          expectedSignerId: firstSig.signerId,
          mimeType: options?.mimeType,
        },
        true,
      );
      return results[0];
    } catch (err) {
      this._emit("error", err, { context: "verifyFile" });
      throw err;
    }
  }

  /**
   * Verify multiple files' embedded signatures against the same signer in
   * one call.
   *
   * Each file is verified independently — a failed verification sets
   * result.valid = false and populates result.error, it does not throw.
   *
   * @example
   *   const results = await majik.batchVerifyFiles(
   *     [pdfBlob, wavBlob, mp4Blob],
   *     { contactID: "contact_abc" },
   *   );
   *   const allValid = results.every(r => r.valid);
   */
  async batchVerifyFiles(
    files: Array<
      Blob | { file: Blob; mimeType?: string; expectedSignerId?: string }
    >,
    options?: {
      contactID?: string;
      publicKeyBase64?: string;
      key?: MajikKey;
      expectedSignerId?: string;
    },
  ): Promise<
    Array<
      VerificationResult & {
        handler: string | undefined; // aligned with VerificationResult.handler
        mimeType: string | undefined;
        error: Error | null;
      }
    >
  > {
    // Resolve public keys once — reused across all files in the batch
    const publicKeys = await this._resolveSignerPublicKeys(options).catch(
      () => null,
    );

    return Promise.all(
      files.map(async (entry) => {
        const { file, mimeType, expectedSignerId } =
          entry instanceof Blob
            ? {
                file: entry,
                mimeType: undefined,
                expectedSignerId: options?.expectedSignerId,
              }
            : {
                ...entry,
                expectedSignerId:
                  entry.expectedSignerId ?? options?.expectedSignerId,
              };

        try {
          let result: VerificationResult;

          if (publicKeys) {
            const results = await MajikSignature.verifyFile(file, publicKeys, {
              mimeType,
              expectedSignerId,
            });
            result = results[0];
          } else {
            const extracted = await MajikSignature.extractFrom(file, {
              mimeType,
            });
            if (!extracted.length) {
              return {
                valid: false,
                signerId: undefined,
                contentHash: undefined,
                timestamp: new Date().toISOString(),
                reason: "No embedded signature found",
                handler: undefined,
                mimeType,
                error: null,
              };
            }

            const firstSig = extracted[0];
            const results = await MajikSignature.verifyFile(
              file,
              firstSig.extractPublicKeys(),
              { mimeType, expectedSignerId: firstSig.signerId },
            );
            result = results[0];
          }

          return {
            ...result,
            handler: result.handler,
            mimeType,
            error: null,
          };
        } catch (err) {
          this._emit("error", err, { context: "batchVerifyFiles" });
          return {
            valid: false,
            signerId: undefined,
            contentHash: undefined,
            timestamp: new Date().toISOString(),
            handler: undefined,
            mimeType,
            error: err instanceof Error ? err : new Error(String(err)),
          };
        }
      }),
    );
  }

  // ── Signature Utilities ───────────────────────────────────────────────────

  /**
   * Extract the embedded MajikSignature from a file.
   * Returns an array of fully typed MajikSignature instances, or empty if none found.
   *
   * Does not verify — use verifyFile() to verify.
   *
   * @example
   *   const sig = await majik.extractSignature(file);
   *   if (sig) console.log("Signed by:", sig.signerId, "at", sig.timestamp);
   */
  async extractSignature(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<MajikSignature[]> {
    try {
      return MajikSignature.extractFrom(file, options);
    } catch (err) {
      this._emit("error", err, { context: "extractSignature" });
      throw err;
    }
  }

  /**
   * Return a clean copy of the file with any embedded signature removed.
   * The returned bytes are exactly what was originally signed.
   *
   * Useful before re-processing or re-encrypting a signed file.
   *
   * @example
   *   const originalBlob = await majik.stripSignature(signedMp4);
   */
  async stripSignature(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<Blob> {
    try {
      return MajikSignature.stripFrom(file, options);
    } catch (err) {
      this._emit("error", err, { context: "stripSignature" });
      throw err;
    }
  }

  /**
   * Check whether a file contains an embedded MajikSignature.
   * Does not verify — purely a structural presence check.
   *
   * @example
   *   if (await majik.isFileSigned(file)) {
   *     const result = await majik.verifyFile(file, { contactID });
   *   }
   */
  async isFileSigned(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<boolean> {
    try {
      return MajikSignature.isSigned(file, options);
    } catch (err) {
      this._emit("error", err, { context: "isFileSigned" });
      throw err;
    }
  }

  /**
   * Get the public keys for the active account, ready for use with
   * MajikSignature.verify() or for sharing with another party.
   *
   * Works on locked keys — only reads public fields.
   *
   * @example
   *   const myKeys = await majik.getSigningPublicKeys();
   *   // share myKeys with someone so they can verify your signatures
   */
  async getSigningPublicKeys(
    accountId?: string,
  ): Promise<MajikSignerPublicKeys> {
    const id = accountId ?? this.getActiveAccount()?.id;
    if (!id)
      throw new Error("No active account — call setActiveAccount() first");

    const key = this.keyManager.get(id);
    if (!key) throw new Error(`Account not found in keystore: "${id}"`);
    if (!key.hasSigningKeys) {
      throw new Error(
        `Account "${id}" has no signing keys. ` +
          `Re-import via importAccountFromMnemonicBackup() to enable signing.`,
      );
    }

    return MajikSignature.publicKeysFromMajikKey(key);
  }

  /**
   * Re-sign a file blob — strips any existing embedded signature, signs
   * with the active (or specified) account, and returns the newly signed blob.
   *
   * Use after key rotation or when the signing account changes. The returned
   * blob is the same format as the input — PDF stays PDF, WAV stays WAV.
   *
   * Distinct from resignMajikFile() which operates on a MajikFile instance
   * (the encrypted .mjkb container). This operates on a plain file Blob.
   *
   * @example
   *   const { blob } = await majik.resignFile(oldSignedPdf);
   *   await r2.put(key, await blob.arrayBuffer());
   */
  async resignFile(
    file: Blob,
    options?: {
      contentType?: string;
      timestamp?: string;
      mimeType?: string;
      accountId?: string;
    },
  ): Promise<{
    blob: Blob;
    signature: MajikSignature;
    handler: string;
    mimeType: string;
  }> {
    // signFile already strips before signing — resignFile is a named alias
    // that makes the caller's intent explicit at the call-site.
    return this.signFile(file, options);
  }

  // ── Multi-sig & Allowlist ─────────────────────────────────────────────────

  /**
   * Build an ExpectedSigner entry from a MajikKey.
   * Use this to construct the expectedSigners array passed to signFile().
   * The key does not need to be unlocked.
   *
   * @example
   *   const { blob } = await majik.signFile(file, {
   *     expectedSigners: [
   *       MajikSignatureClient.expectedSignerFromKey(aliceKey),
   *       MajikSignatureClient.expectedSignerFromKey(bobKey),
   *     ],
   *   });
   */
  static expectedSignerFromKey(key: MajikKey): ExpectedSigner {
    return MajikSignature.expectedSignerFromKey(key);
  }

  /**
   * Get the allowlist from a file without verifying any signatures.
   * Returns null for open-signing files or unsigned files.
   *
   * @example
   *   const list = await majik.getAllowlist(file);
   *   if (list) console.log("Restricted to", list.map(e => e.signerId));
   */
  async getAllowlist(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<ExpectedSigner[] | null> {
    try {
      return MajikSignature.getAllowlist(file, options);
    } catch (err) {
      this._emit("error", err, { context: "getAllowlist" });
      throw err;
    }
  }

  /**
   * Check whether a MajikKey is permitted to add a signature to this file.
   * Accounts for seal status and allowlist membership (full three-field check).
   *
   * @example
   *   const { permitted, reason } = await majik.canSign(file, key);
   *   if (!permitted) showError(reason);
   */
  async canSign(
    file: Blob,
    key: MajikKey,
    options?: { mimeType?: string },
  ): Promise<{ permitted: boolean; reason?: string }> {
    try {
      return MajikSignature.canSign(file, key, options);
    } catch (err) {
      this._emit("error", err, { context: "canSign" });
      throw err;
    }
  }

  /**
   * Returns true when the file has a restricted multi-sig envelope
   * (allowlist with more than one expected signer).
   * Returns false for unsigned, open-signing, or single-signer files.
   */
  async isMultiSig(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<boolean> {
    try {
      return MajikSignature.isMultiSig(file, options);
    } catch (err) {
      this._emit("error", err, { context: "isMultiSig" });
      throw err;
    }
  }

  /**
   * Core signatories method — returns all, signed, and pending arrays.
   *
   * When an allowlist is present:
   *   - all     = every expected signer with their signing status
   *   - signed  = those who have already signed
   *   - pending = those who are expected but have not yet signed
   *
   * When no allowlist is present:
   *   - all / signed = actual signers (everyone has signed by definition)
   *   - pending      = always empty
   *
   * Returns null if the file has no envelope.
   *
   * @example
   *   const result = await majik.getSignatories(file);
   *   console.log(`${result?.signed.length} of ${result?.all.length} signed`);
   */
  async getSignatories(
    file: Blob,
    options?: { mimeType?: string },
    filter?: SignatoriesFilter,
  ): Promise<SignatoriesResult | null> {
    try {
      return MajikSignature.getSignatories(file, options, filter);
    } catch (err) {
      this._emit("error", err, { context: "getSignatories" });
      throw err;
    }
  }

  /**
   * Returns only signatories who have already signed.
   * Alias for getSignatories(file, options, "signed").
   */
  async getSignedSignatories(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<SignatoriesResult | null> {
    try {
      return MajikSignature.getSignedSignatories(file, options);
    } catch (err) {
      this._emit("error", err, { context: "getSignedSignatories" });
      throw err;
    }
  }

  /**
   * Returns only signatories who are expected but have not yet signed.
   * Alias for getSignatories(file, options, "pending").
   */
  async getPendingSignatories(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<SignatoriesResult | null> {
    try {
      return MajikSignature.getPendingSignatories(file, options);
    } catch (err) {
      this._emit("error", err, { context: "getPendingSignatories" });
      throw err;
    }
  }

  /**
   * Returns all signatories with full status information.
   * Alias for getSignatories(file, options, "all").
   */
  async getAllSignatories(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<SignatoriesResult | null> {
    try {
      return MajikSignature.getAllSignatories(file, options);
    } catch (err) {
      this._emit("error", err, { context: "getAllSignatories" });
      throw err;
    }
  }

  /**
   * Returns the issuer — the signer who established the allowlist and
   * controls sealing. Returns null for open-signing or unsigned files.
   *
   * @example
   *   const issuer = await majik.getIssuer(file);
   *   if (issuer) console.log("Issued by", majik.resolveSignerLabel(issuer.signerId));
   */
  async getIssuer(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<SignatoryInfo | null> {
    try {
      return MajikSignature.getIssuer(file, options);
    } catch (err) {
      this._emit("error", err, { context: "getIssuer" });
      throw err;
    }
  }

  /**
   * Extract metadata from a file's embedded signature without verifying it.
   *
   * Useful for rendering "Signed by X at Y" in a UI before the user
   * explicitly triggers a verify step, or for routing to the correct
   * contact record before calling verifyFile().
   *
   * Returns null if the file has no embedded signature or the JSON is
   * structurally malformed.
   *
   * @example
   *   const info = await majik.getFileSignatureInfo(pdfBlob);
   *   if (info) {
   *     const contact = majik.getContactByID(info.signerId);
   *     console.log(`Signed by ${contact?.meta?.label ?? info.signerId}`);
   *     console.log(`Format handled by: ${info.handler}`);
   *   }
   */
  async getFileSignatureInfo(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<MajikSignature[]> {
    try {
      return MajikSignature.extractFrom(file, options);
    } catch (err) {
      this._emit("error", err, { context: "getFileSignatureInfo" });
      throw err;
    }
  }

  /**
   * Return a complete summary of the envelope state in one file read.
   * Covers: isMultiSig, isSealed, issuer, all signatories, allowlist, seal info.
   * Useful for rendering a signing status UI without multiple separate calls.
   *
   * Returns null if the file has no envelope.
   *
   * @example
   *   const info = await majik.getEnvelopeInfo(file);
   *   if (info?.isSealed) console.log("Sealed by", info.sealInfo?.sealedBy);
   *   console.log(`${info?.signatories?.signed.length} of ${info?.signatories?.all.length} signed`);
   */
  async getEnvelopeInfo(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<EnvelopeInfo | null> {
    try {
      return MajikSignature.getEnvelopeInfo(file, options);
    } catch (err) {
      this._emit("error", err, { context: "getEnvelopeInfo" });
      throw err;
    }
  }

  // ── Seal ──────────────────────────────────────────────────────────────────

  /**
   * Seal a restricted multi-sig file, preventing any further signatures.
   *
   * Only the issuer (the signer who established the allowlist) may seal.
   * Resolves the signing key from the keystore — the account must be loaded
   * but does NOT need to be unlocked (sealing does not use private keys).
   *
   * @example
   *   const { blob, sealInfo } = await majik.seal(signedFile);
   *   console.log("Sealed at", sealInfo.sealTimestamp);
   */
  async seal(
    file: Blob,
    options?: { mimeType?: string; timestamp?: string; accountId?: string },
  ): Promise<{
    blob: Blob;
    sealInfo: SealInfo;
    handler: string;
    mimeType: string;
  }> {
    const id = options?.accountId ?? this.getActiveAccount()?.id;
    if (!id)
      throw new Error("No active account — call setActiveAccount() first");

    try {
      const key = this.keyManager.get(id);
      if (!key) throw new Error(`Account not found in keystore: "${id}"`);

      return MajikSignature.seal(file, key, {
        mimeType: options?.mimeType,
        timestamp: options?.timestamp,
      });
    } catch (err) {
      this._emit("error", err, { context: "seal" });
      throw err;
    }
  }

  /**
   * Verify the seal hash against the current signatories and seal timestamp.
   * Returns invalid if the envelope is not sealed.
   * Does NOT verify individual cryptographic signatures — call verifyFile() for that.
   *
   * @example
   *   const result = await majik.verifySeal(file);
   *   if (result.valid) console.log("Sealed by", result.sealedBy, "at", result.sealTimestamp);
   */
  async verifySeal(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<SealVerificationResult> {
    try {
      return MajikSignature.verifySeal(file, options);
    } catch (err) {
      this._emit("error", err, { context: "verifySeal" });
      throw err;
    }
  }

  /**
   * Get seal metadata without verifying.
   * Returns null if the file is not sealed or has no envelope.
   *
   * @example
   *   const info = await majik.getSealInfo(file);
   *   if (info) console.log("Sealed by", majik.resolveSignerLabel(info.sealedBy));
   */
  async getSealInfo(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<SealInfo | null> {
    try {
      return MajikSignature.getSealInfo(file, options);
    } catch (err) {
      this._emit("error", err, { context: "getSealInfo" });
      throw err;
    }
  }

  /**
   * Returns true if the file has a sealed envelope (structural check, no crypto).
   * Use verifySeal() to confirm the seal hash is intact.
   */
  async isSealed(
    file: Blob,
    options?: { mimeType?: string },
  ): Promise<boolean> {
    try {
      return MajikSignature.isSealed(file, options);
    } catch (err) {
      this._emit("error", err, { context: "isSealed" });
      throw err;
    }
  }

  // ── Private: Signer resolution ────────────────────────────────────────────

  /**
   * Resolve MajikSignerPublicKeys from whichever signer hint was provided.
   * Returns null if no hint was given (caller should fall back to self-reported keys).
   *
   * Mirrors the _resolveRecipients / _resolveFileIdentity pattern used
   * throughout MajikMessage — consistent account/contact resolution in one place.
   */
  private async _resolveSignerPublicKeys(options?: {
    contactID?: string;
    publicKeyBase64?: string;
    key?: MajikKey;
    expectedSignerId?: string;
  }): Promise<MajikSignerPublicKeys | null> {
    if (!options) return null;

    // Option A: caller passed a MajikKey instance directly
    if (options.key) {
      return MajikSignature.publicKeysFromMajikKey(options.key);
    }

    // Option B: contact ID looked up from the contact directory
    if (options.contactID) {
      const contact = this._contacts.getContact(options.contactID);
      if (!contact) {
        throw new Error(`No contact found for id "${options.contactID}"`);
      }

      // Own accounts are in the keystore — get their signing keys directly
      const ownAccount = this.getOwnAccountById(options.contactID);
      if (ownAccount) {
        const key = this.keyManager.get(options.contactID);
        if (key?.hasSigningKeys) {
          return MajikSignature.publicKeysFromMajikKey(key);
        }
      }

      // External contact — resolve from their contact card fields
      if (!contact.edPublicKeyBase64 || !contact.mlDsaPublicKeyBase64) {
        throw new Error(
          `Contact "${options.contactID}" has no signing public keys. ` +
            `They may need to share an updated contact card.`,
        );
      }

      return {
        signerId: contact.fingerprint,
        edPublicKey: base64ToUint8Array(contact.edPublicKeyBase64),
        mlDsaPublicKey: base64ToUint8Array(contact.mlDsaPublicKeyBase64),
      };
    }

    // Option C: raw base64 public key — look up via contact directory
    if (options.publicKeyBase64) {
      const contact = await this._contacts.getContactByPublicKeyBase64(
        options.publicKeyBase64,
      );
      if (!contact) {
        throw new Error(
          `No contact found for public key "${options.publicKeyBase64}"`,
        );
      }

      if (!contact.edPublicKeyBase64 || !contact.mlDsaPublicKeyBase64) {
        throw new Error(
          `Contact for key "${options.publicKeyBase64}" has no signing public keys.`,
        );
      }

      return {
        signerId: contact.fingerprint,
        edPublicKey: base64ToUint8Array(contact.edPublicKeyBase64),
        mlDsaPublicKey: base64ToUint8Array(contact.mlDsaPublicKeyBase64),
      };
    }

    return null;
  }

  // ==========================================================================
  // ── RESET ─────────────────────────────────────────────────────────────────
  // ==========================================================================

  /**
   * Wipe all data from every adapter and reset in-memory state.
   * The client remains usable — call hydrate() or add new accounts after reset.
   */
  async resetData(): Promise<void> {
    try {
      await this._keys.adapter.clear();
      await this._contacts.clear();
      await this._state.clear();

      if (this._db) {
        await this._db.vacuum();
        await this._db.optimize();
      }

      this._ownAccounts.clear();
      this._ownAccountsOrder = [];

      this._keys = new MajikKeyManager(this._keys.adapter);

      this._emit("active-account-change", null);
    } catch (err) {
      throw new Error(
        `Failed to reset data: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ==========================================================================
  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────
  // ==========================================================================

  private _registerOwnAccount(contact: MajikContact): void {
    if (!this._ownAccounts.has(contact.id)) {
      this._ownAccounts.set(contact.id, contact);
      this._ownAccountsOrder.push(contact.id);
      this._scheduleOrderSave();
    }
    if (!this._contacts.hasContact(contact.id)) {
      this._contacts.addContact(contact);
    }
    if (!this.getActiveAccount()) {
      void this.setActiveAccount(contact.id, true);
    }
  }
}
