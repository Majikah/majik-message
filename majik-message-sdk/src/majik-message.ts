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

import { base64ToUint8Array } from "./core/utils/utilities";

import type {
  AppBackUpData,
  DecryptFileOptions,
  EncryptFileOptions,
  EncryptFileResult,
  MAJIK_API_RESPONSE,
} from "./core/types";
import { MajikMessageChat } from "./core/database/chat/majik-message-chat";
import { MajikMessageIdentity } from "./core/database/system/identity";
import { MajikKey, MajikKeyAddress } from "@majikah/majik-key";
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
  ExpectedSigner,
  MajikSignature,
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
  UserAppPreferences,
} from "./core/storage";
import { ClientStateManager } from "./core/client-state-manager";
import { MajikCompressedJSON } from "@majikah/majik-cjson";
import {
  MAJIK_MESSAGE_BACKUP_MAGIC,
  MAJIK_MESSAGE_BACKUP_MAGIC_SIZE,
} from "./core/backup/constants";
import { prependMagic, readBackupBlob } from "./core/backup/utils";
import { AppDataSnapshot, ContactManagerSnapshot } from "./core/backup/types";
import {
  MajikKeyClient,
  MajikKeyClientBaseEvents,
  MajikKeyClientConfig,
} from "@majikah/majik-key-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type MajikMessageEvents =
  | MajikKeyClientBaseEvents
  | "new-contact"
  | "removed-contact"
  | "new-contact-group"
  | "removed-contact-group"
  | "contact-group-change"
  | "message"
  | "envelope"
  | "untrusted";

export interface MajikMessageConfig extends MajikKeyClientConfig {
  clientStateManager?: ClientStateManager; // narrower — OK, interfaces allow this
  contactManager?: MajikContactManager;
  envelopeCache?: EnvelopeCache;
  adapters?: MajikKeyClientConfig["adapters"] & {
    contacts?: MajikContactManagerAdapters;
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

// ─── MajikMessage ─────────────────────────────────────────────────────────────

export class MajikMessage extends MajikKeyClient<
  MajikContact,
  MajikContactMeta,
  MajikMessageEvents,
  ClientStateManager
> {
  private _contacts: MajikContactManager;

  private envelopeCache: EnvelopeCache;

  constructor(config: MajikMessageConfig) {
    super(config);

    this._contacts =
      config.contactManager ??
      new MajikContactManager(undefined, undefined, config.adapters?.contacts);

    this.envelopeCache = config.envelopeCache || new EnvelopeCache(undefined);

    // Base already registers: new-account, removed-account, updated-account,
    // active-account-change, unlock, lock, error, restore-backup.
    this._registerEventNames([
      "message",
      "envelope",
      "untrusted",
      "new-contact",
      "new-contact-group",
      "removed-contact",
      "removed-contact-group",
      "contact-group-change",
    ]);
  }

  /**
   * Override — without this, MajikKeyClient's constructor falls back to
   * building a plain MajikKeyClientStateManager (ACCOUNT_ORDER only),
   * and every call to getUserAppPreferences() etc. throws at runtime.
   */
  protected _createDefaultStateManager(
    adapter?: ClientStateStorageAdapter,
  ): ClientStateManager {
    return new ClientStateManager(adapter ?? new InMemoryClientStateAdapter());
  }

  /** Expose the client state manager for direct access if needed. */
  get stateManager(): ClientStateManager {
    return this._state;
  }

  // ==========================================================================
  // ── MajikKeyClient HOOKS ──────────────────────────────────────────────────
  // ==========================================================================

  protected _buildOwnAccountContact(
    key: MajikKey,
    meta?: Partial<MajikContactMeta>,
  ): MajikContact {
    return key.toContact(meta);
  }

  protected async _onAccountRegistered(contact: MajikContact): Promise<void> {
    if (!this._contacts.hasContact(contact.id)) {
      await this._contacts.addContact(contact);
    }
  }

  protected async _onAccountRemoved(id: string): Promise<void> {
    await this._contacts.removeContact(id);
  }

  // ==========================================================================
  // ── RESET ─────────────────────────────────────────────────────────────────
  // ==========================================================================

  /**
   * Wipe all data from every adapter and reset in-memory state.
   * The client remains usable — call hydrate() or add new accounts after reset.
   */

  protected async _onResetKeyData(): Promise<void> {
    await this._contacts.clear();
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
    publicKeys: MajikKeyAddress[],
  ): Promise<MajikRecipient[]> {
    return Promise.all(
      publicKeys.map(async (pkey) => {
        const contact = await this._contacts.getContactByAddress(pkey);
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
    publicKeys: MajikKeyAddress[],
  ): Promise<MajikFileRecipient[]> {
    return Promise.all(
      publicKeys.map(async (pkey) => {
        const contact = await this._contacts.getContactByAddress(pkey);
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
  // ── USER APP PREFERENCES ──────────────────────────────────────────────────────
  // ==========================================================================

  /**
   * Retrieve persisted user app prefernces, or `null` if none have been saved.
   */
  async getUserAppPreferences(): Promise<UserAppPreferences> {
    return this._state.getUserAppPreferences();
  }

  /**
   * Persist user app prefernces.
   */
  async setUserAppPreferences(preferences: UserAppPreferences): Promise<void> {
    await this._state.setUserAppPreferences(preferences);
  }

  /**
   * Remove persisted user app prefernces.
   */
  async removeUserAppPreferences(): Promise<void> {
    await this._state.removeUserAppPreferences();
  }

  /**
   * Reset persisted user app prefernces to default settings.
   */
  async resetUserAppPreferences(): Promise<void> {
    await this._state.resetUserAppPreferences();
  }

  async isAnalyticsEnabled(): Promise<boolean> {
    const appPreferences = await this._state.getUserAppPreferences();
    return appPreferences.privacy.shareAnalytics ?? false;
  }
  async isOnetimeUnlockEnabled(): Promise<boolean> {
    const appPreferences = await this.stateManager.getUserAppPreferences();
    return appPreferences.security?.key?.onetimeUnlock ?? true;
  }

  // ==========================================================================
  // ── ACCOUNT MANAGEMENT ────────────────────────────────────────────────────
  // ==========================================================================

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

  hasContact(id: string): boolean {
    if (!id?.trim()) throw new Error("Invalid contact ID");
    return this._contacts.hasContact(id);
  }

  async hasContactByPublicKeyBase64(
    publicKey: MajikKeyAddress,
  ): Promise<boolean> {
    if (!publicKey?.trim()) throw new Error("Invalid contact public key");
    return await this._contacts.hasContactByPublicKeyBase64(publicKey);
  }

  async getContactByPublicKey(
    address: MajikKeyAddress,
  ): Promise<MajikContact | null> {
    if (!address?.trim()) throw new Error("Invalid public key address");
    return (await this._contacts.getContactByAddress(address)) ?? null;
  }

  getContactsByID(ids: string[], strict = false): MajikContact[] {
    if (!ids?.length) throw new Error("At least 1 id is required");
    return this._contacts.getContactsByIds(ids, strict);
  }

  async getContactsByPublicKey(publicKeys: string[]): Promise<MajikContact[]> {
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

  listContacts(
    includeOwnAccounts = false,
    majikahOnly: boolean = false,
  ): MajikContact[] {
    const contacts = this._contacts.listContacts(true, majikahOnly);
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
    recipientPublicKeys: MajikKeyAddress[],
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
    recipientPubKeys: MajikKeyAddress[] = [],
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
    recipientPublicKeys: MajikKeyAddress[] = [],
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
    recipientsKeys: MajikKeyAddress[],
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
    address?: string;
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
    if (options.address) {
      const contact = await this._contacts.getContactByAddress(options.address);
      if (!contact) {
        throw new Error(`No contact found for public key "${options.address}"`);
      }

      if (!contact.edPublicKeyBase64 || !contact.mlDsaPublicKeyBase64) {
        throw new Error(
          `Contact for key "${options.address}" has no signing public keys.`,
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
  // ── Backup App Data ───────────────────────────────────────────────────────
  // ==========================================================================

  // backupChatMessages(): Blob {
  //   const chatMessages = this.list();
  //   const listJSON = chatMessages.map((inv) => inv.toJSON());
  //   const cj = MajikCompressedJSON.create<MajikInvoiceJSON>(listJSON);
  //   const payload = cj.toBinary();
  //   const stamped = prependMagic(MAJIK_MESSAGE_BACKUP_MAGIC.chatMessages, payload);
  //   return new Blob([stamped as BlobPart], {
  //     type: "application/octet-stream",
  //   });
  // }

  async backupContacts(): Promise<Blob> {
    // Use toJSON() so groups are included alongside contacts
    const managerJSON = await this._contacts.toJSON();
    const cj = MajikCompressedJSON.create<MajikContactManagerJSON>(managerJSON);
    const payload = cj.toBinary();
    const stamped = prependMagic(MAJIK_MESSAGE_BACKUP_MAGIC.contacts, payload);
    return new Blob([stamped as BlobPart], {
      type: "application/octet-stream",
    });
  }

  async backupAppData(): Promise<Blob> {
    // const chatMessages = this.listInvoices();
    // const chatMessagesJSON = chatMessages.map((inv) => inv.toJSON());
    const contactsJSON = await this._contacts.toJSON();

    const userPref = await this.getUserAppPreferences();

    const backupJSON: AppBackUpData = {
      contacts: contactsJSON,
      // chats: chatMessagesJSON,

      preferences: userPref ?? undefined,
    };

    const cj = MajikCompressedJSON.create<AppBackUpData>(backupJSON);
    const payload = cj.toBinary();
    const stamped = prependMagic(MAJIK_MESSAGE_BACKUP_MAGIC.appData, payload);
    return new Blob([stamped as BlobPart], {
      type: "application/octet-stream",
    });
  }

  // ==========================================================================
  // ── Restore App Data ──────────────────────────────────────────────────────
  // ==========================================================================

  // ── Private parsers (no side-effects) ─────────────────────────────────────

  // private async _parseChatMessagesBackup(
  //   input: Blob | ArrayBufferLike | ArrayBufferView,
  // ): Promise<MajikMessageChat[]> {
  //   const payload = await readBackupBlob(
  //     input,
  //     MAJIK_MESSAGE_BACKUP_MAGIC.chats,
  //     "chatMessages",
  //   );
  //   const cj =
  //     await MajikCompressedJSON.fromMJKCJSON<MajikMessageChatJSON[]>(payload);
  //   return cj.payload.map((json) => MajikMessageChat.fromJSON(json));
  // }

  /**
   * Parses a contacts backup blob into a ContactManagerSnapshot —
   * the raw JSON plus pre-hydrated contact instances and group list.
   * No side-effects; nothing is written to the live store.
   */
  private async _parseContactsBackup(
    input: Blob | ArrayBufferLike | ArrayBufferView,
  ): Promise<ContactManagerSnapshot> {
    const payload = await readBackupBlob(
      input,
      MAJIK_MESSAGE_BACKUP_MAGIC.contacts,
      "contacts",
    );
    const cj =
      await MajikCompressedJSON.fromMJKCJSON<MajikContactManagerJSON>(payload);

    const managerJSON = cj.payload;

    // Hydrate a throw-away manager so callers get real instances, not raw JSON
    const tempManager = await MajikContactManager.fromJSON(managerJSON);

    const contacts = tempManager.listContacts(false);
    // listGroups(false) = user groups only, no system groups
    const groups = tempManager.listGroups(false);

    return { managerJSON, contacts, groups };
  }

  // ── Public restore (saves to store) ───────────────────────────────────────

  // async restoreChatMessages(
  //   input: Blob | ArrayBufferLike | ArrayBufferView,
  // ): Promise<{ restored: number }> {
  //   const chatMessages = await this._parseChatMessagesBackup(input);
  //   await Promise.all(chatMessages.map((inv) => this._chatMessages.save(inv)));
  //   return { restored: chatMessages.length };
  // }

  /**
   * Restores contacts (and optionally groups) from a contacts backup blob.
   *
   * @param overwriteContacts  When true, existing contacts with matching IDs
   *                           are replaced. When false, only new contacts are
   *                           added and duplicates are skipped.
   * @param includeGroups      When true, user-defined groups from the backup
   *                           are merged into the live store. System groups
   *                           (Favorites, Blocked) are never overwritten.
   */
  async restoreContacts(
    input: Blob | ArrayBufferLike | ArrayBufferView,
    options: {
      overwriteContacts?: boolean;
      includeGroups?: boolean;
    } = {},
  ): Promise<{ contacts: number; groups: number }> {
    const { overwriteContacts = true, includeGroups = true } = options;

    const { contacts, groups } = await this._parseContactsBackup(input);

    let contactCount = 0;
    for (const contact of contacts) {
      const exists = !!this._contacts.getContact(contact.id);
      if (exists && !overwriteContacts) continue;
      await this.addContact(contact);
      contactCount++;
    }

    let groupCount = 0;
    if (includeGroups) {
      for (const group of groups) {
        // Skip system groups — Favorites / Blocked must never be replaced
        if (group.isSystem) continue;

        if (!this._contacts.hasGroup(group.id)) {
          await this._contacts.addGroup(group);
        } else {
          // Merge membership only — don't clobber name/meta
          for (const memberId of group.listMemberIds()) {
            // Only add members that were actually restored
            if (this._contacts.hasContact(memberId)) {
              await this._contacts.addContactToGroupIfAbsent(
                group.id,
                memberId,
              );
            }
          }
        }
        groupCount++;
      }
    }

    return { contacts: contactCount, groups: groupCount };
  }

  // ── Public read (no side-effects) ─────────────────────────────────────────

  // async readInvoicesBackup(
  //   input: Blob | ArrayBufferLike | ArrayBufferView,
  // ): Promise<MajikInvoice[]> {
  //   return this._parseInvoicesBackup(input);
  // }

  /**
   * Parses a contacts backup without writing anything to the live store.
   * Returns contacts and user-defined groups for the caller to preview.
   */
  async readContactsBackup(
    input: Blob | ArrayBufferLike | ArrayBufferView,
  ): Promise<ContactManagerSnapshot> {
    return this._parseContactsBackup(input);
  }

  /**
   * Restores all data from a full backup blob produced by `backupAppData()`.
   * Contacts and groups are restored before chatMessages so recipients resolve
   * correctly.
   */
  async restoreAppData(blob: Blob): Promise<{
    contacts: number;
    groups: number;
    chatMessages: number;
  }> {
    const payload = await readBackupBlob(
      blob,
      MAJIK_MESSAGE_BACKUP_MAGIC.appData,
      "app data",
    );
    const cj = await MajikCompressedJSON.fromMJKCJSON<AppBackUpData>(payload);
    const data = cj.payload;

    // 1. Contacts
    const tempManager = await MajikContactManager.fromJSON(data.contacts);
    const contacts = tempManager.listContacts(false);
    const groups = tempManager.listGroups(false);

    for (const contact of contacts) {
      await this._contacts.addContact(contact);
    }

    for (const group of groups) {
      if (group.isSystem) continue;
      if (!this._contacts.hasGroup(group.id)) {
        await this._contacts.addGroup(group);
      } else {
        for (const memberId of group.listMemberIds()) {
          if (this._contacts.hasContact(memberId)) {
            await this._contacts.addContactToGroupIfAbsent(group.id, memberId);
          }
        }
      }
    }

    // 2. Chats
    // await Promise.all(
    //   (data.chatMessages ?? []).map((json) => {
    //     const invoice = MajikInvoice.fromJSON(json);
    //     return this._chatMessages.save(invoice);
    //   }),
    // );

    if (data.preferences) {
      await this.setUserAppPreferences(data.preferences);
    }

    return {
      contacts: contacts.length,
      groups: groups.filter((g) => !g.isSystem).length,
      chatMessages: data.chatMessages?.length ?? 0,
    };
  }

  /**
   * Probes the first bytes of a blob and returns which backup type it is,
   * without fully parsing it. Useful for file-picker validation UI.
   *
   * @returns `"chats" | "contacts" | "appData" | "unknown"`
   */
  static async probeBackupType(
    blob: Blob,
  ): Promise<"chats" | "contacts" | "appData" | "unknown"> {
    const header = new Uint8Array(
      await blob.slice(0, MAJIK_MESSAGE_BACKUP_MAGIC_SIZE).arrayBuffer(),
    );

    for (const [type, magic] of Object.entries(MAJIK_MESSAGE_BACKUP_MAGIC) as [
      keyof typeof MAJIK_MESSAGE_BACKUP_MAGIC,
      Uint8Array,
    ][]) {
      if (magic.every((byte, i) => header[i] === byte)) return type;
    }

    return "unknown";
  }

  // ── Private parser ─────────────────────────────────────────────────────────

  /**
   * Parses an app data backup blob into an AppDataSnapshot.
   * No side-effects; nothing is written to the live store.
   */
  private async _parseAppDataBackup(
    input: Blob | ArrayBufferLike | ArrayBufferView,
  ): Promise<AppDataSnapshot> {
    const payload = await readBackupBlob(
      input,
      MAJIK_MESSAGE_BACKUP_MAGIC.appData,
      "app data",
    );
    const cj = await MajikCompressedJSON.fromMJKCJSON<AppBackUpData>(payload);
    const data = cj.payload;

    const tempManager = await MajikContactManager.fromJSON(data.contacts);
    const contacts = tempManager.listContacts(false);
    const groups = tempManager.listGroups(false);
    const chatMessages = (data.chatMessages ?? []).map((json) =>
      MajikMessageChat.fromJSON(json),
    );

    return {
      chats: chatMessages,
      contacts,
      groups,

      preferences: data.preferences ?? null,
      // Keep raw manager JSON for the restore path
      _contactsManagerJSON: data.contacts,
    };
  }

  // ── Public read (no side-effects) ─────────────────────────────────────────

  /**
   * Parses an app data backup without writing anything to the live store.
   * Returns a full snapshot for the caller to preview and selectively restore.
   */
  async readAppDataBackup(
    input: Blob | ArrayBufferLike | ArrayBufferView,
  ): Promise<AppDataSnapshot> {
    return this._parseAppDataBackup(input);
  }

  // ── Public restore (selective) ────────────────────────────────────────────

  /**
   * Restores selected sections from an app data backup snapshot.
   * The caller controls exactly which domains are written.
   */
  async restoreAppDataSelective(
    snapshot: AppDataSnapshot,
    options: {
      chatMessages?: boolean;
      contacts?: boolean;
      groups?: boolean;
      invoiceDefaults?: boolean;
      preferences?: boolean;
      overwriteContacts?: boolean;
    } = {},
  ): Promise<{
    chatMessages: number;
    contacts: number;
    groups: number;
    invoiceDefaults: boolean;
    preferences: boolean;
  }> {
    const {
      // chatMessages: doChatMessages = true,
      contacts: doContacts = true,
      groups: doGroups = true,
      preferences: doPreferences = true,
      overwriteContacts = true,
    } = options;

    let invoiceCount = 0;
    let contactCount = 0;
    let groupCount = 0;
    let defaultsRestored = false;
    let preferencesRestored = false;

    // 1. Contacts first — chatMessages may reference them
    if (doContacts) {
      for (const contact of snapshot.contacts) {
        const exists = !!this._contacts.getContact(contact.id);
        if (exists && !overwriteContacts) continue;
        await this.addContact(contact);
        contactCount++;
      }
    }

    // 2. Groups — only members that landed in the store are linked
    if (doGroups) {
      for (const group of snapshot.groups) {
        if (group.isSystem) continue;
        if (!this._contacts.hasGroup(group.id)) {
          await this.addGroup(group);
        } else {
          for (const memberId of group.listMemberIds()) {
            if (this._contacts.hasContact(memberId)) {
              await this._contacts.addContactToGroupIfAbsent(
                group.id,
                memberId,
              );
            }
          }
        }
        groupCount++;
      }
    }

    // 3. Chats
    // if (doChatMessages) {
    //   await Promise.all(
    //     snapshot.chats.map((inv) => this._chatMessages.save(inv)),
    //   );
    //   invoiceCount = snapshot.chatMessages.length;
    // }

    // 5. App preferences
    if (doPreferences && snapshot.preferences) {
      await this.setUserAppPreferences(snapshot.preferences);
      preferencesRestored = true;
    }
    const restoredData = {
      chatMessages: invoiceCount,
      contacts: contactCount,
      groups: groupCount,
      invoiceDefaults: defaultsRestored,
      preferences: preferencesRestored,
    };

    return restoredData;
  }
}
