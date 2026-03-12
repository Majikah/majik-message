import { v4 as uuidv4 } from "uuid";

import { ThreadStatus } from "./enums";
import {
  ISODateString,
  MajikMessageAccountID,
  MajikMessagePublicKey,
  MajikMessageThreadID,
} from "../../types";
import { MajikUserID } from "@thezelijah/majik-user";
import { sha256, sha512 } from "../../crypto/crypto-provider";
import {
  MajikMessageMail,
  MajikMessageMailJSON,
} from "./mail/majik-message-mail";
import { MajikMessageIdentity } from "../system/identity";

// ==================== Types & Interfaces ====================

export interface ThreadMetadata {
  title?: string;
  subject?: string;
  tags?: string[];
  category?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  lastActivity?: ISODateString;
  messageCount?: number;
}

export interface DeletionApproval {
  publicKey: MajikMessagePublicKey;
  approvalHash: string;
  timestamp: Date;
}

export interface MajikMessageThreadAnalytics {
  threadID: MajikMessageThreadID;
  owner: MajikMessageAccountID;
  userID: MajikUserID;
  participantCount: number;
  messageCount: number;
  status: ThreadStatus;
  createdAt: string;
  lastActivity: string | undefined;
  duration: number; // Duration in milliseconds
  tags: string[];
  category: string | undefined;
  priority: string | undefined;
  starred: boolean;
  deletionStatus: {
    isPendingDeletion: boolean;
    isMarkedForDeletion: boolean;
    approvalProgress: number; // Percentage
    approvedCount: number;
    totalParticipants: number;
  };
}

export interface MajikMessageThreadSummary {
  id: MajikMessageThreadID;
  participants: MajikMessagePublicKey[];
  participant_count: number;
  latest_message: MajikMessageMailJSON | null;
  latest_message_timestamp: ISODateString | null;
  total_messages: number;
  unread_count: number;
  has_unread: boolean;
  starred: boolean;
  subject?: string;
  status: ThreadStatus;
  deletion_requested: boolean;
}

export interface MajikMessageThreadJSON {
  id: MajikMessageThreadID;
  user_id: MajikUserID;
  owner: MajikMessageAccountID;
  metadata: ThreadMetadata;
  timestamp: ISODateString;
  participants: string[];
  status: ThreadStatus;
  hash: string;
  // ── Thread hash ──────────────────────────────────────────────────────────────
  // SHA3-512 over the joined string:
  //   "<thread.hash>:<mail[0].hash>:<mail[1].hash>:…:<thread.id>"
  // where mails are sorted by timestamp ascending.
  // null until generateThreadHash() has been called.
  t_hash: string | null;
  deletion_approvals: DeletionApproval[];
  starred: boolean;
}

export interface MajikMessageThreadExport {
  thread: MajikMessageThreadJSON;
  messages: MajikMessageMailJSON[];
  exported_at: ISODateString;
  message_count: number;
}

/**
 * Result shape returned by MajikMessageThread.auditThread().
 * isValid is true only when ALL three checks pass.
 */
export interface ThreadAuditResult {
  isValid: boolean;
  threadValid: boolean; // structural validate() passed
  chainValid: boolean; // MajikMessageMail.validateMailChain() passed
  hashValid: boolean; // verifyThreadHash() passed (false if t_hash not yet set)
  errors: string[];
  tamperedMailIDs: string[]; // mail IDs flagged by chain validation
}

// ==================== Custom Errors ====================

export class MajikThreadError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "MajikThreadError";
  }
}

export class ValidationError extends MajikThreadError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class OperationNotAllowedError extends MajikThreadError {
  constructor(message: string) {
    super(message, "OPERATION_NOT_ALLOWED");
    this.name = "OperationNotAllowedError";
  }
}

/**
 * Sorts an array of MajikMessageMailJSON by timestamp (oldest → newest).
 * Returns a new array — does not mutate the input.
 */
function sortMailsByTimestamp(
  mails: MajikMessageMailJSON[],
): MajikMessageMailJSON[] {
  return [...mails].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

/**
 * Joins an array of strings with ":" as the delimiter.
 *
 * joinWithColon(["abc", "def", "ghi"]) → "abc:def:ghi"
 */
function joinWithColon(parts: string[]): string {
  return parts.join(":");
}

/**
 * Builds the raw string fed into SHA3-512 for t_hash.
 *
 * Layout:  <thread.hash> : <mail[0].hash> : … : <mail[n].hash> : <thread.id>
 *
 * @param threadHash   - The thread's own SHA-256 hash
 * @param threadID     - The thread's UUID
 * @param sortedMails  - Messages pre-sorted by timestamp ascending
 */
function buildThreadHashInput(
  threadHash: string,
  threadID: string,
  sortedMails: MajikMessageMailJSON[],
): string {
  const parts: string[] = [
    threadHash,
    ...sortedMails.map((m) => m.hash),
    threadID,
  ];
  return joinWithColon(parts);
}

// ==================== Main Class ====================

export class MajikMessageThread {
  private readonly _id: MajikMessageThreadID;
  private readonly _userID: MajikUserID;
  private readonly _owner: MajikMessageAccountID; // Owner's identity account ID
  private _metadata: ThreadMetadata;
  private readonly _timestamp: Date;
  private readonly _participants: MajikMessagePublicKey[];
  private _status: ThreadStatus;
  private readonly _hash: string;
  private _thash: string | null;
  private _deletionApprovals: DeletionApproval[];
  private _starred: boolean;

  // ==================== Private Constructor ====================

  private constructor(
    id: MajikMessageThreadID,
    userID: MajikUserID,
    owner: MajikMessageAccountID,
    metadata: ThreadMetadata,
    timestamp: Date,
    participants: string[],
    status: ThreadStatus,
    hash: string,
    deletionApprovals: DeletionApproval[] = [],
    starred: boolean = false,
    thash: string | null = null,
  ) {
    this._id = id;
    this._userID = userID;
    this._owner = owner;
    this._metadata = metadata;
    this._timestamp = timestamp;
    this._participants = participants;
    this._status = status;
    this._hash = hash;
    this._thash = thash;
    this._deletionApprovals = deletionApprovals;
    this._starred = starred;

    // Validate on construction
    this.validate();
  }

  // ==================== Getters ====================

  get id(): MajikMessageThreadID {
    return this._id;
  }

  get userID(): MajikUserID {
    return this._userID;
  }

  get owner(): MajikMessageAccountID {
    return this._owner;
  }

  get metadata(): Readonly<ThreadMetadata> {
    return { ...this._metadata };
  }

  get timestamp(): Date {
    return new Date(this._timestamp);
  }

  get participants(): readonly MajikMessagePublicKey[] {
    return [...this._participants];
  }

  get status(): ThreadStatus {
    return this._status;
  }

  get hash(): string {
    return this._hash;
  }

  get threadHash(): string | null {
    return this._thash;
  }

  get deletionApprovals(): readonly DeletionApproval[] {
    return [...this._deletionApprovals];
  }

  get starred(): boolean {
    return this._starred;
  }

  set subject(value: string | undefined) {
    this.updateMetadata({ subject: value });
  }

  // ==================== Static Create Method ====================

  public static create(
    userID: MajikUserID,
    owner: MajikMessageIdentity,
    participants: MajikMessagePublicKey[],
    metadata: ThreadMetadata = {},
  ): MajikMessageThread {
    try {
      // Validate inputs
      if (!userID || typeof userID !== "string" || userID.trim().length === 0) {
        throw new ValidationError(
          "userID is required and must be a non-empty string",
        );
      }

      if (!Array.isArray(participants) || participants.length === 0) {
        throw new ValidationError("participants must be a non-empty array");
      }

      // Normalize participants (deduplicate + sort)
      const uniqueParticipants = MajikMessageThread.normalizeParticipants([
        owner.publicKey,
        ...participants,
      ]);

      // Validate all participants
      for (const participant of uniqueParticipants) {
        if (
          !participant ||
          typeof participant !== "string" ||
          participant.trim().length === 0
        ) {
          throw new ValidationError(
            "All participants must be non-empty strings",
          );
        }
      }

      const id = uuidv4();
      const timestamp = new Date();
      const status = ThreadStatus.ONGOING;

      // Generate hash
      const hash = MajikMessageThread.generateHash(
        userID,
        timestamp,
        id,
        uniqueParticipants,
      );

      return new MajikMessageThread(
        id,
        userID,
        owner.id,
        metadata,
        timestamp,
        uniqueParticipants,
        status,
        hash,
        [],
        false,
        null,
      );
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to create MajikMessageThread: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CREATE_FAILED",
      );
    }
  }

  // ==================== Thread Hash (t_hash) ====================

  /**
   * Computes and stamps the t_hash for this thread.
   *
   * The t_hash is a SHA3-512 fingerprint of the entire thread's message history
   * combined with the thread's own identity hash. It acts as a tamper-evident
   * seal over the full conversation — if any message is altered, the t_hash
   * won't match.
   *
   * Input string layout (joined with ":"):
   *   <thread.hash> : <mail[0].hash> : <mail[1].hash> : … : <thread.id>
   *   where mails are sorted by timestamp ascending (oldest first).
   *
   * Calling this with an empty array is valid — it seals a thread that has no
   * messages yet (useful for archival of zero-message threads).
   *
   * @param mails - The full list of MajikMessageMailJSON for this thread.
   *                Does not need to be pre-sorted.
   * @returns The updated thread instance (for chaining).
   */
  public generateThreadHash(mails: MajikMessageMailJSON[]): this {
    try {
      // ── One-time seal guard ────────────────────────────────────────────────
      // t_hash is write-once. Once stamped it represents a finalized snapshot
      // of the conversation. If you need to re-seal (e.g. after more messages),
      // reconstruct the thread via fromJSON with t_hash: null first.
      if (this._thash !== null) {
        throw new OperationNotAllowedError(
          "Thread hash has already been generated. t_hash is write-once and cannot be overwritten.",
        );
      }

      if (!Array.isArray(mails)) {
        throw new ValidationError("mails must be an array");
      }

      // Validate every mail belongs to this thread
      for (const mail of mails) {
        if (mail.thread_id !== this._id) {
          throw new ValidationError(
            `Mail "${mail.id}" belongs to thread "${mail.thread_id}", not "${this._id}"`,
          );
        }
      }

      const sorted = sortMailsByTimestamp(mails);
      const input = buildThreadHashInput(this._hash, this._id, sorted);
      this._thash = sha512(input);

      return this;
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to generate thread hash: ${error instanceof Error ? error.message : "Unknown error"}`,
        "THREAD_HASH_FAILED",
      );
    }
  }

  /**
   * Verifies that the stored t_hash matches a freshly computed one.
   *
   * @param mails - The full list of MajikMessageMailJSON for this thread.
   * @returns true if the t_hash is valid and matches, false if t_hash not yet set.
   * @throws ValidationError if the computed hash does not match the stored one.
   */
  public verifyThreadHash(mails: MajikMessageMailJSON[]): boolean {
    if (this._thash === null) {
      return false; // Not yet generated — nothing to verify
    }

    if (!Array.isArray(mails)) {
      throw new ValidationError("mails must be an array");
    }

    const sorted = sortMailsByTimestamp(mails);
    const input = buildThreadHashInput(this._hash, this._id, sorted);
    const expected = sha512(input);

    if (this._thash !== expected) {
      throw new ValidationError(
        "Thread hash (t_hash) mismatch — message history integrity compromised",
      );
    }

    return true;
  }

  // ==================== Full Thread Audit ====================

  /**
   * Performs a full forensic audit of the thread.
   *
   * Accepts raw MajikMessageMailJSON — instances are hydrated internally via
   * MajikMessageMail.fromJSON so the call site only needs one array.
   *
   * Three checks must all pass for `isValid` to be true:
   *
   *   1. **threadValid** — `thread.validate()` passes (structural integrity of the
   *      thread object itself: UUID, hash, participants, deletion approvals, etc.)
   *
   *   2. **chainValid** — `MajikMessageMail.validateMailChain()` passes (every
   *      message hash is self-consistent and the blockchain p_hash linkage from
   *      thread → mail[0] → mail[1] → … is intact).
   *
   *   3. **hashValid** — `thread.verifyThreadHash()` passes (the SHA3-512 t_hash
   *      sealed over the full message list still matches). Returns false — not an
   *      error — when t_hash has not yet been generated, meaning the thread is
   *      structurally sound but still unsealed.
   *
   * @param thread    - The thread instance to audit.
   * @param mailJSONs - Full list of MajikMessageMailJSON for this thread.
   *                    Does not need to be pre-sorted.
   * @returns ThreadAuditResult with granular pass/fail per check plus error details.
   */
  public static auditThread(
    thread: MajikMessageThread,
    mailJSONs: MajikMessageMailJSON[],
  ): ThreadAuditResult {
    const errors: string[] = [];
    let tamperedMailIDs: string[] = [];
    let threadValid = false;
    let chainValid = false;
    let hashValid = false;

    // ── 1. Structural thread validation ───────────────────────────────────────
    try {
      thread.validate();
      threadValid = true;
    } catch (err) {
      errors.push(
        `Thread structure invalid: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    // ── 2. Hydrate JSON → instances, then run chain validation ────────────────
    // bypassValidation=false so fromJSON still runs per-mail validation.
    // If any individual mail fails to parse we record the error and skip the
    // chain check rather than throwing out of the audit entirely.
    let mailInstances: MajikMessageMail[] = [];
    try {
      mailInstances = mailJSONs.map((json) => MajikMessageMail.fromJSON(json));
    } catch (err) {
      errors.push(
        `Failed to hydrate mail JSON: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    // Only run chain validation when hydration succeeded (or the list was empty)
    if (mailInstances.length === mailJSONs.length) {
      try {
        const chainResult = MajikMessageMail.validateMailChain(
          thread,
          mailInstances,
        );
        chainValid = chainResult.isValid;
        if (!chainResult.isValid) {
          errors.push(...chainResult.errors);
          tamperedMailIDs = chainResult.tamperedItems;
        }
      } catch (err) {
        errors.push(
          `Mail chain audit threw unexpectedly: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    // ── 3. Thread hash (t_hash) verification ──────────────────────────────────
    // At this point t_hash is guaranteed non-null (the early guard above threw
    // otherwise). verifyThreadHash only throws on an actual mismatch.
    try {
      hashValid = thread.verifyThreadHash(mailJSONs);
    } catch (err) {
      errors.push(
        `Thread hash mismatch: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    return {
      isValid: threadValid && chainValid && hashValid,
      threadValid,
      chainValid,
      hashValid,
      errors,
      tamperedMailIDs: Array.from(new Set(tamperedMailIDs)),
    };
  }

  // ==================== Thread Export ====================

  /**
   * Exports the thread and its full message history as a self-contained snapshot.
   *
   * Requires that `generateThreadHash()` has already been called — the t_hash is
   * the integrity seal over the exported payload and must be present before the
   * export is considered authoritative. Call `generateThreadHash(mails)` first if
   * it has not been set yet.
   *
   * The returned messages are sorted by timestamp ascending (oldest first) so the
   * export is always deterministic regardless of the order they were passed in.
   *
   * @param mails - The full list of MajikMessageMailJSON for this thread.
   * @returns MajikMessageThreadExport containing the sealed thread JSON, sorted
   *          messages, export timestamp, and message count.
   * @throws OperationNotAllowedError if t_hash has not been generated yet.
   * @throws ValidationError if any mail does not belong to this thread.
   */
  public exportThread(mails: MajikMessageMailJSON[]): MajikMessageThreadExport {
    try {
      // t_hash must be set — an unsealed thread cannot be exported
      if (this._thash === null) {
        throw new OperationNotAllowedError(
          "Cannot export thread: t_hash has not been generated yet. " +
            "Call generateThreadHash(mails) before exporting.",
        );
      }

      if (!Array.isArray(mails)) {
        throw new ValidationError("mails must be an array");
      }

      // Validate every mail belongs to this thread
      for (const mail of mails) {
        if (mail.thread_id !== this._id) {
          throw new ValidationError(
            `Mail "${mail.id}" belongs to thread "${mail.thread_id}", not "${this._id}"`,
          );
        }
      }

      const sortedMails = sortMailsByTimestamp(mails);

      return {
        thread: this.toJSON(),
        messages: sortedMails,
        exported_at: new Date().toISOString(),
        message_count: sortedMails.length,
      };
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to export thread: ${error instanceof Error ? error.message : "Unknown error"}`,
        "EXPORT_THREAD_FAILED",
      );
    }
  }
  // ==================== Star Management ====================

  /**
   * Stars the thread for the user
   */
  public star(): void {
    try {
      if (this._starred) {
        throw new OperationNotAllowedError("Thread is already starred");
      }

      this._starred = true;
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to star thread: ${error instanceof Error ? error.message : "Unknown error"}`,
        "STAR_FAILED",
      );
    }
  }

  /**
   * Unstars the thread for the user
   */
  public unstar(): void {
    try {
      if (!this._starred) {
        throw new OperationNotAllowedError("Thread is not starred");
      }

      this._starred = false;
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to unstar thread: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNSTAR_FAILED",
      );
    }
  }

  /**
   * Toggles the starred status of the thread
   * @returns The new starred state
   */
  public toggleStar(): boolean {
    if (this._starred) {
      this.unstar();
    } else {
      this.star();
    }
    return this._starred;
  }

  // ==================== Hash Generation ====================

  private static generateHash(
    userID: string,
    timestamp: Date,
    id: string,
    participants: MajikMessagePublicKey[],
  ): string {
    // Normalize participants (they should already be normalized, but ensure consistency)
    const normalized = MajikMessageThread.normalizeParticipants(participants);

    // Join with delimiter
    const combined = normalized.join("|");

    const dataString = `${userID}:${timestamp.toISOString()}:${id}:${combined}`;
    return sha256(dataString);
  }

  private static generateApprovalHash(
    publicKey: MajikMessagePublicKey,
    threadID: string,
    timestamp: Date,
  ): string {
    const dataString = `${publicKey}:${threadID}:${timestamp.toISOString()}`;
    return sha256(dataString);
  }

  // ==================== Validation ====================

  public validate(): boolean {
    try {
      // Validate ID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(this._id)) {
        throw new ValidationError("Invalid UUID v4 format for id");
      }

      // Validate userID
      if (
        !this._userID ||
        typeof this._userID !== "string" ||
        this._userID.trim().length === 0
      ) {
        throw new ValidationError(
          "userID is required and must be a non-empty string",
        );
      }

      // Validate owner account ID
      if (
        !this._owner ||
        typeof this._owner !== "string" ||
        this._owner.trim().length === 0
      ) {
        throw new ValidationError(
          "owner account ID is required and must be a non-empty string",
        );
      }

      // Validate participants
      if (
        !Array.isArray(this._participants) ||
        this._participants.length === 0
      ) {
        throw new ValidationError("participants must be a non-empty array");
      }

      // Validate timestamp
      if (
        !(this._timestamp instanceof Date) ||
        isNaN(this._timestamp.getTime())
      ) {
        throw new ValidationError("timestamp must be a valid Date object");
      }

      // Validate status
      if (!Object.values(ThreadStatus).includes(this._status)) {
        throw new ValidationError(`Invalid status: ${this._status}`);
      }

      // Validate hash
      const expectedHash = MajikMessageThread.generateHash(
        this._userID,
        this._timestamp,
        this._id,
        this._participants,
      );

      if (this._hash !== expectedHash) {
        throw new ValidationError("Hash mismatch - data integrity compromised");
      }

      // Validate deletion approvals
      if (this._deletionApprovals.length > 0) {
        for (const approval of this._deletionApprovals) {
          // Check participant validity
          if (!this._participants.includes(approval.publicKey)) {
            throw new ValidationError(
              `Deletion approval from non-participant: ${approval.publicKey}`,
            );
          }

          // Verify approval hash
          const expectedApprovalHash = MajikMessageThread.generateApprovalHash(
            approval.publicKey,
            this._id,
            approval.timestamp,
          );

          if (approval.approvalHash !== expectedApprovalHash) {
            throw new ValidationError(
              `Invalid approval hash for participant: ${approval.publicKey}`,
            );
          }
        }

        // Check for duplicate approvals
        const approvedKeys = this._deletionApprovals.map(
          (approval) => approval.publicKey,
        );
        const uniqueKeys = new Set(approvedKeys);
        if (approvedKeys.length !== uniqueKeys.size) {
          throw new ValidationError("Duplicate deletion approvals detected");
        }
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // ==================== Status Management ====================

  public close(): void {
    try {
      if (this._status === ThreadStatus.CLOSED) {
        throw new OperationNotAllowedError("Thread is already closed");
      }

      if (
        this._status === ThreadStatus.PENDING_DELETION ||
        this._status === ThreadStatus.MARKED_FOR_DELETION
      ) {
        throw new OperationNotAllowedError(
          "Cannot close a thread pending deletion",
        );
      }

      this._status = ThreadStatus.CLOSED;
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to close thread: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CLOSE_FAILED",
      );
    }
  }

  // ==================== Deletion Approval System ====================

  public hasDeletionApproval(publicKey: MajikMessagePublicKey): boolean {
    if (!this.isParticipant(publicKey)) return false;

    return this._deletionApprovals.some(
      (approval) => approval.publicKey === publicKey,
    );
  }

  public requestDeletion(publicKey: MajikMessagePublicKey): void {
    try {
      // Validate public key is a participant
      if (!this._participants.includes(publicKey)) {
        throw new OperationNotAllowedError(
          "Only participants can request thread deletion",
        );
      }

      // Don't allow deletion requests on closed threads
      if (this._status === ThreadStatus.CLOSED) {
        throw new OperationNotAllowedError(
          "Cannot request deletion of a closed thread",
        );
      }

      if (this.hasDeletionApproval(publicKey)) {
        throw new OperationNotAllowedError(
          "This participant has already approved deletion",
        );
      }

      // Create approval
      const timestamp = new Date();
      const approvalHash = MajikMessageThread.generateApprovalHash(
        publicKey,
        this._id,
        timestamp,
      );

      const approval: DeletionApproval = {
        publicKey,
        approvalHash,
        timestamp,
      };

      this._deletionApprovals.push(approval);

      // Update status
      this.updateDeletionStatus();
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to request deletion: ${error instanceof Error ? error.message : "Unknown error"}`,
        "DELETION_REQUEST_FAILED",
      );
    }
  }

  private updateDeletionStatus(): void {
    if (this._deletionApprovals.length === 0) {
      // No approvals - revert to non-deletion status
      // Don't change status if already ONGOING or CLOSED
      if (
        this._status === ThreadStatus.PENDING_DELETION ||
        this._status === ThreadStatus.MARKED_FOR_DELETION
      ) {
        // Default to ONGOING when all approvals are revoked
        this._status = ThreadStatus.ONGOING;
      }
    } else if (this._deletionApprovals.length === this._participants.length) {
      // All participants approved
      this._status = ThreadStatus.MARKED_FOR_DELETION;
    } else {
      // Partial approvals (at least 1, but not all)
      this._status = ThreadStatus.PENDING_DELETION;
    }
  }

  public revokeDeletionRequest(publicKey: MajikMessagePublicKey): void {
    try {
      const approvalIndex = this._deletionApprovals.findIndex(
        (approval) => approval.publicKey === publicKey,
      );

      if (approvalIndex === -1) {
        throw new OperationNotAllowedError(
          "No deletion approval found for this participant",
        );
      }

      this._deletionApprovals.splice(approvalIndex, 1);
      this.updateDeletionStatus();
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to revoke deletion request: ${error instanceof Error ? error.message : "Unknown error"}`,
        "REVOKE_DELETION_FAILED",
      );
    }
  }

  public canBeDeleted(): boolean {
    // First check if status allows deletion
    if (this._status !== ThreadStatus.MARKED_FOR_DELETION) {
      return false;
    }

    // Verify all participants have approved
    if (this._deletionApprovals.length !== this._participants.length) {
      return false;
    }

    // Verify each approval hash
    return this.verifyDeletionApprovals();
  }

  public getDeletionProgress(): {
    approved: number;
    total: number;
    percentage: number;
  } {
    return {
      approved: this._deletionApprovals.length,
      total: this._participants.length,
      percentage:
        (this._deletionApprovals.length / this._participants.length) * 100,
    };
  }

  /**
   * Verifies that all deletion approvals have valid hashes and all participants have approved
   * @returns true if all approvals are valid and complete, false otherwise
   */
  public verifyDeletionApprovals(): boolean {
    try {
      // Check if we have approvals from all participants
      const approvedKeys = new Set(
        this._deletionApprovals.map((approval) => approval.publicKey),
      );

      // Verify all participants have approved
      for (const participant of this._participants) {
        if (!approvedKeys.has(participant)) {
          return false;
        }
      }

      // Verify each approval has a valid hash
      for (const approval of this._deletionApprovals) {
        const expectedHash = MajikMessageThread.generateApprovalHash(
          approval.publicKey,
          this._id,
          approval.timestamp,
        );

        if (approval.approvalHash !== expectedHash) {
          // Hash mismatch - approval is invalid
          return false;
        }

        // Ensure the public key is actually a participant
        if (!this._participants.includes(approval.publicKey)) {
          return false;
        }
      }

      // Check for duplicate approvals
      if (approvedKeys.size !== this._deletionApprovals.length) {
        return false;
      }

      return true;
    } catch (error) {
      // If any error occurs during verification, fail safely
      return false;
    }
  }

  /**
   * Get detailed verification status of deletion approvals
   * @returns Detailed information about approval validity
   */
  public getDeletionApprovalStatus(): {
    isValid: boolean;
    allParticipantsApproved: boolean;
    invalidApprovals: string[];
    missingApprovals: string[];
    duplicateApprovals: string[];
  } {
    const approvedKeys = this._deletionApprovals.map(
      (approval) => approval.publicKey,
    );
    const approvedSet = new Set(approvedKeys);
    const invalidApprovals: string[] = [];
    const missingApprovals: string[] = [];
    const duplicateApprovals: string[] = [];

    // Check for duplicates
    approvedKeys.forEach((key, index) => {
      if (approvedKeys.indexOf(key) !== index) {
        if (!duplicateApprovals.includes(key)) {
          duplicateApprovals.push(key);
        }
      }
    });

    // Check for missing participants
    for (const participant of this._participants) {
      if (!approvedSet.has(participant)) {
        missingApprovals.push(participant);
      }
    }

    // Verify each approval hash
    for (const approval of this._deletionApprovals) {
      const expectedHash = MajikMessageThread.generateApprovalHash(
        approval.publicKey,
        this._id,
        approval.timestamp,
      );

      if (approval.approvalHash !== expectedHash) {
        invalidApprovals.push(approval.publicKey);
      }

      // Check if approval is from non-participant
      if (!this._participants.includes(approval.publicKey)) {
        if (!invalidApprovals.includes(approval.publicKey)) {
          invalidApprovals.push(approval.publicKey);
        }
      }
    }

    const allParticipantsApproved = missingApprovals.length === 0;
    const isValid =
      allParticipantsApproved &&
      invalidApprovals.length === 0 &&
      duplicateApprovals.length === 0;

    return {
      isValid,
      allParticipantsApproved,
      invalidApprovals,
      missingApprovals,
      duplicateApprovals,
    };
  }

  // ==================== Metadata Management ====================

  public updateMetadata(metadata: Partial<ThreadMetadata>): this {
    try {
      if (this._status === ThreadStatus.MARKED_FOR_DELETION) {
        throw new OperationNotAllowedError(
          "Cannot update metadata of a thread marked for deletion",
        );
      }

      this._metadata = {
        ...this._metadata,
        ...metadata,
        lastActivity: new Date().toISOString(),
      };
      return this;
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to update metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
        "METADATA_UPDATE_FAILED",
      );
    }
  }

  // ==================== Serialization ====================

  public toJSON(): MajikMessageThreadJSON {
    return {
      id: this._id,
      user_id: this._userID,
      owner: this._owner,
      metadata: { ...this._metadata },
      timestamp: this._timestamp.toISOString(),
      participants: [...this._participants],
      status: this._status,
      hash: this._hash,
      t_hash: this._thash,
      deletion_approvals:
        this._deletionApprovals.length > 0
          ? this._deletionApprovals.map((approval) => ({
              ...approval,
              timestamp: approval.timestamp,
            }))
          : [],
      starred: this._starred,
    };
  }

  public static fromJSON(
    json: MajikMessageThreadJSON | string,
  ): MajikMessageThread {
    try {
      const data: MajikMessageThreadJSON =
        typeof json === "string" ? JSON.parse(json) : json;

      // Parse timestamp
      const timestamp = new Date(data.timestamp);
      if (isNaN(timestamp.getTime())) {
        throw new ValidationError("Invalid timestamp in JSON data");
      }

      // Parse deletion approvals
      const deletionApprovals = (data.deletion_approvals || []).map(
        (approval) => ({
          ...approval,
          timestamp: new Date(approval.timestamp),
        }),
      );

      return new MajikMessageThread(
        data.id,
        data.user_id,
        data.owner,
        data.metadata,
        timestamp,
        data.participants,
        data.status,
        data.hash,
        deletionApprovals,
        data.starred,
        data.t_hash,
      );
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
        "JSON_PARSE_FAILED",
      );
    }
  }

  // ==================== Utility Methods ====================

  public isOwner(accountID: MajikMessageAccountID): boolean {
    return this._owner === accountID;
  }

  public isParticipant(publicKey: MajikMessagePublicKey): boolean {
    return this._participants.includes(publicKey);
  }

  public toString(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  public isClosed(): boolean {
    return this._status === ThreadStatus.CLOSED;
  }

  public canBeClosed(): boolean {
    return this._status === ThreadStatus.ONGOING;
  }

  /**
   * Deduplicates and sorts participants to ensure consistent ordering
   */
  private static normalizeParticipants(participants: string[]): string[] {
    const participantsSet = new Set<string>();
    participants.forEach((p) => participantsSet.add(p));
    return Array.from(participantsSet).sort();
  }

  // ==================== Final Export Method ====================

  /**
   * Exports the thread with finalized metadata for analytics and archival purposes.
   * This method updates metadata with actual counts and stats, sets lastActivity,
   * and optionally closes the thread if no deletion is pending.
   *
   * @param messageCount - The actual number of messages in this thread
   * @param additionalTags - Optional tags to add to existing tags
   * @param autoClose - Whether to automatically close the thread (default: true)
   * @returns MajikMessageThreadJSON with updated metadata
   */
  public exportFinalStats(
    messageCount: number,
    additionalTags?: string[],
    autoClose: boolean = true,
  ): MajikMessageThreadJSON {
    try {
      // Validate message count
      if (
        typeof messageCount !== "number" ||
        messageCount < 0 ||
        !Number.isInteger(messageCount)
      ) {
        throw new ValidationError(
          "messageCount must be a non-negative integer",
        );
      }

      // Merge tags
      const existingTags = this._metadata.tags || [];
      const mergedTags = additionalTags
        ? Array.from(new Set([...existingTags, ...additionalTags]))
        : existingTags;

      // Update metadata with final stats
      const finalMetadata: ThreadMetadata = {
        messageCount,
        lastActivity: new Date().toISOString(),
        tags: mergedTags.length > 0 ? mergedTags : undefined,
        priority: this._metadata.priority,
        category: this._metadata.category,
      };

      // Determine final status
      let finalStatus = this._status;

      // Auto-close if requested and thread is not in deletion state
      if (autoClose && this._status === ThreadStatus.ONGOING) {
        finalStatus = ThreadStatus.CLOSED;
      }

      // If status is PENDING_DELETION, keep it as is
      if (this._status === ThreadStatus.PENDING_DELETION) {
        finalStatus = ThreadStatus.PENDING_DELETION;
      }

      // Create the export object
      const exportData: MajikMessageThreadJSON = {
        id: this._id,
        user_id: this._userID,
        owner: this._owner,
        metadata: finalMetadata,
        timestamp: this._timestamp.toISOString(),
        participants: [...this._participants],
        status: finalStatus,
        hash: this._hash,
        t_hash: this._thash,
        deletion_approvals: this._deletionApprovals.map((approval) => ({
          ...approval,
          timestamp: approval.timestamp,
        })),
        starred: this._starred,
      };

      // If we're auto-closing and status changed, actually update the instance
      if (
        autoClose &&
        finalStatus === ThreadStatus.CLOSED &&
        this._status === ThreadStatus.ONGOING
      ) {
        this._status = ThreadStatus.CLOSED;
        this._metadata = finalMetadata;
      } else if (!autoClose) {
        // Just update metadata without changing status
        this._metadata = finalMetadata;
      }

      return exportData;
    } catch (error) {
      if (error instanceof MajikThreadError) {
        throw error;
      }
      throw new MajikThreadError(
        `Failed to export final stats: ${error instanceof Error ? error.message : "Unknown error"}`,
        "EXPORT_FINAL_STATS_FAILED",
      );
    }
  }

  /**
   * Exports analytics-ready data for the thread
   * @returns Object with analytics metadata
   */
  public getAnalyticsData(): MajikMessageThreadAnalytics {
    const now = new Date();
    const duration = now.getTime() - this._timestamp.getTime();

    return {
      threadID: this._id,
      owner: this._owner,
      userID: this._userID,
      participantCount: this._participants.length,
      messageCount: this._metadata.messageCount || 0,
      status: this._status,
      createdAt: this._timestamp.toISOString(),
      lastActivity: this._metadata.lastActivity,
      duration,
      tags: this._metadata.tags || [],
      category: this._metadata.category,
      priority: this._metadata.priority,
      deletionStatus: {
        isPendingDeletion: this._status === ThreadStatus.PENDING_DELETION,
        isMarkedForDeletion: this._status === ThreadStatus.MARKED_FOR_DELETION,
        approvalProgress:
          (this._deletionApprovals.length / this._participants.length) * 100,
        approvedCount: this._deletionApprovals.length,
        totalParticipants: this._participants.length,
      },
      starred: this._starred,
    };
  }
}
