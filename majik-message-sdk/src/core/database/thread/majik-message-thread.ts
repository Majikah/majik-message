import { v4 as uuidv4 } from "uuid";

import { ThreadStatus } from "./enums";
import {
  ISODateString,
  MajikMessageAccountID,
  MajikMessagePublicKey,
  MajikMessageThreadID,
} from "../../types";
import { MajikUserID } from "@thezelijah/majik-user";
import { sha256 } from "../../crypto/crypto-provider";
import { MajikMessageMailJSON } from "./mail/majik-message-mail";
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
  publicKey: string;
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
  deletion_approvals: DeletionApproval[];
  starred: boolean;
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
  ) {
    this._id = id;
    this._userID = userID;
    this._owner = owner;
    this._metadata = metadata;
    this._timestamp = timestamp;
    this._participants = participants;
    this._status = status;
    this._hash = hash;
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

  get owner(): MajikMessagePublicKey {
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

  get deletionApprovals(): readonly DeletionApproval[] {
    return [...this._deletionApprovals];
  }

  get starred(): boolean {
    return this._starred;
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
    publicKey: string,
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
          const expectedHash = MajikMessageThread.generateApprovalHash(
            approval.publicKey,
            this._id,
            approval.timestamp,
          );

          if (approval.approvalHash !== expectedHash) {
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

  public requestDeletion(publicKey: string): void {
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

      // Check if already approved
      const existingApproval = this._deletionApprovals.find(
        (approval) => approval.publicKey === publicKey,
      );

      if (existingApproval) {
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

  public revokeDeletionRequest(publicKey: string): void {
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

  public updateMetadata(metadata: Partial<ThreadMetadata>): void {
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

  public isOwner(publicKey: string): boolean {
    return this._owner === publicKey;
  }

  public isParticipant(publicKey: string): boolean {
    return this._participants.includes(publicKey);
  }

  public toString(): string {
    return JSON.stringify(this.toJSON(), null, 2);
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

      // Cannot finalize a thread marked for deletion
      if (this._status === ThreadStatus.MARKED_FOR_DELETION) {
        throw new OperationNotAllowedError(
          "Cannot export final stats for a thread marked for deletion",
        );
      }

      // Merge tags
      const existingTags = this._metadata.tags || [];
      const mergedTags = additionalTags
        ? Array.from(new Set([...existingTags, ...additionalTags]))
        : existingTags;

      // Update metadata with final stats
      const finalMetadata: ThreadMetadata = {
        ...this._metadata,
        messageCount,
        lastActivity: new Date().toISOString(),
        tags: mergedTags.length > 0 ? mergedTags : undefined,
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
