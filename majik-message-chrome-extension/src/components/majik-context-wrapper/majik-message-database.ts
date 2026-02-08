// MajikMessageDatabase.ts

import type { MajikUser } from "@thezelijah/majik-user";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  EncryptionEngine,
  MajikContact,
  MajikMessage,
  MajikMessageChat,
  MajikMessageIdentity,
  MajikMessageIdentityJSON,
  MessageEnvelope,
  type MajikMessageAccountID,
  type MajikMessageConfig,
  type MajikMessagePublicKey,
} from "@majikah/majik-message";
import type { AxiosError, AxiosInstance } from "axios";
import axios from "axios";
import type {
  API_CREATE_IDENTITY_BODY,
  API_DELETE_MESSAGE_QUERY,
  API_GET_CONVERSATION_QUERY,
  API_GET_CONVERSATIONS_QUERY,
  API_RESPONSE_CREATE_IDENTITY,
  API_RESPONSE_CREATE_MESSAGE,
  API_RESPONSE_DELETE_MESSAGE,
  API_RESPONSE_GET_CONVERSATION_MESSAGES,
  API_RESPONSE_GET_CONVERSATIONS,
  API_RESPONSE_GET_MESSAGES,
  API_RESPONSE_IDENTITY_EXIST,
  API_RESPONSE_SUCCESS,
  API_RESPONSE_USER_IDENTITY,
} from "../majikah-session-wrapper/api-types";
import { APIKeyManager } from "../../utils/api-manager";
import { createSupabaseBrowserClient } from "../../lib/supabase/supabase";

export const TTL = {
  ONE_DAY: 24,
  THREE_DAYS: 24 * 3,
  ONE_WEEK: 24 * 7,
  FIFTEEN_DAYS: 24 * 15,
  THIRTY_DAYS: 24 * 30,
  THREE_MONTHS: 24 * 30 * 3,
  SIX_MONTHS: 24 * 30 * 6,
} as const;

export type TTL = (typeof TTL)[keyof typeof TTL];

export const MAX_IDENTITY_LIMIT = 5;

export class MajikMessageDatabase extends MajikMessage {
  private api: AxiosInstance;
  private supabase = createSupabaseBrowserClient();
  private user_data: MajikUser | null = null;

  private _identities: MajikMessageIdentity[] = []; // currently known identities
  private activeIdentity: MajikMessageIdentity | null = null; // selected identity

  // caches
  private conversationCache = new Map<string, API_RESPONSE_GET_MESSAGES>();
  private conversationsCache: API_RESPONSE_GET_CONVERSATIONS | null = null;
  private lastConversationsRefresh: number | null = null;
  private conversationsTTL: number = 5 * 60 * 1000;
  private dirtyConversations = new Set<string>();

  // conversation messages cache (per conversation)
  private conversationMessagesCache = new Map<
    string,
    {
      data: API_RESPONSE_GET_CONVERSATION_MESSAGES;
      lastRefresh: number;
    }
  >();

  private conversationMessagesTTL = 2 * 60 * 1000; // 2 minutes

  private lastIdentitiesRefresh: number | null = null; // timestamp in ms
  private identitiesUpdatedSinceRefresh: boolean = false;

  private lastContactsIdentityCheck: string | null = null; // ISO string
  private contactsIdentityCheckTTL = 24 * 60 * 60 * 1000; // 24 hours

  private initPromise: Promise<void> | null = null;

  constructor(config: MajikMessageConfig, id?: string, user?: MajikUser) {
    super(config, id);
    // Additional subclass initialization can go here

    this.user_data = user || null;

    this.api = axios.create({
      baseURL: `https://api.majikah.solutions`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    this.setupAxiosInterceptors();
  }

  /* ================================
   * Axios Setup
   * ================================ */
  private setupAxiosInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(async (config) => {
      const { data } = await this.supabase.auth.getSession();

      if (data.session?.access_token) {
        config.headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const manager = APIKeyManager.initialize(import.meta.env.VITE_API_KEY!);
      const securedAPIKey = manager.encodeAPI();

      if (import.meta.env.VITE_API_KEY) {
        config.headers["X-API-KEY"] = securedAPIKey;
      }

      return config;
    });

    // Response interceptor for handling errors
    this.api.interceptors.response.use(
      (response) => response,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (axiosError: AxiosError<any>) => {
        const data = axiosError.response?.data;

        if (data?.error) {
          throw {
            code: data.code,
            message: data.message,
            requiresOTP: data.requiresOTP,
            email: data.email,
            status: axiosError.response?.status,
          };
        }

        throw axiosError;
      },
    );
  }

  get user(): MajikUser | null {
    return this.user_data;
  }

  set user(user: MajikUser) {
    if (!user) {
      throw new Error("User cannot be null or undefined");
    }

    const userValidation = user.validate();

    if (!userValidation.isValid) {
      throw new Error(userValidation.errors.join(", "));
    }
    this.user_data = user;
    this.clearInit();
  }

  clearUser(): void {
    this.user_data = null;
    this.clearInit();
    this.clearAllCaches();
  }

  /* ================================
   * Cache Helpers
   * ================================ */

  /**
   * Clears all conversation caches
   */
  public clearConversationCaches(): void {
    this.conversationsCache = null;
    this.lastConversationsRefresh = null;
    this.conversationCache.clear();
    this.conversationMessagesCache.clear();
    this.dirtyConversations.clear();
  }

  /**
   * Clears only conversation messages for a specific conversation
   */
  private clearConversationMessagesCache(
    conversationId: string,
    markDirtyFlag = false,
  ): void {
    const cacheKey = this.getConversationCacheKey(conversationId);
    this.conversationMessagesCache.delete(cacheKey);
    this.dirtyConversations.delete(conversationId);
    this.conversationCache.delete(conversationId);
    this.conversationsCache = null;
    this.lastConversationsRefresh = null;
    if (markDirtyFlag) this.markDirty(conversationId);
  }

  /**
   * Clears identities and resets the active identity
   */
  private resetIdentities(): void {
    this._identities = [];
    this.activeIdentity = null;
    this.lastIdentitiesRefresh = null;
    this.identitiesUpdatedSinceRefresh = false;
  }

  /**
   * Clears all caches (conversations, messages, identities)
   */
  public clearAllCaches(): void {
    this.clearConversationCaches();
    this.resetIdentities();
  }

  async setActiveIdentity(identity: MajikMessageIdentity): Promise<void> {
    if (!identity) throw new Error("Identity is required");

    if (!identity.validateIntegrity()) {
      throw new Error("Identity is not valid");
    }
    if (identity.isRestricted()) throw new Error("Identity is restricted");

    const currentAccount = this.getActiveAccount();

    if (identity.id !== currentAccount?.id) {
      const setAccountResponse = await this.setActiveAccount(identity.id);
      if (!setAccountResponse) {
        if (!!this.user && identity.userID === this.user.id) {
          throw new Error(
            "We couldn’t find this account in your saved accounts. Please import it first to use it.",
          );
        }
      }
    }
    this.setCurrentIdentity(identity);
    this.clearConversationCaches();
  }

  /**
   * Clears identities and resets the active identity
   */
  public clearIdentity(): void {
    this.activeIdentity = null;
  }

  private requireUser(): void {
    if (!this.user_data) throw new Error("No valid user logged in");
    const userValidation = this.user_data.validate();

    if (!userValidation.isValid) {
      throw new Error(userValidation.errors.join(", "));
    }
  }

  private requireActiveIdentity(): void {
    if (!this.activeIdentity) throw new Error("No active identity selected");
  }

  // mark dirty when a user sends a message
  private markDirty(conversationId: string): void {
    this.dirtyConversations.add(conversationId);
  }

  private getConversationCacheKey(conversationId: string): string {
    return `${this.activeIdentity!.id}:${conversationId}`;
  }

  /* ================================
   * Identity methods
   * ================================ */

  get identities(): MajikMessageIdentity[] {
    return this._identities;
  }

  get currentIdentity(): MajikMessageIdentity | null {
    return this.activeIdentity;
  }

  setCurrentIdentity(identity: MajikMessageIdentity): void {
    this.requireUser();
    // Only allow identities that exist in the list
    if (!this._identities.find((i) => i.id === identity.id)) {
      throw new Error("Identity not found or not registered online");
    }
    this.activeIdentity = identity;
  }

  /**
   * Attempt to set the currently active account as the active identity
   * Only works if the account exists online (matches a fetched identity by publicKey)
   */
  async promoteActiveAccountToIdentity(): Promise<MajikMessageIdentity | null> {
    this.requireUser();

    let activeAccount = this.getActiveAccount();
    if (!activeAccount) {
      const availableAccounts = this.listOwnAccounts();

      if (!availableAccounts?.length) {
        throw new Error("No accounts found");
      }
      try {
        this.setActiveAccount(availableAccounts[0].id);
        activeAccount = availableAccounts[0];
      } catch {
        throw new Error("No active account found");
      }
    }
    // Try to find a matching identity by id
    const matchedIdentity = this._identities.find(
      (identity) => identity.id === activeAccount.id,
    );

    if (!matchedIdentity) {
      // Account is offline or not registered yet
      return null;
    }

    // Set as active identity
    this.setActiveIdentity(matchedIdentity);
    return matchedIdentity;
  }

  /**
   * Refreshes the list of online identities for the current user
   * Only online identities and the active account are kept
   */
  async refreshIdentities(): Promise<MajikMessageIdentity[]> {
    this.requireUser();
    if (!this.user_data?.id) throw new Error("User ID is required");

    await this.ensureInitialized();

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    // Skip refresh if last refresh was <5min ago AND user hasn't been updated
    if (
      this.lastIdentitiesRefresh &&
      now - this.lastIdentitiesRefresh < fiveMinutes &&
      !this.identitiesUpdatedSinceRefresh
    ) {
      return this._identities!;
    }

    try {
      const res = await this.api.get<API_RESPONSE_USER_IDENTITY>(
        `/identities/user/${this.user_data.id}`,
      );

      const serverIdentities: MajikMessageIdentity[] = res.data.identities.map(
        (item: MajikMessageIdentityJSON) => MajikMessageIdentity.fromJSON(item),
      );

      // Only allow up to 5 identities
      const validIdentities = serverIdentities.slice(0, 5);

      this._identities = validIdentities;
      this.lastIdentitiesRefresh = now;
      this.identitiesUpdatedSinceRefresh = false;

      // If no active identity, attempt to promote the active account
      if (!this.activeIdentity) {
        try {
          await this.promoteActiveAccountToIdentity();
        } catch {
          console.warn("Failed to promote active account to identity");
        }
      } else {
        // Ensure current active identity still exists online
        if (!validIdentities.find((i) => i.id === this.activeIdentity!.id)) {
          this.activeIdentity = null;
        }
      }

      return validIdentities;
    } catch (err) {
      console.error("[GET] refreshIdentities failed:", err);
      throw err;
    }
  }
  async identityExists(accountId: MajikMessageAccountID): Promise<boolean> {
    this.requireUser();
    if (!accountId) throw new Error("Account ID is required");
    const encodedId = encodeURIComponent(accountId);
    try {
      const res = await this.api.get<API_RESPONSE_IDENTITY_EXIST>(
        `/identities/exists/${encodedId}`,
      );
      return res.data.exists;
    } catch (err) {
      console.error("[GET] identityExists failed:", err);
      return false;
    }
  }

  /**
   * Create a new identity for the current user
   */
  async createIdentity(
    account: MajikContact,
  ): Promise<API_RESPONSE_CREATE_IDENTITY> {
    this.requireUser();
    if (!account) throw new Error("Account is required");

    if (!this.canCreateIdentity()) {
      throw new Error("Cannot have more than 5 identities per user");
    }

    const body: API_CREATE_IDENTITY_BODY = {
      user_id: this.user_data!.id,
      account: await account.toJSON(),
    };

    try {
      const res = await this.api.post<API_RESPONSE_CREATE_IDENTITY>(
        "/identities",
        body,
      );

      const newIdentity = MajikMessageIdentity.fromJSON(res.data.data);
      // add to identities if successful
      this._identities.push(newIdentity);
      this.identitiesUpdatedSinceRefresh = true;
      this.getOwnAccountById(newIdentity.id)?.setMajikahStatus(true);
      return res.data;
    } catch (err) {
      console.error("[POST] createIdentity failed:", err);
      throw err;
    }
  }

  public canCreateIdentity(): boolean {
    return this._identities.length < MAX_IDENTITY_LIMIT;
  }

  /**
   * Create a new identity for the current user from its currently active account
   */
  async createIdentityFromActiveAccount(): Promise<API_RESPONSE_CREATE_IDENTITY> {
    const activeAccount = this.getActiveAccount();
    if (!activeAccount) throw new Error("No active account found");

    return await this.createIdentity(activeAccount);
  }

  /**
   * Deletes an existing identity for the current user
   */
  async deleteIdentity(account: MajikMessageIdentity): Promise<boolean> {
    this.requireUser();
    if (!account) throw new Error("Account is required");

    if (!account.validateIntegrity()) {
      throw new Error("Invalid/tampered account");
    }
    const encodedId = encodeURIComponent(account.id);
    try {
      const res = await this.api.delete<API_RESPONSE_SUCCESS>(
        `/identities/${encodedId}`,
      );

      if (res.data.success) {
        this._identities = this._identities.filter(
          (identity) => identity.id !== account.id,
        );
        this.identitiesUpdatedSinceRefresh = true;
        this.setContactMajikahStatus(account.id, false);
      }

      return res.data.success;
    } catch (err) {
      console.error("[DELETE] deleteIdentity failed:", err);
      throw err;
    }
  }

  /* ================================
   * Conversations
   * ================================ */

  async getConversations(
    forceRefresh = false,
  ): Promise<API_RESPONSE_GET_CONVERSATIONS> {
    this.requireUser();
    this.requireActiveIdentity();

    const now = Date.now();
    const cacheExpired = this.lastConversationsRefresh
      ? now - this.lastConversationsRefresh > this.conversationsTTL
      : true;

    if (!forceRefresh && this.conversationsCache && !cacheExpired) {
      return this.conversationsCache;
    }

    const query: API_GET_CONVERSATIONS_QUERY = {
      account_id: this.activeIdentity!.id,
    };

    try {
      const res = await this.api.get<API_RESPONSE_GET_CONVERSATIONS>(
        "/messages/conversations",
        {
          params: query,
        },
      );
      this.conversationsCache = res.data;
      this.lastConversationsRefresh = now;
      return res.data;
    } catch (err) {
      console.error("[GET] getConversations failed:", err);
      throw err;
    }
  }

  async getConversationMessages(
    conversationID: string,
    forceRefresh = false,
  ): Promise<API_RESPONSE_GET_CONVERSATION_MESSAGES> {
    this.requireUser();
    this.requireActiveIdentity();

    const cacheKey = this.getConversationCacheKey(conversationID);
    const now = Date.now();

    const cached = this.conversationMessagesCache.get(cacheKey);
    const isDirty = this.dirtyConversations.has(conversationID);
    const isExpired = cached
      ? now - cached.lastRefresh > this.conversationMessagesTTL
      : true;

    if (!forceRefresh && cached && !isExpired && !isDirty) {
      return cached.data;
    }

    const query: API_GET_CONVERSATION_QUERY = {
      account_id: this.activeIdentity!.id,
    };

    try {
      const res = await this.api.get<API_RESPONSE_GET_CONVERSATION_MESSAGES>(
        `/messages/conversations/${conversationID}`,
        { params: query },
      );

      this.conversationMessagesCache.set(cacheKey, {
        data: res.data,
        lastRefresh: now,
      });

      // clean dirty flag after successful refresh
      this.dirtyConversations.delete(conversationID);

      return res.data;
    } catch (err) {
      console.error("[GET] getConversationMessages failed:", err);
      throw err;
    }
  }

  async createMessage(
    recipients: MajikMessagePublicKey[],
    message: string,
    ttlHours: TTL = TTL.ONE_DAY,
  ): Promise<API_RESPONSE_CREATE_MESSAGE> {
    this.requireUser();
    this.requireActiveIdentity();

    if (!recipients?.length) {
      throw new Error("At least one recipient is required");
    }
    if (!message) {
      throw new Error("Message content is required");
    }

    await this.ensureContactsIdentityChecked();

    // Sanitize message content
    const sanitizedMessage = sanitizeMessage(message);

    // Create message instance (auto-compresses)
    const newChatMessage = await MajikMessageChat.create(
      this.activeIdentity!,
      sanitizedMessage,
      recipients,
      ttlHours * 60 * 60 * 1000,
    );

    // Get compressed message for encryption
    const compressedMessage = newChatMessage.getCompressedMessage();
    const encryptionRecipients = [
      ...recipients,
      this.activeIdentity!.publicKey,
    ];

    // Encrypt the compressed message using EncryptionEngine
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let encryptedPayload: any;

    if (encryptionRecipients.length <= 1) {
      // Solo encryption
      const publicKeyRaw = new Uint8Array(
        base64ToArrayBuffer(this.activeIdentity!.publicKey),
      );
      const pkey = { raw: publicKeyRaw };
      encryptedPayload = await EncryptionEngine.encryptSoloMessage(
        compressedMessage,
        pkey,
      );
    } else {
      // Group encryption
      const recipientData = encryptionRecipients.map((rpkey) => {
        const publicKeyRaw = new Uint8Array(base64ToArrayBuffer(rpkey));
        const pkey = { raw: publicKeyRaw };
        return {
          id: rpkey,
          publicKey: pkey,
        };
      });

      encryptedPayload = await EncryptionEngine.encryptGroupMessage(
        compressedMessage,
        recipientData,
      );
    }

    // Serialize payload
    const payloadBytes = new TextEncoder().encode(
      JSON.stringify(encryptedPayload),
    );

    // Envelope structure: [version byte][sender fingerprint][payload bytes]
    const versionByte = new Uint8Array([2]);
    const fingerprintBytes = new Uint8Array(
      base64ToArrayBuffer(this.activeIdentity!.publicKey),
    );

    // Combine all parts into a single Uint8Array
    const blob = new Uint8Array(
      versionByte.length + fingerprintBytes.length + payloadBytes.length,
    );
    blob.set(versionByte, 0);
    blob.set(fingerprintBytes, versionByte.length);
    blob.set(payloadBytes, versionByte.length + fingerprintBytes.length);

    // Wrap as MessageEnvelope
    const envelope = new MessageEnvelope(blob.buffer);
    const envelopeBase64 = arrayBufferToBase64(envelope.raw);

    // Create scanner string with MAJIK prefix
    const scannerString = `${MessageEnvelope.PREFIX}:${envelopeBase64}`;
    newChatMessage.setMessage(scannerString); // Store encrypted version

    const body = newChatMessage.toJSON();

    try {
      const res = await this.api.post<API_RESPONSE_CREATE_MESSAGE>(
        `/messages/${this.activeIdentity!.id}`,
        body,
      );
      // reset conversation cache since new message added

      const conversationId = res.data.data.conversation_id;

      this.clearConversationMessagesCache(conversationId);
      return res.data;
    } catch (err) {
      console.error("[POST] sendMessage failed:", err);
      throw err;
    }
  }

  async sendBatchMessages(
    messages: {
      recipients: MajikMessagePublicKey[];
      message: string;
      ttl?: TTL;
    }[],
  ): Promise<API_RESPONSE_CREATE_MESSAGE[]> {
    this.requireUser();
    this.requireActiveIdentity();

    if (!messages?.length) throw new Error("No messages provided");

    const results: API_RESPONSE_CREATE_MESSAGE[] = [];

    for (const msg of messages) {
      const res = await this.createMessage(
        msg.recipients,
        msg.message,
        msg.ttl ?? TTL.ONE_DAY,
      );
      results.push(res);
    }

    return results;
  }

  async sendMessageToAccount(
    recipient: MajikContact,
    message: string,
    ttlHours: TTL = TTL.ONE_DAY,
  ): Promise<API_RESPONSE_CREATE_MESSAGE> {
    this.requireUser();
    this.requireActiveIdentity();

    if (!recipient) throw new Error("Recipient is required");
    await this.ensureContactsIdentityChecked();

    // Convert recipient account to public key
    const doesExistOnline = await this.identityExists(recipient.id);
    if (!doesExistOnline)
      throw new Error("Recipient not found or not registered online");

    const recipientPublicKey = await recipient.getPublicKeyBase64();

    return this.createMessage([recipientPublicKey], message, ttlHours);
  }

  async deleteMessage(
    message: MajikMessageChat,
  ): Promise<API_RESPONSE_DELETE_MESSAGE> {
    this.requireUser();
    this.requireActiveIdentity();

    if (!message) {
      throw new Error("Message is required");
    }

    if (!message.isSender(this.currentIdentity!.publicKey!)) {
      throw new Error("Only the sender can delete this message");
    }

    await this.ensureContactsIdentityChecked();

    const redisKey = message.getRedisKey();

    const deleteParams: API_DELETE_MESSAGE_QUERY = {
      account_id: message.account,
    };

    try {
      const res = await this.api.delete<API_RESPONSE_DELETE_MESSAGE>(
        `/messages/${redisKey}`,
        {
          params: deleteParams,
        },
      );
      // reset conversation cache since a message is deleted

      this.clearConversationMessagesCache(message.getConversationID());
      return res.data;
    } catch (err) {
      console.error("[POST] sendMessage failed:", err);
      throw err;
    }
  }

  /* ================================
   * Contacts Identity methods
   * ================================ */

  private hasRecentContactsIdentityCheck(): boolean {
    if (!this.lastContactsIdentityCheck) return false;

    const last = new Date(this.lastContactsIdentityCheck).getTime();
    const now = Date.now();

    return now - last < this.contactsIdentityCheckTTL;
  }

  public areAllContactsRecentlyChecked(): boolean {
    return this.hasRecentContactsIdentityCheck();
  }

  public async checkAllContactsIdentities(force = false): Promise<void> {
    this.requireUser();

    // Skip if recently checked and not forced
    if (!force && this.hasRecentContactsIdentityCheck()) {
      return;
    }

    const contacts = this.listContacts(true) ?? []; // adapt if needed

    if (!contacts.length) {
      this.lastContactsIdentityCheck = new Date().toISOString();
      return;
    }

    // Parallel but controlled checks
    await Promise.all(
      contacts.map(async (contact: MajikContact) => {
        try {
          const exists = await this.identityExists(contact.id);
          contact.setMajikahStatus(exists);
        } catch (err) {
          console.warn(
            `[IDENTITY CHECK] Failed for contact ${contact.id}`,
            err,
          );
          contact.setMajikahStatus(false);
        }
      }),
    );

    // Mark as checked
    this.lastContactsIdentityCheck = new Date().toISOString();
  }

  private async ensureContactsIdentityChecked(): Promise<void> {
    if (!this.hasRecentContactsIdentityCheck()) {
      await this.checkAllContactsIdentities();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        if (!this.user_data) return;
        await this.ensureContactsIdentityChecked();
      })();
    }

    await this.initPromise;
  }

  public async init(): Promise<void> {
    await this.ensureInitialized();
  }

  private clearInit(): void {
    this.initPromise = null;
    this.lastContactsIdentityCheck = null;
  }
}

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

function sanitizeMessage(message: string): string {
  // Basic sanitization - adjust based on your needs
  return message.trim().slice(0, MAX_MESSAGE_SIZE);
}
