import { v4 as uuidv4 } from "uuid";

import {
  ISODateString,
  MajikMessageAccountID,
  MajikMessageMailID,
  MajikMessagePublicKey,
  MajikMessageThreadID,
} from "../../../types";
import { sha256 } from "../../../crypto/crypto-provider";
import { MajikMessageIdentity } from "../../system/identity";

import { ThreadStatus } from "../enums";
import { MajikMessageThread } from "../majik-message-thread";
import { FileContext, MajikFile } from "@majikah/majik-file";

// ==================== Types & Interfaces ====================

export interface MailMetadata {
  subject?: string;
  attachments?: MailAttachmentRef[];
  priority?: "low" | "medium" | "high" | "urgent";
  labels?: string[];
  isForwarded?: boolean;
  isReply?: boolean;
}

export interface MajikMessageMailJSON {
  id: MajikMessageMailID;
  thread_id: MajikMessageThreadID;
  account: MajikMessageAccountID;
  message: string;
  sender: MajikMessagePublicKey;
  recipients: MajikMessagePublicKey[];
  timestamp: ISODateString;
  metadata: MailMetadata;
  hash: string;
  p_hash: string; // Previous hash (blockchain-like)
  previous_mail_id?: MajikMessageMailID;
  read_by: MajikMessagePublicKey[];
}

export interface MailAttachmentRef {
  /** MajikFile UUID — used to fetch the .mjkb from R2 via your file service */
  fileId: string;
  /** SHA-256 hex of original bytes — for dedup checks */
  fileHash: string;
  /** Original filename for display (e.g. "resume.pdf") */
  originalName: string | null;
  /** MIME type for icon/preview logic */
  mimeType: string | null;
  /** Original size in bytes — for "2.3 MB" display */
  sizeOriginal: number;
  /** R2 key — lets the Worker fetch directly without a DB lookup */
  r2Key: string;
  /** context from MajikFile — so the UI knows if it's a thread_attachment */
  context: FileContext;
}

// ==================== Custom Errors ====================

export class MajikMailError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "MajikMailError";
  }
}

export class MailValidationError extends MajikMailError {
  constructor(message: string) {
    super(message, "MAIL_VALIDATION_ERROR");
    this.name = "MailValidationError";
  }
}

export class MailOperationError extends MajikMailError {
  constructor(message: string) {
    super(message, "MAIL_OPERATION_ERROR");
    this.name = "MailOperationError";
  }
}

export class HashIntegrityError extends MajikMailError {
  constructor(message: string) {
    super(message, "HASH_INTEGRITY_ERROR");
    this.name = "HashIntegrityError";
  }
}

// ==================== Main Class ====================

export class MajikMessageMail {
  private readonly _id: MajikMessageMailID;
  private readonly _threadID: MajikMessageThreadID;
  private readonly _account: MajikMessageAccountID;
  private _message: string; // Compressed message
  private readonly _sender: MajikMessagePublicKey;
  private _recipients: MajikMessagePublicKey[];
  private readonly _timestamp: Date;
  private _metadata: MailMetadata;
  private readonly _hash: string; // Current item hash
  private readonly _p_hash: string; // Previous hash (blockchain link)
  private readonly _previousMailID?: MajikMessageMailID;
  private _readBy: MajikMessagePublicKey[];

  // Maximum allowed length for the raw message
  private static readonly MAX_MESSAGE_LENGTH = 100000;

  // ==================== Private Constructor ====================

  private constructor(
    id: MajikMessageMailID,
    threadID: MajikMessageThreadID,
    account: MajikMessageAccountID,
    message: string,
    sender: MajikMessagePublicKey,
    recipients: MajikMessagePublicKey[],
    timestamp: Date,
    metadata: MailMetadata,
    hash: string,
    p_hash: string,
    previousMailID?: MajikMessageMailID,
    readBy: MajikMessagePublicKey[] = [],
    bypassValidation: boolean = false,
  ) {
    this._id = id;
    this._threadID = threadID;
    this._account = account;
    this._message = message;
    this._sender = sender;
    this._recipients = [...recipients];
    this._timestamp = timestamp;
    this._metadata = { ...metadata };
    this._hash = hash;
    this._p_hash = p_hash;
    this._previousMailID = previousMailID;
    this._readBy = [...readBy];

    if (!bypassValidation) {
      // Validate on construction
      this.validate();
    }
  }

  // ==================== Getters ====================

  get id(): MajikMessageMailID {
    return this._id;
  }

  get threadID(): MajikMessageThreadID {
    return this._threadID;
  }

  get account(): MajikMessageAccountID {
    return this._account;
  }

  get sender(): MajikMessagePublicKey {
    return this._sender;
  }

  get recipients(): readonly MajikMessagePublicKey[] {
    return [...this._recipients];
  }

  get participants(): readonly MajikMessagePublicKey[] {
    return [...this._recipients, this._sender];
  }

  get timestamp(): Date {
    return new Date(this._timestamp);
  }

  get metadata(): Readonly<MailMetadata> {
    return { ...this._metadata };
  }

  get hash(): string {
    return this._hash;
  }

  get p_hash(): string {
    return this._p_hash;
  }

  get previousMailID(): MajikMessageMailID | undefined {
    return this._previousMailID;
  }

  get readBy(): readonly MajikMessagePublicKey[] {
    return [...this._readBy];
  }

  get message(): string {
    return this._message;
  }

  // ==================== Static Create Method ====================

  /**
   * Creates the first mail item in a thread.
   * Uses the thread's hash as the p_hash since this is the first item.
   *
   * @param thread - The MajikMessageThread this mail belongs to
   * @param identity - The sender's MajikMessageIdentity
   * @param message - Plain text message (encrypted)
   * @param recipients - Array of recipient public keys (excluding sender)
   * @param metadata - Optional mail metadata
   * @param id - Optional ID to use
   * @returns Promise resolving to new MajikMessageMail instance
   * @throws Error if validation fails or thread is closed
   */
  public static async create(
    thread: MajikMessageThread,
    identity: MajikMessageIdentity,
    message: string,
    recipients: MajikMessagePublicKey[],
    metadata: MailMetadata = {},
    id?: MajikMessageMailID,
  ): Promise<MajikMessageMail> {
    try {
      // Validate thread
      if (!thread) {
        throw new MailValidationError("Thread is required");
      }

      // Validate thread is not closed or marked for deletion
      if (thread.status === ThreadStatus.CLOSED) {
        throw new MailOperationError("Cannot create mail in a closed thread");
      }

      if (thread.status === ThreadStatus.MARKED_FOR_DELETION) {
        throw new MailOperationError(
          "Cannot create mail in a thread marked for deletion",
        );
      }

      // Validate thread integrity
      thread.validate();

      // Validate identity
      if (!identity) {
        throw new MailValidationError("Identity is required");
      }

      if (!identity.validateIntegrity()) {
        throw new MailValidationError("Identity integrity check failed");
      }

      if (identity.isRestricted()) {
        throw new MailOperationError(
          "This account is restricted and cannot send mail",
        );
      }

      const accountID = identity.id;
      const senderPublicKey = identity.publicKey;

      // Validate sender is a participant in the thread
      if (!thread.isParticipant(senderPublicKey)) {
        throw new MailOperationError(
          "Sender must be a participant in the thread",
        );
      }

      // Validate message
      if (!message || typeof message !== "string" || message.trim() === "") {
        throw new MailValidationError("Message must be a non-empty string");
      }

      // Validate raw message length
      this.validateRawMessageLength(message);

      // Validate recipients
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new MailValidationError("Recipients must be a non-empty array");
      }

      // Validate recipients are unique
      const uniqueRecipients = new Set(recipients);
      if (uniqueRecipients.size !== recipients.length) {
        throw new MailValidationError("Duplicate recipients found");
      }

      // Validate sender is not in recipients
      if (recipients.includes(senderPublicKey)) {
        throw new MailValidationError(
          "Sender cannot be included in recipients list",
        );
      }

      // Validate all recipients are participants in the thread
      for (const recipient of recipients) {
        if (!thread.isParticipant(recipient)) {
          throw new MailValidationError(
            `Recipient ${recipient} is not a participant in the thread`,
          );
        }
      }

      // Normalize recipients (sort for consistency)
      const normalizedRecipients = [...recipients].sort();

      // Generate ID and timestamp
      const generatedID = uuidv4();
      const finalID = id || generatedID;
      const timestamp = new Date();

      // Generate hash for this mail item
      const hash = this.generateHash(
        finalID,
        message.trim(),
        senderPublicKey,
        normalizedRecipients,
        timestamp,
      );

      // For the first item, p_hash is the thread's hash
      const p_hash = this.generatePHash(hash, thread.hash);

      // Mark as reply metadata
      const finalMetadata: MailMetadata = {
        ...metadata,
        isReply: false,
      };

      return new MajikMessageMail(
        finalID,
        thread.id,
        accountID,
        message.trim(),
        senderPublicKey,
        normalizedRecipients,
        timestamp,
        finalMetadata,
        hash,
        p_hash,
        undefined, // No previous mail ID for first item
        [],
      );
    } catch (error) {
      if (error instanceof MajikMailError) {
        throw error;
      }
      throw new MailOperationError(
        `Failed to create mail: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  // ==================== Static Reply Method ====================

  /**
   * Creates a reply to an existing mail item in the thread.
   * Uses the previous mail's hash as part of the p_hash.
   *
   * @param thread - The MajikMessageThread this mail belongs to
   * @param previousMail - The mail being replied to
   * @param identity - The sender's MajikMessageIdentity
   * @param message - Plain text message (encrypted)
   * @param recipients - Array of recipient public keys (excluding sender)
   * @param metadata - Optional mail metadata
   * @param id - Optional ID to use
   * @returns Promise resolving to new MajikMessageMail instance
   * @throws Error if validation fails or thread is closed
   */
  public static async reply(
    thread: MajikMessageThread,
    previousMail: MajikMessageMail,
    identity: MajikMessageIdentity,
    message: string,
    recipients: MajikMessagePublicKey[],
    metadata: MailMetadata = {},
    id?: MajikMessageMailID,
  ): Promise<MajikMessageMail> {
    try {
      // Validate thread
      if (!thread) {
        throw new MailValidationError("Thread is required");
      }

      // Validate thread is not closed or marked for deletion
      if (thread.status === ThreadStatus.CLOSED) {
        throw new MailOperationError("Cannot reply in a closed thread");
      }

      if (thread.status === ThreadStatus.MARKED_FOR_DELETION) {
        throw new MailOperationError(
          "Cannot reply in a thread marked for deletion",
        );
      }

      // Validate thread integrity
      thread.validate();

      // Validate previous mail
      if (!previousMail) {
        throw new MailValidationError("Previous mail is required for reply");
      }

      // Validate previous mail integrity
      previousMail.validate();

      // Verify previous mail belongs to the same thread
      if (previousMail.threadID !== thread.id) {
        throw new MailValidationError(
          "Previous mail does not belong to the specified thread",
        );
      }

      // Validate identity
      if (!identity) {
        throw new MailValidationError("Identity is required");
      }

      if (!identity.validateIntegrity()) {
        throw new MailValidationError("Identity integrity check failed");
      }

      if (identity.isRestricted()) {
        throw new MailOperationError(
          "This account is restricted and cannot send mail",
        );
      }

      const accountID = identity.id;
      const senderPublicKey = identity.publicKey;

      // Validate sender is a participant in the thread
      if (!thread.isParticipant(senderPublicKey)) {
        throw new MailOperationError(
          "Sender must be a participant in the thread",
        );
      }

      // Validate message
      if (!message || typeof message !== "string" || message.trim() === "") {
        throw new MailValidationError("Message must be a non-empty string");
      }

      // Validate raw message length
      this.validateRawMessageLength(message);

      // Validate recipients
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new MailValidationError("Recipients must be a non-empty array");
      }

      // Validate recipients are unique
      const uniqueRecipients = new Set(recipients);
      if (uniqueRecipients.size !== recipients.length) {
        throw new MailValidationError("Duplicate recipients found");
      }

      // Validate sender is not in recipients
      if (recipients.includes(senderPublicKey)) {
        throw new MailValidationError(
          "Sender cannot be included in recipients list",
        );
      }

      // Validate all recipients are participants in the thread
      for (const recipient of recipients) {
        if (!thread.isParticipant(recipient)) {
          throw new MailValidationError(
            `Recipient ${recipient} is not a participant in the thread`,
          );
        }
      }

      // Normalize recipients (sort for consistency)
      const normalizedRecipients = [...recipients].sort();

      // Generate ID and timestamp
      const generatedID = uuidv4();
      const finalID = id || generatedID;
      const timestamp = new Date();

      // Generate hash for this mail item
      const hash = this.generateHash(
        finalID,
        message.trim(),
        senderPublicKey,
        normalizedRecipients,
        timestamp,
      );

      // For replies, p_hash links to previous mail's hash
      const p_hash = this.generatePHash(hash, previousMail.hash);

      // Mark as reply in metadata
      const finalMetadata: MailMetadata = {
        ...metadata,
        isReply: true,
      };

      return new MajikMessageMail(
        finalID,
        thread.id,
        accountID,
        message.trim(),
        senderPublicKey,
        normalizedRecipients,
        timestamp,
        finalMetadata,
        hash,
        p_hash,
        previousMail.id,
        [],
      );
    } catch (error) {
      if (error instanceof MajikMailError) {
        throw error;
      }
      throw new MailOperationError(
        `Failed to create reply: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  // In MajikMessageMail

  /**
   * Attach a MajikFile to this mail.
   * Automatically wires thread_id and thread_message_id from the instance.
   *
   * @throws MailValidationError if the file context is not "thread_attachment"
   * @throws MailOperationError if this file is already attached (by fileId or fileHash)
   */
  attachFile(file: MajikFile): MailAttachmentRef {
    // Enforce context — only thread attachments belong on mail
    if (file.context !== "thread_attachment") {
      throw new MailValidationError(
        `attachFile: file must have context "thread_attachment" (got "${file.context}")`,
      );
    }

    const existing = (this._metadata.attachments ?? []) as MailAttachmentRef[];

    // Guard: duplicate by fileId
    if (existing.some((a) => a.fileId === file.id)) {
      throw new MailOperationError(
        `attachFile: file "${file.id}" is already attached to this mail`,
      );
    }

    // Guard: duplicate by content hash (same file re-encrypted)
    if (existing.some((a) => a.fileHash === file.fileHash)) {
      throw new MailOperationError(
        `attachFile: a file with hash "${file.fileHash.slice(0, 8)}…" is already attached`,
      );
    }

    // Wire thread context onto the file if not already bound.
    // bindToThreadMail is a no-op guard — it throws if already set,
    // so we only call it when both IDs are missing.
    if (!file.threadId && !file.threadMessageId) {
      file.bindToThreadMail(this._threadID, this._id);
    } else if (
      file.threadId !== this._threadID ||
      file.threadMessageId !== this._id
    ) {
      // File was pre-bound to a DIFFERENT mail/thread — that's a real error
      throw new MailOperationError(
        `attachFile: file "${file.id}" is already bound to a different thread/mail`,
      );
    }

    const ref: MailAttachmentRef = {
      fileId: file.id,
      fileHash: file.fileHash,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeOriginal: file.sizeOriginal,
      r2Key: file.r2Key,
      context: file.context!,
    };

    this._metadata = {
      ...this._metadata,
      attachments: [...existing, ref],
    };

    return ref;
  }

  /**
   * Remove an attached file by fileId.
   * Returns true if removed, false if it wasn't attached.
   */
  detachFile(fileId: string): boolean {
    const existing = (this._metadata.attachments ?? []) as MailAttachmentRef[];
    const filtered = existing.filter((a) => a.fileId !== fileId);
    if (filtered.length === existing.length) return false;
    this._metadata = { ...this._metadata, attachments: filtered };
    return true;
  }

  /** Returns all attachment refs on this mail, typed correctly. */
  get attachments(): MailAttachmentRef[] {
    return [...((this._metadata.attachments ?? []) as MailAttachmentRef[])];
  }

  /** Returns true if this mail has at least one attachment. */
  get hasAttachments(): boolean {
    return (
      ((this._metadata.attachments ?? []) as MailAttachmentRef[]).length > 0
    );
  }

  /** Returns the attachment ref for a given fileId, or null if not found. */
  getAttachment(fileId: string): MailAttachmentRef | null {
    return (
      ((this._metadata.attachments ?? []) as MailAttachmentRef[]).find(
        (a) => a.fileId === fileId,
      ) ?? null
    );
  }

  // ==================== Hash Generation Methods ====================

  /**
   * Generates the hash for the current mail item.
   * Format: SHA256(id:message:sender:recipients:timestamp)
   */
  private static generateHash(
    id: MajikMessageMailID,
    message: string,
    sender: MajikMessagePublicKey,
    recipients: MajikMessagePublicKey[],
    timestamp: Date,
  ): string {
    const recipientsStr = recipients.join(",");
    const dataString = `${id}:${message}:${sender}:${recipientsStr}:${timestamp.toISOString()}`;
    return sha256(dataString);
  }

  /**
   * Generates the previous hash (blockchain link).
   * Format: SHA256(currentHash:previousHash)
   */
  private static generatePHash(
    currentHash: string,
    previousHash: string,
  ): string {
    const dataString = `${currentHash}:${previousHash}`;
    return sha256(dataString);
  }

  // ==================== Validation Methods ====================

  /**
   * Validates the current mail item's integrity.
   * Checks hash and p_hash validity.
   */
  public validate(): boolean {
    try {
      // Validate ID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(this._id)) {
        throw new MailValidationError("Invalid UUID v4 format for id");
      }

      // Validate thread ID
      if (!uuidRegex.test(this._threadID)) {
        throw new MailValidationError("Invalid UUID v4 format for thread_id");
      }

      // Validate account ID
      if (
        !this._account ||
        typeof this._account !== "string" ||
        this._account.trim().length === 0
      ) {
        throw new MailValidationError(
          "Account ID is required and must be a non-empty string",
        );
      }

      // Validate message
      if (
        !this._message ||
        typeof this._message !== "string" ||
        this._message.trim().length === 0
      ) {
        throw new MailValidationError(
          "Message is required and must be a non-empty string",
        );
      }

      // Validate sender
      if (
        !this._sender ||
        typeof this._sender !== "string" ||
        this._sender.trim().length === 0
      ) {
        throw new MailValidationError(
          "Sender is required and must be a non-empty string",
        );
      }

      // Validate recipients
      if (!Array.isArray(this._recipients) || this._recipients.length === 0) {
        throw new MailValidationError("Recipients must be a non-empty array");
      }

      // Validate sender is not in recipients
      if (this._recipients.includes(this._sender)) {
        throw new MailValidationError("Sender cannot be in recipients list");
      }

      // Validate timestamp
      if (
        !(this._timestamp instanceof Date) ||
        isNaN(this._timestamp.getTime())
      ) {
        throw new MailValidationError("Timestamp must be a valid Date object");
      }

      // Validate hash
      if (!this._hash || typeof this._hash !== "string") {
        throw new MailValidationError("Hash is required and must be a string");
      }

      // Validate p_hash
      if (!this._p_hash || typeof this._p_hash !== "string") {
        throw new MailValidationError(
          "Previous hash (p_hash) is required and must be a string",
        );
      }

      // Verify hash integrity
      const expectedHash = MajikMessageMail.generateHash(
        this._id,
        this._message,
        this._sender,
        this._recipients,
        this._timestamp,
      );

      if (this._hash !== expectedHash) {
        throw new HashIntegrityError(
          "Hash mismatch - mail item integrity compromised",
        );
      }

      // Validate read_by
      if (!Array.isArray(this._readBy)) {
        throw new MailValidationError("read_by must be an array");
      }

      // Validate all readers are recipients
      for (const reader of this._readBy) {
        if (!this._recipients.includes(reader)) {
          throw new MailValidationError(
            `Reader ${reader} is not in recipients list`,
          );
        }
      }

      // Check for duplicate readers
      const uniqueReaders = new Set(this._readBy);
      if (uniqueReaders.size !== this._readBy.length) {
        throw new MailValidationError("Duplicate readers found in read_by");
      }

      return true;
    } catch (error) {
      if (error instanceof MajikMailError) {
        throw error;
      }
      throw new MailValidationError(
        `Validation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Validates the p_hash against a previous hash.
   * Used to verify blockchain integrity.
   *
   * @param previousHash - The hash from the previous item (or thread hash for first item)
   * @returns true if p_hash is valid
   */
  public validatePHash(previousHash: string): boolean {
    try {
      if (!previousHash || typeof previousHash !== "string") {
        throw new MailValidationError(
          "Previous hash must be a non-empty string",
        );
      }

      const expectedPHash = MajikMessageMail.generatePHash(
        this._hash,
        previousHash,
      );

      if (this._p_hash !== expectedPHash) {
        throw new HashIntegrityError(
          "Previous hash (p_hash) mismatch - blockchain integrity compromised",
        );
      }

      return true;
    } catch (error) {
      if (error instanceof MajikMailError) {
        throw error;
      }
      throw new MailValidationError(
        `p_hash validation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  // ==================== Static Blockchain Validation ====================

  /**
   * Validates an entire chain of mail items in a thread.
   * Verifies both hash and p_hash integrity for all items.
   *
   * @param thread - The thread these mail items belong to
   * @param mailItems - Array of mail items ordered chronologically (oldest first)
   * @returns Validation result with details
   */
  public static validateMailChain(
    thread: MajikMessageThread,
    mailItems: MajikMessageMail[],
  ): {
    isValid: boolean;
    errors: string[];
    tamperedItems: string[];
  } {
    const errors: string[] = [];
    const tamperedItems: string[] = [];

    try {
      // Validate thread
      if (!thread) {
        errors.push("Thread is required");
        return { isValid: false, errors, tamperedItems };
      }

      // Validate thread integrity
      try {
        thread.validate();
      } catch (error) {
        errors.push(
          `Thread validation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
        return { isValid: false, errors, tamperedItems };
      }

      // Validate mail items array
      if (!Array.isArray(mailItems)) {
        errors.push("Mail items must be an array");
        return { isValid: false, errors, tamperedItems };
      }

      if (mailItems.length === 0) {
        // Empty chain is valid
        return { isValid: true, errors: [], tamperedItems: [] };
      }

      // Validate each mail item individually first
      for (let i = 0; i < mailItems.length; i++) {
        const mail = mailItems[i];

        try {
          mail.validate();
        } catch (error) {
          errors.push(
            `Mail item ${i} (${mail.id}) validation failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
          tamperedItems.push(mail.id);
        }

        // Verify mail belongs to the thread
        if (mail.threadID !== thread.id) {
          errors.push(
            `Mail item ${i} (${mail.id}) does not belong to thread ${thread.id}`,
          );
          tamperedItems.push(mail.id);
        }
      }

      // Validate blockchain linkage
      for (let i = 0; i < mailItems.length; i++) {
        const currentMail = mailItems[i];
        let previousHash: string;

        if (i === 0) {
          // First item should link to thread hash
          previousHash = thread.hash;

          // Verify previousMailID is undefined for first item
          if (!!currentMail.previousMailID?.trim()) {
            errors.push(
              `First mail item (${currentMail.id}) should not have a previousMailID`,
            );
            tamperedItems.push(currentMail.id);
          }
        } else {
          // Subsequent items should link to previous mail's hash
          const previousMail = mailItems[i - 1];
          previousHash = previousMail.hash;

          // Verify previousMailID matches
          if (currentMail.previousMailID !== previousMail.id) {
            errors.push(
              `Mail item ${i} (${currentMail.id}) previousMailID mismatch. ` +
                `Expected: ${previousMail.id}, Got: ${currentMail.previousMailID}`,
            );
            tamperedItems.push(currentMail.id);
          }
        }

        // Validate p_hash linkage
        try {
          currentMail.validatePHash(previousHash);
        } catch (error) {
          errors.push(
            `Mail item ${i} (${currentMail.id}) p_hash validation failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
          tamperedItems.push(currentMail.id);
        }
      }

      const isValid = errors.length === 0 && tamperedItems.length === 0;

      return {
        isValid,
        errors,
        tamperedItems: Array.from(new Set(tamperedItems)), // Remove duplicates
      };
    } catch (error) {
      errors.push(
        `Chain validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      return { isValid: false, errors, tamperedItems };
    }
  }

  // ==================== Reader Management ====================

  /**
   * Marks this mail as read by a recipient.
   * @param recipientPublicKey - The public key of the recipient marking as read
   * @returns true if successfully marked, false if already read
   */
  public markAsRead(recipientPublicKey: MajikMessagePublicKey): boolean {
    try {
      if (
        !recipientPublicKey ||
        typeof recipientPublicKey !== "string" ||
        recipientPublicKey.trim() === ""
      ) {
        throw new MailValidationError(
          "Recipient public key must be a non-empty string",
        );
      }

      const trimmedKey = recipientPublicKey.trim();

      // Verify recipient is in recipients list
      if (!this._recipients.includes(trimmedKey)) {
        throw new MailOperationError(
          `User ${trimmedKey} is not a recipient of this mail`,
        );
      }

      // Check if already read (idempotent)
      if (this._readBy.includes(trimmedKey)) {
        return false; // Already read
      }

      this._readBy.push(trimmedKey);
      return true; // Successfully marked as read
    } catch (error) {
      if (error instanceof MajikMailError) {
        throw error;
      }
      throw new MailOperationError(
        `Failed to mark as read: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Marks this mail as unread by removing a recipient from the read_by list.
   * @param recipientPublicKey - The public key of the recipient marking as unread
   * @returns true if successfully unmarked, false if wasn't read
   */
  public markAsUnread(recipientPublicKey: MajikMessagePublicKey): boolean {
    try {
      if (
        !recipientPublicKey ||
        typeof recipientPublicKey !== "string" ||
        recipientPublicKey.trim() === ""
      ) {
        throw new MailValidationError(
          "Recipient public key must be a non-empty string",
        );
      }

      const trimmedKey = recipientPublicKey.trim();

      // Verify recipient is in recipients list
      if (!this._recipients.includes(trimmedKey)) {
        throw new MailOperationError(
          `User ${trimmedKey} is not a recipient of this mail`,
        );
      }

      // Check if not in read_by list (idempotent)
      const readIndex = this._readBy.indexOf(trimmedKey);
      if (readIndex === -1) {
        return false; // Already unread
      }

      // Remove from read_by array
      this._readBy.splice(readIndex, 1);
      return true; // Successfully marked as unread
    } catch (error) {
      if (error instanceof MajikMailError) {
        throw error;
      }
      throw new MailOperationError(
        `Failed to mark as unread: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Checks if a specific user has read this mail.
   */
  public hasUserRead(recipientPublicKey: MajikMessagePublicKey): boolean {
    if (!recipientPublicKey || typeof recipientPublicKey !== "string") {
      return false;
    }
    return this._readBy.includes(recipientPublicKey.trim());
  }

  /**
   * Checks if all recipients have read this mail.
   */
  public isReadByAll(): boolean {
    return (
      this._readBy.length === this._recipients.length &&
      this._recipients.every((recipient) => this._readBy.includes(recipient))
    );
  }

  /**
   * Gets the list of recipients who haven't read this mail yet.
   */
  public getUnreadRecipients(): MajikMessagePublicKey[] {
    return this._recipients.filter(
      (recipient) => !this._readBy.includes(recipient),
    );
  }

  /**
   * Gets the read percentage.
   */
  public getReadPercentage(): number {
    if (this._recipients.length === 0) {
      return 100;
    }
    return (this._readBy.length / this._recipients.length) * 100;
  }

  // ==================== Access Control ====================

  /**
   * Checks if a user can access this mail (is sender or recipient).
   */
  public canUserAccess(userPublicKey: MajikMessagePublicKey): boolean {
    if (!userPublicKey || typeof userPublicKey !== "string") {
      return false;
    }
    const trimmedKey = userPublicKey.trim();
    return trimmedKey === this._sender || this._recipients.includes(trimmedKey);
  }

  /**
   * Checks if a user is the sender of this mail.
   */
  public isSender(userPublicKey: MajikMessagePublicKey): boolean {
    if (!userPublicKey || typeof userPublicKey !== "string") {
      return false;
    }
    return userPublicKey.trim() === this._sender;
  }

  /**
   * Checks if a user is a recipient of this mail.
   */
  public isRecipient(userPublicKey: MajikMessagePublicKey): boolean {
    if (!userPublicKey || typeof userPublicKey !== "string") {
      return false;
    }
    return this._recipients.includes(userPublicKey.trim());
  }

  // ==================== Metadata Management ====================

  /**
   * Updates the metadata for this mail.
   */
  public updateMetadata(metadata: Partial<MailMetadata>): void {
    try {
      this._metadata = {
        ...this._metadata,
        ...metadata,
      };
    } catch (error) {
      throw new MailOperationError(
        `Failed to update metadata: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  // ==================== Serialization ====================

  public toJSON(): MajikMessageMailJSON {
    return {
      id: this._id,
      thread_id: this._threadID,
      account: this._account,
      message: this._message,
      sender: this._sender,
      recipients: [...this._recipients],
      timestamp: this._timestamp.toISOString(),
      metadata: { ...this._metadata },
      hash: this._hash,
      p_hash: this._p_hash,
      previous_mail_id: this._previousMailID,
      read_by: [...this._readBy],
    };
  }

  public static fromJSON(
    json: MajikMessageMailJSON | string,
    bypassValidation: boolean = false,
  ): MajikMessageMail {
    try {
      const data: MajikMessageMailJSON =
        typeof json === "string" ? JSON.parse(json) : json;

      // Validate required fields
      if (!this.isValidJSON(data)) {
        throw new MailValidationError(
          "Invalid JSON: missing required fields or invalid types",
        );
      }

      if (data.metadata?.attachments !== undefined) {
        if (!Array.isArray(data.metadata.attachments)) {
          throw new MailValidationError(
            "Invalid JSON: metadata.attachments must be an array",
          );
        }
        for (let i = 0; i < data.metadata.attachments.length; i++) {
          if (
            !MajikMessageMail.isValidAttachmentRef(data.metadata.attachments[i])
          ) {
            throw new MailValidationError(
              `Invalid JSON: metadata.attachments[${i}] is not a valid MailAttachmentRef`,
            );
          }
        }
      }

      // Parse timestamp
      const timestamp = new Date(data.timestamp);
      if (isNaN(timestamp.getTime())) {
        throw new MailValidationError("Invalid timestamp in JSON data");
      }

      return new MajikMessageMail(
        data.id,
        data.thread_id,
        data.account,
        data.message,
        data.sender,
        data.recipients,
        timestamp,
        data.metadata || {},
        data.hash,
        data.p_hash,
        data.previous_mail_id,
        data.read_by || [],
        bypassValidation,
      );
    } catch (error) {
      if (error instanceof MajikMailError) {
        throw error;
      }
      throw new MailOperationError(
        `Failed to parse JSON: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  // ==================== Utility Methods ====================

  public toString(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  public clone(): MajikMessageMail {
    return MajikMessageMail.fromJSON(this.toJSON());
  }

  // ==================== Private Validation Methods ====================

  /**
   * Validates raw message length
   */
  private static validateRawMessageLength(message: string): void {
    if (!message || typeof message !== "string" || message.trim() === "") {
      throw new MailValidationError("Message must be a non-empty string");
    }

    if (message.length > this.MAX_MESSAGE_LENGTH) {
      throw new MailValidationError(
        `Raw message exceeds maximum allowed length of ${this.MAX_MESSAGE_LENGTH} characters. ` +
          `Current length: ${message.length}`,
      );
    }
  }

  private static isValidAttachmentRef(a: any): a is MailAttachmentRef {
    return (
      a &&
      typeof a === "object" &&
      typeof a.fileId === "string" &&
      typeof a.fileHash === "string" &&
      typeof a.r2Key === "string" &&
      typeof a.sizeOriginal === "number" &&
      (a.originalName === null || typeof a.originalName === "string") &&
      (a.mimeType === null || typeof a.mimeType === "string") &&
      typeof a.context === "string"
    );
  }

  private static isValidJSON(json: any): json is MajikMessageMailJSON {
    return (
      json &&
      typeof json === "object" &&
      typeof json.id === "string" &&
      typeof json.thread_id === "string" &&
      typeof json.account === "string" &&
      typeof json.message === "string" &&
      typeof json.sender === "string" &&
      Array.isArray(json.recipients) &&
      typeof json.timestamp === "string" &&
      typeof json.hash === "string" &&
      typeof json.p_hash === "string" &&
      Array.isArray(json.read_by)
    );
  }
}
