import { hash } from "@stablelib/sha256";
import { MajikCompressor } from "../../compressor/majik-compressor";
import type { MajikMessageChatID } from "../../types";
import { arrayToBase64, autogenerateID } from "../../utils/utilities";
import { MajikMessageIdentity } from "../system/identity";
import { MajikMessageChatJSON, RedisKey } from "./types";
import { MajikKeyAddress, MajikKeyFingerprint } from "@majikah/majik-key";

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

/**
 * Represents a temporary, compressed message with automatic expiration.
 * Messages are automatically compressed on creation and stored in Redis by default.
 * Optionally can be persisted to Supabase for long-term storage.
 */
export class MajikMessageChat {
  private id: MajikMessageChatID;
  private _account: MajikKeyFingerprint;
  private message: string;
  private sender: MajikKeyAddress;
  private recipients: MajikKeyAddress[];
  private timestamp: string;
  private expires_at: string;
  private read_by: string[];
  private conversation_id: string;
  private permanent: boolean;

  // Maximum allowed length for the compressed message string
  private static readonly MAX_MESSAGE_LENGTH = 10000;

  constructor(
    id: MajikMessageChatID,
    account: MajikKeyFingerprint,
    message: string,
    sender: MajikKeyAddress,
    recipients: MajikKeyAddress[],
    timestamp: string,
    expires_at: string,
    read_by: string[] = [],
    conversation_id?: string,
    permanent: boolean = false,
  ) {
    this.validateID(id);
    this.validateAccount(account);
    this.validateMessage(message);
    this.validateSender(sender);
    this.validateRecipients(recipients);
    this.validateTimestamp(timestamp);
    this.validateExpiresAt(expires_at, timestamp);
    this.validateReadBy(read_by, recipients);

    this.id = id;
    this._account = account;
    this.message = message;
    this.sender = sender;
    this.recipients = [...recipients]; // Clone to prevent external mutation
    this.timestamp = timestamp;
    this.expires_at = expires_at;
    this.read_by = [...read_by]; // Clone to prevent external mutation

    this.permanent = permanent;

    this.conversation_id = conversation_id || this.generateConversationID();
  }

  // ============= GETTERS =============

  getID(): string {
    return this.id;
  }

  getConversationID(): string {
    return this.conversation_id;
  }

  get account(): MajikKeyFingerprint {
    return this._account;
  }

  set account(account: MajikMessageIdentity) {
    if (!account) {
      throw new Error("Invalid sender account: must be provided");
    }

    if (!account.validateIntegrity()) {
      throw new Error("Invalid sender account: integrity check failed");
    }

    if (account.isRestricted()) {
      throw new Error("This account is restricted and cannot send messages");
    }

    const accountID = account.id;
    this._account = accountID;
  }

  /**
   * Gets the decompressed message content.
   * @returns Promise resolving to the original uncompressed message string
   * @throws Error if message is expired or decompression fails
   */
  async getMessage(): Promise<string> {
    if (this.isExpired()) {
      throw new Error("Cannot access message: message has expired");
    }

    try {
      return await MajikCompressor.decompressString(this.message);
    } catch (error) {
      throw new Error(
        `Failed to decompress message: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Gets the raw compressed message without decompression.
   * Use this for encryption, storage operations, or when decompression is not needed.
   * @returns The compressed message string
   */
  getCompressedMessage(): string {
    return this.message;
  }

  /**
   * Set the message content (already encrypted).
   * Used after encryption to update the message with encrypted payload.
   */
  setMessage(compressedMessage: string): void {
    this.validateMessage(compressedMessage);
    this.message = compressedMessage;
  }

  getSender(): string {
    return this.sender;
  }

  getRecipients(): string[] {
    return [...this.recipients]; // Return a copy to prevent external mutation
  }

  getTimestamp(): string {
    return this.timestamp;
  }

  getExpiresAt(): string {
    return this.expires_at;
  }

  getReadBy(): string[] {
    return [...this.read_by]; // Return a copy to prevent external mutation
  }

  // ============= STATIC FACTORY METHOD =============

  /**
   * Creates a new message instance with automatic compression.
   * @param account - Majik Message identity account of the message sender
   * @param message - Plain text message that will be automatically compressed
   * @param recipients - Array of recipient public keys
   * @param expiresInMs - Time until expiration in milliseconds (default: 24 hours)
   * @returns Promise resolving to new MajikMessageChat instance with compressed message
   * @throws Error if validation or compression fails
   */
  static async create(
    account: MajikMessageIdentity,
    message: string,
    recipients: MajikKeyAddress[],
    expiresInMs: number = 24 * 60 * 60 * 1000,
    permanent: boolean = false,
  ): Promise<MajikMessageChat> {
    if (!account) {
      throw new Error("Invalid sender account: must be provided");
    }

    if (!account.validateIntegrity()) {
      throw new Error("Invalid sender account: integrity check failed");
    }

    if (account.isRestricted()) {
      throw new Error("This account is restricted and cannot send messages");
    }

    const accountID = account.id;
    const senderID = account.publicKey;

    if (!senderID || typeof senderID !== "string" || senderID.trim() === "") {
      throw new Error("Invalid sender ID: must be a non-empty string");
    }

    if (!message || typeof message !== "string" || message.trim() === "") {
      throw new Error("Invalid message: must be a non-empty string");
    }

    // Validate **raw** message length before compression
    this.validateRawMessageLength(message);

    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error("Invalid recipients: must be a non-empty array");
    }

    if (typeof expiresInMs !== "number" || expiresInMs <= 0) {
      throw new Error("Invalid expiresInMs: must be a positive number");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMs);

    // Compress the message before storing
    let compressedMessage: string;
    try {
      compressedMessage = await MajikCompressor.compress(
        "plaintext",
        message.trim(),
      );
    } catch (error) {
      throw new Error(
        `Failed to compress message: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }

    return new MajikMessageChat(
      autogenerateID(),
      accountID,
      compressedMessage,
      senderID.trim(),
      recipients.map((r) => r.trim()).filter((r) => r !== ""),
      now.toISOString(),
      expiresAt.toISOString(),
      [],
      undefined,
      permanent,
    );
  }

  // ============= STATIC HELPER METHODS =============

  /**
   * Generate a deterministic conversation ID from a message JSON
   * Reads sender and recipients directly from JSON without parsing
   */
  static generateConversationID(message: MajikMessageChatJSON): string {
    // Get all participants (sender + recipients) directly from JSON
    const participants = new Set<MajikKeyAddress>();
    participants.add(message.sender);
    message.recipients.forEach((r) => participants.add(r));

    // Sort alphabetically to ensure same conversation ID regardless of order
    const sorted = Array.from(participants).sort();

    // Join with delimiter
    const combined = sorted.join("|");

    // Convert to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);

    const hashedID = hash(data);
    const hashBase64 = arrayToBase64(hashedID);

    return `conv_${hashBase64}`;
  }

  /**
   * Generate a deterministic conversation ID from a message
   * Automatically includes sender and all recipients, normalized by alphabetical order
   * then hashes with SHA-256 and encodes as base64
   */
  generateConversationID(): string {
    // Get all participants (sender + recipients)
    const participants = new Set<MajikKeyAddress>();
    participants.add(this.getSender());
    this.getRecipients().forEach((r) => participants.add(r));

    // Sort alphabetically to ensure same conversation ID regardless of order
    const sorted = Array.from(participants).sort();

    // Join with delimiter
    const combined = sorted.join("|");

    // Convert to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);

    const hashedID = hash(data);
    const hashBase64 = arrayToBase64(hashedID);

    return `conv_${hashBase64}`;
  }

  /**
   * Get all participants for a message (sender + recipients)
   */
  getParticipants(): MajikKeyAddress[] {
    const participants = new Set<MajikKeyAddress>();

    // Add sender
    participants.add(this.getSender());

    // Add all recipients
    this.getRecipients().forEach((r) => participants.add(r));

    return Array.from(participants).sort();
  }

  // ============= EXPIRATION METHODS =============

  isExpired(): boolean {
    if (this.permanent) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(this.expires_at);
    return now >= expiresAt;
  }

  // ============= METADATA and AUDIT METHODS =============

  // Check if message can be deleted (all read OR expired)
  canBeDeleted(): boolean {
    return this.isExpired() || this.isReadByAll();
  }

  // Get read percentage
  getReadPercentage(): number {
    return (this.read_by.length / this.recipients.length) * 100;
  }

  // Get time until expiration
  getTimeUntilExpiration(): number {
    const now = new Date();
    const expiresAt = new Date(this.expires_at);
    return Math.max(0, expiresAt.getTime() - now.getTime());
  }

  // ============= ACCESS CONTROL =============

  // Check if user can access this message
  canUserAccess(userPublicKey: MajikKeyAddress): boolean {
    if (!userPublicKey || typeof userPublicKey !== "string") {
      return false;
    }
    const trimmedId = userPublicKey.trim();
    return trimmedId === this.sender || this.recipients.includes(trimmedId);
  }

  // Check if user is sender
  isSender(userPublicKey: MajikKeyAddress): boolean {
    if (!userPublicKey || typeof userPublicKey !== "string") {
      return false;
    }
    return userPublicKey.trim() === this.sender;
  }

  // ============= RECIPIENT MANAGEMENT =============

  addRecipient(recipientId: MajikKeyAddress): void {
    if (
      !recipientId ||
      typeof recipientId !== "string" ||
      recipientId.trim() === ""
    ) {
      throw new Error("Invalid recipientId: must be a non-empty string");
    }

    const trimmedId = recipientId.trim();

    if (this.recipients.includes(trimmedId)) {
      throw new Error(`Recipient ${trimmedId} already exists`);
    }

    if (trimmedId === this.sender) {
      throw new Error("Cannot add sender as a recipient");
    }

    this.recipients.push(trimmedId);

    this.conversation_id = this.generateConversationID();
  }

  removeRecipient(recipientId: MajikKeyAddress): void {
    if (
      !recipientId ||
      typeof recipientId !== "string" ||
      recipientId.trim() === ""
    ) {
      throw new Error("Invalid recipientId: must be a non-empty string");
    }

    const trimmedId = recipientId.trim();
    const index = this.recipients.indexOf(trimmedId);

    if (index === -1) {
      throw new Error(`Recipient ${trimmedId} not found`);
    }

    this.recipients.splice(index, 1);

    // Also remove from read_by if they were there
    const readByIndex = this.read_by.indexOf(trimmedId);
    if (readByIndex !== -1) {
      this.read_by.splice(readByIndex, 1);
    }

    if (this.recipients.length === 0) {
      throw new Error(
        "Cannot remove last recipient: message must have at least one recipient",
      );
    }
    this.conversation_id = this.generateConversationID();
  }

  hasRecipient(recipientId: MajikKeyAddress): boolean {
    if (!recipientId || typeof recipientId !== "string") {
      return false;
    }
    return this.recipients.includes(recipientId.trim());
  }

  // ============= READER MANAGEMENT =============

  markAsRead(userPublicKey: MajikKeyAddress): boolean {
    if (
      !userPublicKey ||
      typeof userPublicKey !== "string" ||
      userPublicKey.trim() === ""
    ) {
      throw new Error("Invalid userPublicKey: must be a non-empty string");
    }

    const trimmedId = userPublicKey.trim();

    if (!this.recipients.includes(trimmedId)) {
      throw new Error(`User ${trimmedId} is not a recipient of this message`);
    }

    if (this.isExpired()) {
      throw new Error("Cannot mark expired message as read");
    }

    // Make idempotent - return false if already read
    if (this.read_by.includes(trimmedId)) {
      return false; // Already read, no change
    }

    this.read_by.push(trimmedId);
    return true; // Successfully marked as read
  }

  // Helper for batch marking as read
  static markMultipleAsRead(
    messages: MajikMessageChat[],
    userPublicKey: MajikKeyAddress,
  ): { updated: MajikMessageChat[]; unchanged: MajikMessageChat[] } {
    const updated: MajikMessageChat[] = [];
    const unchanged: MajikMessageChat[] = [];

    for (const message of messages) {
      try {
        const wasUpdated = message.markAsRead(userPublicKey);
        if (wasUpdated) {
          updated.push(message);
        } else {
          unchanged.push(message);
        }
      } catch (error) {
        // Skip messages where user isn't a recipient
        unchanged.push(message);
      }
    }

    return { updated, unchanged };
  }

  hasUserRead(userPublicKey: MajikKeyAddress): boolean {
    if (!userPublicKey || typeof userPublicKey !== "string") {
      return false;
    }
    return this.read_by.includes(userPublicKey.trim());
  }

  isReadByAll(): boolean {
    return (
      this.read_by.length === this.recipients.length &&
      this.recipients.every((recipient) => this.read_by.includes(recipient))
    );
  }

  getUnreadRecipients(): string[] {
    return this.recipients.filter(
      (recipient) => !this.read_by.includes(recipient),
    );
  }

  setTimestamp(date: Date = new Date()): void {
    this.timestamp = date.toISOString();
  }

  // ============= SERIALIZATION =============

  toJSON(): MajikMessageChatJSON {
    return {
      id: this.id,
      conversation_id: this.conversation_id,
      account: this.account,
      message: this.message,
      sender: this.sender,
      recipients: [...this.recipients],
      timestamp: this.timestamp,
      expires_at: this.expires_at,
      read_by: [...this.read_by],
      permanent: this.permanent,
    };
  }

  static fromJSON(json: string | MajikMessageChatJSON): MajikMessageChat {
    const rawParse: MajikMessageChatJSON =
      typeof json === "string" ? JSON.parse(json) : json;

    if (!this.isValidJSON(rawParse)) {
      throw new Error("Invalid JSON: missing required fields or invalid types");
    }

    return new MajikMessageChat(
      rawParse.id,
      rawParse.account,
      rawParse.message,
      rawParse.sender,
      rawParse.recipients || [],
      rawParse.timestamp,
      rawParse.expires_at,
      rawParse.read_by || [],
      rawParse?.conversation_id,
      rawParse?.permanent,
    );
  }

  // ============= REDIS METHODS =============
  getRedisKey(): RedisKey {
    return `majik_message:${this.conversation_id}:${this.id}`;
  }

  // Index: all messages in a conversation
  getRedisConversationIndexKey(): RedisKey {
    return `conv:${this.conversation_id}:msgs`;
  }

  // Index: all messages in a participant's inbox
  getRedisInboxIndexKey(publicKey: MajikKeyAddress): RedisKey {
    return `inbox:${publicKey}`;
  }

  getTTLUnixTimestamp(): number {
    const expiresAt = new Date(this.expires_at);
    return Math.floor(expiresAt.getTime() / 1000);
  }

  getTTLSeconds(): number {
    return Math.max(
      0,
      Math.floor((new Date(this.expires_at).getTime() - Date.now()) / 1000),
    );
  }

  toRedisPayload(): string {
    return JSON.stringify(this.toJSON());
  }

  // Clone method for updates
  clone(): MajikMessageChat {
    return MajikMessageChat.fromJSON(this.toJSON());
  }

  // ============= PRIVATE VALIDATION METHODS =============
  /**
   * Validates raw message length before compression.
   * Can be used without creating an instance.
   * @param message - Raw user input
   * @param bypassLengthCheck - Skip check if true (default: false)
   * @throws Error if message length exceeds MAX_MESSAGE_LENGTH
   */
  static validateRawMessageLength(
    message: string,
    bypassLengthCheck: boolean = false,
  ): void {
    if (!message || typeof message !== "string" || message.trim() === "") {
      throw new Error("Invalid message: must be a non-empty string");
    }

    if (!bypassLengthCheck && message.length > this.MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Raw message exceeds maximum allowed length of ${this.MAX_MESSAGE_LENGTH} characters. ` +
          `Current length: ${message.length}`,
      );
    }
  }
  private validateID(id: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("Invalid id: must be a non-empty string");
    }
  }

  private validateAccount(id: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("Invalid account ID: must be a non-empty string");
    }
  }

  private validateMessage(message: string): void {
    if (!message || typeof message !== "string" || message.trim() === "") {
      throw new Error("Invalid message: must be a non-empty string");
    }
  }

  private validateSender(sender: string): void {
    if (!sender || typeof sender !== "string" || sender.trim() === "") {
      throw new Error("Invalid sender: must be a non-empty string");
    }
  }

  private validateRecipients(recipients: string[]): void {
    if (!Array.isArray(recipients)) {
      throw new Error("Invalid recipients: must be an array");
    }

    if (recipients.length === 0) {
      throw new Error("Invalid recipients: must have at least one recipient");
    }

    for (const recipient of recipients) {
      if (
        !recipient ||
        typeof recipient !== "string" ||
        recipient.trim() === ""
      ) {
        throw new Error(
          "Invalid recipient: all recipients must be non-empty strings",
        );
      }
    }

    // Check for duplicates
    const uniqueRecipients = new Set(recipients);
    if (uniqueRecipients.size !== recipients.length) {
      throw new Error("Invalid recipients: duplicate recipients found");
    }
  }

  private validateTimestamp(timestamp: string): void {
    if (!timestamp || typeof timestamp !== "string") {
      throw new Error("Invalid timestamp: must be a string");
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid timestamp: must be a valid ISO string");
    }
  }

  private validateExpiresAt(expires_at: string, timestamp: string): void {
    if (!expires_at || typeof expires_at !== "string") {
      throw new Error("Invalid expires_at: must be a string");
    }

    const expiresDate = new Date(expires_at);
    if (isNaN(expiresDate.getTime())) {
      throw new Error("Invalid expires_at: must be a valid ISO string");
    }

    const timestampDate = new Date(timestamp);
    if (expiresDate <= timestampDate) {
      throw new Error("Invalid expires_at: must be after timestamp");
    }
  }

  private validateReadBy(read_by: string[], recipients: string[]): void {
    if (!Array.isArray(read_by)) {
      throw new Error("Invalid read_by: must be an array");
    }

    for (const reader of read_by) {
      if (!reader || typeof reader !== "string" || reader.trim() === "") {
        throw new Error(
          "Invalid read_by: all readers must be non-empty strings",
        );
      }

      if (!recipients.includes(reader)) {
        throw new Error(
          `Invalid read_by: reader ${reader} is not in recipients list`,
        );
      }
    }

    // Check for duplicates
    const uniqueReaders = new Set(read_by);
    if (uniqueReaders.size !== read_by.length) {
      throw new Error("Invalid read_by: duplicate readers found");
    }
  }

  // Add this static method
  static isValidJSON(json: any): json is MajikMessageChatJSON {
    return (
      json &&
      typeof json === "object" &&
      typeof json.id === "string" &&
      typeof json.message === "string" &&
      typeof json.sender === "string" &&
      Array.isArray(json.recipients) &&
      typeof json.timestamp === "string" &&
      typeof json.expires_at === "string" &&
      Array.isArray(json.read_by)
    );
  }

  static trimMessage(message: string): string {
    // Basic sanitization - adjust based on your needs
    return message.trim().slice(0, MAX_MESSAGE_SIZE);
  }
}
