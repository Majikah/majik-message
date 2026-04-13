/* -------------------------------
 * Types
 * ------------------------------- */

import {
  MajikContact,
  MajikContactData,
  MajikContactGroup,
  MajikContactGroupMeta,
} from "@majikah/majik-contact";
import { MajikContactDirectory } from "./majik-contact-directory";
import { MajikContactGroupManager } from "./majik-contact-groups";
import { MAJIK_API_RESPONSE } from "../types";
import { MessageEnvelope } from "../messages/message-envelope";
import { MajikContactManagerError } from "./errors";
import { MajikContactManagerJSON } from "./types";

/* -------------------------------
 * MajikContactManager Class
 * ------------------------------- */

/**
 * Unified facade over MajikContactDirectory and MajikContactGroupManager.
 *
 * Responsibilities:
 *  - Owns both the directory and the group manager as a single cohesive unit
 *  - Proxies all directory methods so MajikMessage call sites need only change
 *    `contactDirectory` → `contacts` with no logic changes
 *  - Wires lifecycle hooks automatically so callers can never forget them:
 *      • removeContact()  → always calls groups.handleContactRemoved()
 *      • blockContact()   → always syncs the Blocked system group
 *      • unblockContact() → always syncs the Blocked system group
 *  - Exposes the group manager via `.group` for all group-specific operations
 *  - Serializes both directory and groups into one unified payload for
 *    MajikMessage.toJSON() / MajikMessage.fromJSON()
 *
 * Construction:
 *  - Pass nothing → fresh directory + fresh group manager (new session)
 *  - Pass a directory → wraps it, creates a fresh group manager bound to it
 *  - Pass both → fully restores a prior session (used by fromJSON)
 */
export class MajikContactManager {
  private readonly directory: MajikContactDirectory;
  private readonly groupManager: MajikContactGroupManager;

  constructor(
    directory?: MajikContactDirectory,
    groupManager?: MajikContactGroupManager,
  ) {
    this.directory = directory ?? new MajikContactDirectory();

    if (groupManager) {
      this.assertGroupManagerInstance(groupManager);
      this.groupManager = groupManager;
    } else {
      this.groupManager = new MajikContactGroupManager(this.directory);
    }
  }

  /* ================================
   * Group Manager Access
   * ================================ */

  /**
   * Direct access to the full MajikContactGroupManager API.
   * Use for all group-specific operations:
   *   manager.group.addToFavorites(contactId)
   *   manager.group.createGroup(id, name)
   *   manager.group.getContactsInGroup(groupId)
   *   etc.
   */
  get group(): MajikContactGroupManager {
    return this.groupManager;
  }

  /**
   * Direct access to the underlying MajikContactDirectory.
   * Prefer the proxied methods on this class over accessing the directory
   * directly — they keep group state in sync automatically.
   */
  get directory_(): MajikContactDirectory {
    return this.directory;
  }

  /* ================================
   * Contact Management (Proxied)
   * All signatures are intentionally identical to MajikContactDirectory
   * so MajikMessage call sites require zero logic changes.
   * ================================ */

  addContact(contact: MajikContact): this {
    this.directory.addContact(contact);
    return this;
  }

  addContacts(contacts: MajikContact[]): this {
    this.directory.addContacts(contacts);
    return this;
  }

  /**
   * Removes a contact from the directory and automatically removes them
   * from every group they belong to via the group manager hook.
   * The two operations are always atomic from the caller's perspective.
   */
  removeContact(id: string): MAJIK_API_RESPONSE {
    const result = this.directory.removeContact(id);
    if (result.success) {
      this.groupManager.handleContactRemoved(id);
    }
    return result;
  }

  getContact(id: string): MajikContact | undefined {
    return this.directory.getContact(id);
  }

  getContactByFingerprint(fingerprint: string): MajikContact | undefined {
    return this.directory.getContactByFingerprint(fingerprint);
  }

  async getContactByPublicKeyBase64(
    publicKeyBase64: string,
  ): Promise<MajikContact | undefined> {
    return this.directory.getContactByPublicKeyBase64(publicKeyBase64);
  }

  hasContact(id: string): boolean {
    return this.directory.hasContact(id);
  }

  hasFingerprint(fingerprint: string): boolean {
    return this.directory.hasFingerprint(fingerprint);
  }

  async hasContactByPublicKeyBase64(publicKeyBase64: string): Promise<boolean> {
    return this.directory.hasContactByPublicKeyBase64(publicKeyBase64);
  }

  listContacts(sortedByLabel = false, majikahOnly = false): MajikContact[] {
    return this.directory.listContacts(sortedByLabel, majikahOnly);
  }

  updateContactMeta(
    id: string,
    meta: Partial<MajikContactData["meta"]>,
  ): MajikContact {
    return this.directory.updateContactMeta(id, meta);
  }

  /**
   * Blocks a contact on the directory AND adds them to the system Blocked
   * group — both sides are always kept in sync.
   */
  blockContact(id: string): MajikContact {
    const contact = this.directory.blockContact(id);
    this.groupManager.addContactToGroupIfAbsent(
      this.groupManager.getBlockedGroup().id,
      id,
    );
    return contact;
  }

  /**
   * Unblocks a contact on the directory AND removes them from the system
   * Blocked group — both sides are always kept in sync.
   */
  unblockContact(id: string): MajikContact {
    const contact = this.directory.unblockContact(id);
    this.groupManager.removeContactFromGroupIfPresent(
      this.groupManager.getBlockedGroup().id,
      id,
    );
    return contact;
  }

  setMajikahStatus(id: string, status: boolean): MajikContact {
    return this.directory.setMajikahStatus(id, status);
  }

  isMajikahRegistered(id: string): boolean {
    return this.directory.isMajikahRegistered(id);
  }

  isMajikahIdentityChecked(id: string): boolean {
    return this.directory.isMajikahIdentityChecked(id);
  }

  hasContactForEnvelope(envelope: MessageEnvelope): boolean {
    return this.directory.hasContactForEnvelope(envelope);
  }

  /* ================================
   * Group CRUD Pass-throughs
   * ================================ */

  /**
   * Creates and registers a new user-defined group.
   * Throws if a group with the same ID already exists.
   */
  createGroup(
    id: string,
    name: string,
    meta?: Partial<Omit<MajikContactGroupMeta, "name">>,
    initialMemberIds?: string[],
  ): MajikContactGroup {
    return this.groupManager.createGroup(id, name, meta, initialMemberIds);
  }

  /**
   * Registers an already-constructed MajikContactGroup instance.
   * Throws if a group with the same ID already exists.
   */
  addGroup(group: MajikContactGroup): this {
    this.groupManager.addGroup(group);
    return this;
  }

  /**
   * Removes a user group by ID.
   * System groups (Favorites, Blocked) cannot be deleted.
   */
  removeGroup(id: string): MAJIK_API_RESPONSE {
    return this.groupManager.removeGroup(id);
  }

  /**
   * Returns a group by ID, or undefined if not found.
   */
  getGroup(id: string): MajikContactGroup | undefined {
    return this.groupManager.getGroup(id);
  }

  /**
   * Returns a group by ID. Throws if not found.
   */
  getGroupOrThrow(id: string): MajikContactGroup {
    return this.groupManager.getGroupOrThrow(id);
  }

  /**
   * Returns true if a group with the given ID exists.
   */
  hasGroup(id: string): boolean {
    return this.groupManager.hasGroup(id);
  }

  /**
   * Returns all groups.
   *
   * @param includeSystem  Include system groups (Favorites, Blocked). Default: true.
   * @param sortedByName   Sort results alphabetically by group name. Default: false.
   */
  listGroups(includeSystem = true, sortedByName = false): MajikContactGroup[] {
    return this.groupManager.listGroups(includeSystem, sortedByName);
  }

  /**
   * Returns only user-created groups (excludes Favorites and Blocked).
   * Sorted alphabetically by name.
   */
  listUserGroups(sortedByName = true): MajikContactGroup[] {
    return this.groupManager.listGroups(false, sortedByName);
  }

  /**
   * Returns only system groups (Favorites and Blocked).
   */
  listSystemGroups(): MajikContactGroup[] {
    return this.groupManager.listGroups(true).filter((g) => g.isSystem);
  }

  /**
   * Updates mutable metadata on a group (name, description).
   * Name is locked on system groups — will throw if attempted.
   */
  updateGroupMeta(
    id: string,
    meta: Partial<Pick<MajikContactGroupMeta, "name" | "description">>,
  ): MajikContactGroup {
    return this.groupManager.updateGroupMeta(id, meta);
  }

  /* ================================
   * Group Membership Pass-throughs
   * ================================ */

  /**
   * Adds a contact to a group.
   * Validates the contact exists in the directory.
   * If the group is the system Blocked group, also calls contact.block().
   * Throws if the contact is already a member — use addContactToGroupIfAbsent for idempotent.
   */
  addContactToGroup(groupId: string, contactId: string): MajikContactGroup {
    return this.groupManager.addContactToGroup(groupId, contactId);
  }

  /**
   * Idempotent variant — does not throw if the contact is already a member.
   */
  addContactToGroupIfAbsent(
    groupId: string,
    contactId: string,
  ): MajikContactGroup {
    return this.groupManager.addContactToGroupIfAbsent(groupId, contactId);
  }

  /**
   * Adds multiple contacts to a group in one call (all-or-nothing).
   */
  addContactsToGroup(groupId: string, contactIds: string[]): MajikContactGroup {
    return this.groupManager.addContactsToGroup(groupId, contactIds);
  }

  /**
   * Removes a contact from a group.
   * If the group is the system Blocked group, also calls contact.unblock().
   * Throws if the contact is not a member — use removeContactFromGroupIfPresent for idempotent.
   */
  removeContactFromGroup(
    groupId: string,
    contactId: string,
  ): MajikContactGroup {
    return this.groupManager.removeContactFromGroup(groupId, contactId);
  }

  /**
   * Idempotent variant — does not throw if the contact is not a member.
   */
  removeContactFromGroupIfPresent(
    groupId: string,
    contactId: string,
  ): MajikContactGroup {
    return this.groupManager.removeContactFromGroupIfPresent(
      groupId,
      contactId,
    );
  }

  /**
   * Moves a contact from one group to another atomically.
   * Throws if the contact is not a member of the source group.
   */
  moveContactBetweenGroups(
    contactId: string,
    fromGroupId: string,
    toGroupId: string,
  ): void {
    return this.groupManager.moveContact(contactId, fromGroupId, toGroupId);
  }

  /* ================================
   * Group Query Pass-throughs
   * ================================ */

  /**
   * Returns all hydrated MajikContact instances in the given group.
   * Contacts removed from the directory since last save are silently skipped.
   */
  getContactsInGroup(groupId: string): MajikContact[] {
    return this.groupManager.getContactsInGroup(groupId);
  }

  /**
   * Returns hydrated contacts in the group, sorted by label (or ID if no label).
   */
  getContactsInGroupSorted(groupId: string): MajikContact[] {
    return this.groupManager.getContactsInGroupSorted(groupId);
  }

  /**
   * Returns true if the contact is a member of the given group.
   */
  isContactInGroup(groupId: string, contactId: string): boolean {
    return this.groupManager.isContactInGroup(groupId, contactId);
  }

  /**
   * Returns all groups the contact belongs to.
   */
  getGroupsForContact(contactId: string): MajikContactGroup[] {
    return this.groupManager.getGroupsForContact(contactId);
  }

  /**
   * Returns all group IDs the contact belongs to.
   */
  getGroupIdsForContact(contactId: string): string[] {
    return this.groupManager.getGroupIdsForContact(contactId);
  }

  /* ================================
   * System Group Convenience Pass-throughs
   * ================================ */

  /**
   * Adds the contact to the Favorites group (idempotent).
   */
  addToFavorites(contactId: string): MajikContactGroup {
    return this.groupManager.addToFavorites(contactId);
  }

  /**
   * Removes the contact from the Favorites group (idempotent).
   */
  removeFromFavorites(contactId: string): MajikContactGroup {
    return this.groupManager.removeFromFavorites(contactId);
  }

  /**
   * Returns true if the contact is in the Favorites group.
   */
  isFavorite(contactId: string): boolean {
    return this.groupManager.isFavorite(contactId);
  }

  /**
   * Returns true if the contact is in the Blocked group.
   */
  isContactBlocked(contactId: string): boolean {
    return this.groupManager.isBlocked(contactId);
  }

  /**
   * Returns the Favorites system group instance.
   */
  getFavoritesGroup(): MajikContactGroup {
    return this.groupManager.getFavoritesGroup();
  }

  /**
   * Returns the Blocked system group instance.
   */
  getBlockedGroup(): MajikContactGroup {
    return this.groupManager.getBlockedGroup();
  }

  /**
   * Returns all contacts in the Favorites group as hydrated MajikContact instances.
   */
  getFavoriteContacts(): MajikContact[] {
    return this.groupManager.getContactsInGroup(
      this.groupManager.getFavoritesGroup().id,
    );
  }

  /**
   * Returns all contacts in the Blocked group as hydrated MajikContact instances.
   */
  getBlockedContacts(): MajikContact[] {
    return this.groupManager.getContactsInGroup(
      this.groupManager.getBlockedGroup().id,
    );
  }

  /* ================================
   * Directory Clear
   * ================================ */

  /**
   * Clears both the directory and all group memberships.
   * System groups are preserved (re-bootstrapped by the group manager).
   */
  clear(): this {
    const allContactIds = this.directory.listContacts().map((c) => c.id);

    this.directory.clear();

    // Notify the group manager for every contact so the reverse index
    // and group memberships are cleaned up properly
    allContactIds.forEach((id) => this.groupManager.handleContactRemoved(id));

    return this;
  }

  /* ================================
   * Serialization / Persistence
   * ================================ */

  /**
   * Serializes both the directory and all groups into a single unified payload.
   * This is what MajikMessage.toJSON() should persist.
   */
  async toJSON(): Promise<MajikContactManagerJSON> {
    return {
      contacts: await this.directory.toJSON(),
      groups: this.groupManager.toJSON(),
    };
  }

  /**
   * Restores a MajikContactManager from a unified serialized payload.
   *
   * Restoration order:
   *  1. Restore the directory (contacts + crypto keys)
   *  2. Restore groups via the group manager
   *  3. Silently strip any group member IDs that no longer exist in the
   *     restored directory (orphan pruning) — guards against data drift
   *     between directory and group state across serialization rounds
   *
   * @param data   The payload produced by toJSON().
   * @param KEY_ALGO  The WebCrypto algorithm descriptor used to import
   *                  public keys — passed through to the directory's fromJSON.
   */
  static async fromJSON(
    data: MajikContactManagerJSON,
    KEY_ALGO: KeyAlgorithm | EcKeyImportParams | { name: string },
  ): Promise<MajikContactManager> {
    if (!data || typeof data !== "object") {
      throw new MajikContactManagerError(
        "fromJSON: invalid payload — expected { contacts, groups }",
      );
    }
    if (!data.contacts) {
      throw new MajikContactManagerError(
        "fromJSON: missing required field 'contacts'",
      );
    }
    if (!data.groups) {
      throw new MajikContactManagerError(
        "fromJSON: missing required field 'groups'",
      );
    }

    // Step 1 — restore directory
    let directory: MajikContactDirectory;
    try {
      directory = new MajikContactDirectory();
      await directory.fromJSON(data.contacts);
    } catch (err) {
      throw new MajikContactManagerError(
        "fromJSON: failed to restore contact directory",
        err,
      );
    }

    // Step 2 — restore group manager bound to the restored directory
    let groupManager: MajikContactGroupManager;
    try {
      groupManager = new MajikContactGroupManager(directory);
      groupManager.fromJSON(data.groups);
    } catch (err) {
      throw new MajikContactManagerError(
        "fromJSON: failed to restore group manager",
        err,
      );
    }

    // Step 3 — silently prune orphaned member IDs from every group
    // An orphan is a contact ID that exists in a group but is absent from
    // the restored directory. This can happen if a contact was removed
    // between two save cycles or data was partially corrupted.
    MajikContactManager.pruneOrphanedMembers(directory, groupManager);

    return new MajikContactManager(directory, groupManager);
  }

  /**
   * Walks every group and removes any member ID not present in the directory.
   * Operates directly on the group instances — no re-serialization needed.
   */
  private static pruneOrphanedMembers(
    directory: MajikContactDirectory,
    groupManager: MajikContactGroupManager,
  ): void {
    const allGroups = groupManager.listGroups(true); // include system groups

    for (const group of allGroups) {
      const orphans = group
        .listMemberIds()
        .filter((id) => !directory.hasContact(id));

      for (const orphanId of orphans) {
        // Use the idempotent variant — safe even if the index is already clean
        group.removeMemberIfPresent(orphanId);
        // Also clean up the reverse index on the group manager
        groupManager.handleContactRemoved(orphanId);
      }
    }
  }

  /* ================================
   * Assertions
   * ================================ */

  private assertGroupManagerInstance(gm: unknown): void {
    if (!gm || !(gm instanceof MajikContactGroupManager)) {
      throw new MajikContactManagerError(
        "groupManager must be a valid MajikContactGroupManager instance",
      );
    }
  }
}
