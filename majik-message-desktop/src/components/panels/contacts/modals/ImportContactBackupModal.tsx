// ImportContactBackupModal.tsx

import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import { toast } from "sonner";
import styled from "styled-components";

import DynamicPopUp from "@/components/functional/DynamicPopUp";

import {
  IdentificationBadgeIcon,
  UsersThreeIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
} from "@phosphor-icons/react";
import { MajikContact, MajikContactGroup } from "@majikah/majik-contact";
import { ContactManagerSnapshot } from "@majikah/majik-message/dist/core/backup/types";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 120px;
`;

const SummaryBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
`;

const SummaryText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  opacity: 0.8;

  span {
    font-family: ${({ theme }) => theme.typography.fonts.numbers};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const GlobalActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const GlobalActionsLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9.5px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.5;
  margin-right: 4px;
`;

const ActionChip = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  border-radius: 5px;
  padding: 3px 10px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  opacity: 0.7;
  transition:
    opacity 0.12s,
    background 0.12s,
    border-color 0.12s;

  &:hover {
    opacity: 1;
    background: ${({ theme }) => theme.colors.primarySoft};
    border-color: ${({ theme }) => theme.colors.primary}55;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primary}12;
  margin: 2px 0;
`;

// ── Groups toggle row ─────────────────────────────────────────────────────

const OptionsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.primary}14;
  background: ${({ theme }) => theme.colors.primarySoft}66;
`;

const OptionsLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const OptionsLabelTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const OptionsLabelSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 9.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.65;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.45)};
  transition:
    opacity 0.12s,
    color 0.12s;

  &:hover {
    opacity: 1;
  }
`;

// ── Group preview table ───────────────────────────────────────────────────

const GroupTable = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.primary}14;
  border-radius: 7px;
  overflow: hidden;
`;

const GroupRow = styled.div<{ $checked: boolean; $duplicate: boolean }>`
  display: grid;
  grid-template-columns: 28px 1fr 80px 80px;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0d;
  background: ${({ theme, $checked, $duplicate }) =>
    !$checked
      ? "transparent"
      : $duplicate
        ? `${theme.colors.error}08`
        : `${theme.colors.primary}06`};
  transition: background 0.1s;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const GroupName = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const GroupMeta = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 9.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  text-align: right;
`;

// ── Contact table (unchanged from previous) ───────────────────────────────

const TableSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TableSectionHeader = styled.div<{ $variant: "unique" | "duplicate" }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px;
`;

const TableSectionLabel = styled.div<{ $variant: "unique" | "duplicate" }>`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9.5px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme, $variant }) =>
    $variant === "duplicate" ? theme.colors.error : theme.colors.primary};
  opacity: 0.6;
`;

const TableSectionActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Table = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.primary}14;
  border-radius: 7px;
  overflow: hidden;
`;

const TableRow = styled.div<{ $checked: boolean; $duplicate: boolean }>`
  display: grid;
  grid-template-columns: 28px 1fr 160px 110px;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0d;
  background: ${({ theme, $checked, $duplicate }) =>
    !$checked
      ? "transparent"
      : $duplicate
        ? `${theme.colors.error}08`
        : `${theme.colors.primary}06`};
  transition: background 0.1s;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const CheckboxCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Checkbox = styled.input`
  width: 13px;
  height: 13px;
  accent-color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
`;

const ContactCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const ContactName = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ContactSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 9.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.65;
`;

const PublicKeyCell = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.mono};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DuplicateBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 8.5px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: ${({ theme }) => theme.colors.error}18;
  color: ${({ theme }) => theme.colors.error};
  margin-left: 5px;
  vertical-align: middle;
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9.5px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.5;
  padding: 2px 0;
`;

const EmptyNotice = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 2.5rem 1rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  text-align: center;
`;

const EmptyText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveContactName(contact: MajikContact): string {
  const meta = contact.meta;
  if (meta?.label?.trim()) return meta.label.trim();
  return `${contact.fingerprint.slice(0, 20)}…`;
}

function truncatePublicKey(key: string): string {
  if (key.length <= 20) return key;
  return `${key.slice(0, 12)}…${key.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// ContactRow
// ---------------------------------------------------------------------------

interface ContactRowProps {
  contact: MajikContact;
  checked: boolean;
  isDuplicate: boolean;
  onToggle: (id: string) => void;
}

const ContactRow: React.FC<ContactRowProps> = memo(
  ({ contact, checked, isDuplicate, onToggle }) => {
    const name = resolveContactName(contact);
    const sub = contact.id;

    const publicKeyDisplay = useMemo(() => {
      const raw = contact.id ?? contact.edPublicKeyBase64 ?? "";
      return truncatePublicKey(raw);
    }, [contact]);

    return (
      <TableRow
        $checked={checked}
        $duplicate={isDuplicate}
        onClick={() => onToggle(contact.id)}
      >
        <CheckboxCell>
          <Checkbox
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(contact.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </CheckboxCell>
        <ContactCell>
          <ContactName>
            {name}
            {isDuplicate && <DuplicateBadge>exists</DuplicateBadge>}
          </ContactName>
          {sub && <ContactSub>{sub}</ContactSub>}
        </ContactCell>
        <PublicKeyCell title={contact.edPublicKeyBase64 ?? contact.mlKey}>
          {publicKeyDisplay}
        </PublicKeyCell>
      </TableRow>
    );
  },
);
ContactRow.displayName = "ContactRow";

// ---------------------------------------------------------------------------
// ContactTable
// ---------------------------------------------------------------------------

interface ContactTableProps {
  variant: "unique" | "duplicate";
  contacts: MajikContact[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const ContactTable: React.FC<ContactTableProps> = memo(
  ({
    variant,
    contacts,
    selectedIds,
    onToggle,
    onSelectAll,
    onDeselectAll,
  }) => {
    const allChecked = contacts.every((c) => selectedIds.has(c.id));
    const label =
      variant === "unique" ? "New Contacts" : "Already in Directory";

    return (
      <TableSection>
        <TableSectionHeader $variant={variant}>
          <TableSectionLabel $variant={variant}>{label}</TableSectionLabel>
          <TableSectionActions>
            <ActionChip onClick={onSelectAll} disabled={allChecked}>
              All
            </ActionChip>
            <ActionChip
              onClick={onDeselectAll}
              disabled={contacts.every((c) => !selectedIds.has(c.id))}
            >
              None
            </ActionChip>
          </TableSectionActions>
        </TableSectionHeader>
        <Table>
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              checked={selectedIds.has(contact.id)}
              isDuplicate={variant === "duplicate"}
              onToggle={onToggle}
            />
          ))}
        </Table>
      </TableSection>
    );
  },
);
ContactTable.displayName = "ContactTable";

// ---------------------------------------------------------------------------
// GroupPreviewTable
// ---------------------------------------------------------------------------

interface GroupPreviewTableProps {
  groups: MajikContactGroup[];
  selectedIds: Set<string>;
  existingGroupIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const GroupPreviewTable: React.FC<GroupPreviewTableProps> = memo(
  ({
    groups,
    selectedIds,
    existingGroupIds,
    onToggle,
    onSelectAll,
    onDeselectAll,
  }) => {
    const allChecked = groups.every((g) => selectedIds.has(g.id));

    return (
      <TableSection>
        <TableSectionHeader $variant="unique">
          <SectionTitle>
            <UsersThreeIcon size={12} />
            Groups
          </SectionTitle>
          <TableSectionActions>
            <ActionChip onClick={onSelectAll} disabled={allChecked}>
              All
            </ActionChip>
            <ActionChip
              onClick={onDeselectAll}
              disabled={groups.every((g) => !selectedIds.has(g.id))}
            >
              None
            </ActionChip>
          </TableSectionActions>
        </TableSectionHeader>

        <GroupTable>
          {groups.map((group) => {
            const checked = selectedIds.has(group.id);
            const isDuplicate = existingGroupIds.has(group.id);
            const memberCount = group.listMemberIds().length;

            return (
              <GroupRow
                key={group.id}
                $checked={checked}
                $duplicate={isDuplicate}
                onClick={() => onToggle(group.id)}
              >
                <CheckboxCell>
                  <Checkbox
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(group.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </CheckboxCell>
                <GroupName>
                  {group.meta?.name ?? group.id}
                  {isDuplicate && <DuplicateBadge>exists</DuplicateBadge>}
                </GroupName>
                <GroupMeta>
                  {memberCount} member{memberCount !== 1 ? "s" : ""}
                </GroupMeta>
                <GroupMeta style={{ textAlign: "right" }}>
                  {isDuplicate ? "merge" : "new"}
                </GroupMeta>
              </GroupRow>
            );
          })}
        </GroupTable>
      </TableSection>
    );
  },
);
GroupPreviewTable.displayName = "GroupPreviewTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportContactBackupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikMessageDatabase;
  /**
   * Parsed snapshot from readContactsBackup() — contacts + user groups.
   * The caller (App.tsx listener) handles file picking and parsing,
   * then passes the result here.
   */
  snapshot: ContactManagerSnapshot | null;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportContactBackupModal: React.FC<ImportContactBackupModalProps> =
  memo(({ open, onOpenChange, majik, snapshot, onSuccess }) => {
    const contacts = snapshot?.contacts ?? [];
    const groups = snapshot?.groups ?? [];

    const [isImporting, setIsImporting] = useState(false);
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(
      new Set(),
    );
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
      new Set(),
    );

    // Whether to include groups at all — default true
    const [includeGroups, setIncludeGroups] = useState(true);

    // ── Partition contacts ─────────────────────────────────────────────────
    const { uniqueContacts, duplicateContacts } = useMemo(() => {
      const unique: MajikContact[] = [];
      const duplicates: MajikContact[] = [];
      for (const c of contacts) {
        if (majik.getContactByID(c.id)) duplicates.push(c);
        else unique.push(c);
      }
      return { uniqueContacts: unique, duplicateContacts: duplicates };
    }, [contacts, majik]);

    // ── Existing group IDs for duplicate detection ─────────────────────────
    const existingGroupIds = useMemo(
      () =>
        new Set(groups.filter((g) => majik.hasGroup(g.id)).map((g) => g.id)),
      [groups, majik],
    );

    // ── Default selections on open ────────────────────────────────────────
    useEffect(() => {
      if (open) {
        setSelectedContactIds(new Set(uniqueContacts.map((c) => c.id)));
        setSelectedGroupIds(new Set(groups.map((g) => g.id)));
        setIncludeGroups(true);
      }
    }, [open, uniqueContacts, groups]);

    // ── Contact toggles ────────────────────────────────────────────────────
    const handleContactToggle = useCallback((id: string) => {
      setSelectedContactIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }, []);

    const handleSelectContactGroup = useCallback((group: MajikContact[]) => {
      setSelectedContactIds((prev) => {
        const next = new Set(prev);
        group.forEach((c) => next.add(c.id));
        return next;
      });
    }, []);

    const handleDeselectContactGroup = useCallback((group: MajikContact[]) => {
      setSelectedContactIds((prev) => {
        const next = new Set(prev);
        group.forEach((c) => next.delete(c.id));
        return next;
      });
    }, []);

    // ── Group toggles ──────────────────────────────────────────────────────
    const handleGroupToggle = useCallback((id: string) => {
      setSelectedGroupIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }, []);

    const handleSelectAllGroups = useCallback(() => {
      setSelectedGroupIds(new Set(groups.map((g) => g.id)));
    }, [groups]);

    const handleDeselectAllGroups = useCallback(() => {
      setSelectedGroupIds(new Set());
    }, []);

    // ── Global quick actions ───────────────────────────────────────────────
    const handleSelectAll = useCallback(() => {
      setSelectedContactIds(new Set(contacts.map((c) => c.id)));
    }, [contacts]);

    const handleSelectUniqueOnly = useCallback(() => {
      setSelectedContactIds(new Set(uniqueContacts.map((c) => c.id)));
    }, [uniqueContacts]);

    const handleDeselectAll = useCallback(() => {
      setSelectedContactIds(new Set());
    }, []);

    // ── Computed helpers ───────────────────────────────────────────────────
    const allContactsSelected =
      contacts.length > 0 &&
      contacts.every((c) => selectedContactIds.has(c.id));

    const uniqueOnlySelected =
      uniqueContacts.every((c) => selectedContactIds.has(c.id)) &&
      duplicateContacts.every((c) => !selectedContactIds.has(c.id));

    const selectedDuplicateContactCount = duplicateContacts.filter((c) =>
      selectedContactIds.has(c.id),
    ).length;

    const selectedGroupCount = selectedGroupIds.size;

    // ── Confirm ────────────────────────────────────────────────────────────
    const handleConfirm = useCallback(() => {
      const contactsToImport = contacts.filter((c) =>
        selectedContactIds.has(c.id),
      );
      const groupsToImport = includeGroups
        ? groups.filter((g) => selectedGroupIds.has(g.id))
        : [];

      if (contactsToImport.length === 0) {
        toast.error("No contacts selected", {
          description: "Check at least one contact to restore.",
        });
        return;
      }

      const run = async (): Promise<string> => {
        setIsImporting(true);

        let imported = 0;
        let overwritten = 0;
        let groupsRestored = 0;

        // Contacts
        for (const contact of contactsToImport) {
          const isDup = !!majik.getContactByID(contact.id);
          await majik.addContact(contact);
          isDup ? overwritten++ : imported++;
        }

        // Groups — only restore if contact was actually imported
        const restoredContactIds = new Set(contactsToImport.map((c) => c.id));
        for (const group of groupsToImport) {
          if (!majik.hasGroup(group.id)) {
            await majik.addGroup(group);
          } else {
            // Merge membership only
            for (const memberId of group.listMemberIds()) {
              if (restoredContactIds.has(memberId)) {
                await majik.addContactToGroup(group.id, memberId);
              }
            }
          }
          groupsRestored++;
        }

        const parts: string[] = [];
        if (imported > 0)
          parts.push(
            `${imported} contact${imported !== 1 ? "s" : ""} restored`,
          );
        if (overwritten > 0) parts.push(`${overwritten} overwritten`);
        if (groupsRestored > 0)
          parts.push(
            `${groupsRestored} group${groupsRestored !== 1 ? "s" : ""} restored`,
          );

        return parts.join(", ") + ".";
      };

      toast.promise(run(), {
        loading: `Restoring ${contactsToImport.length} contact${contactsToImport.length !== 1 ? "s" : ""}…`,
        success: (msg) => {
          onOpenChange(false);
          onSuccess();
          return msg;
        },
        error: (err) => {
          console.error(err);
          return err instanceof Error ? err.message : "Restore failed.";
        },
        finally: () => setIsImporting(false),
      });
    }, [
      contacts,
      groups,
      selectedContactIds,
      selectedGroupIds,
      includeGroups,
      majik,
      onOpenChange,
      onSuccess,
    ]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    // ── Confirm button label ───────────────────────────────────────────────
    const confirmLabel = useMemo(() => {
      if (isImporting) return "Restoring…";
      const count = selectedContactIds.size;
      if (count === 0) return "Restore";
      const overwriteNote =
        selectedDuplicateContactCount > 0
          ? ` (${selectedDuplicateContactCount} overwrite${selectedDuplicateContactCount !== 1 ? "s" : ""})`
          : "";
      const groupNote =
        includeGroups && selectedGroupCount > 0
          ? ` + ${selectedGroupCount} group${selectedGroupCount !== 1 ? "s" : ""}`
          : "";
      return `Restore ${count} Contact${count !== 1 ? "s" : ""}${groupNote}${overwriteNote}`;
    }, [
      isImporting,
      selectedContactIds.size,
      selectedDuplicateContactCount,
      includeGroups,
      selectedGroupCount,
    ]);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Restore Contact Backup",
          description:
            "Review the contacts and groups loaded from the backup file. Duplicates are shown separately and will overwrite existing records if selected.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleCancel,
            isDisabled: isImporting,
          },
          confirm: {
            text: confirmLabel,
            isDisabled: selectedContactIds.size === 0 || isImporting,
            onClick: handleConfirm,
          },
        }}
      >
        <ModalBody>
          {contacts.length === 0 ? (
            <EmptyNotice>
              <IdentificationBadgeIcon size={38} weight="thin" />
              <EmptyText>No contacts were found in the backup file.</EmptyText>
            </EmptyNotice>
          ) : (
            <>
              {/* ── Summary bar ── */}
              <SummaryBar>
                <SummaryText>
                  <span>{contacts.length}</span> contact
                  {contacts.length !== 1 ? "s" : ""}
                  {groups.length > 0 && (
                    <>
                      {" · "}
                      <span>{groups.length}</span> group
                      {groups.length !== 1 ? "s" : ""}
                    </>
                  )}
                  {duplicateContacts.length > 0 && (
                    <>
                      {" · "}
                      <span>{duplicateContacts.length}</span> duplicate
                      {duplicateContacts.length !== 1 ? "s" : ""}
                    </>
                  )}
                </SummaryText>

                <GlobalActions>
                  <GlobalActionsLabel>Select:</GlobalActionsLabel>
                  <ActionChip
                    onClick={handleSelectAll}
                    disabled={allContactsSelected}
                  >
                    All
                  </ActionChip>
                  {duplicateContacts.length > 0 && (
                    <ActionChip
                      onClick={handleSelectUniqueOnly}
                      disabled={uniqueOnlySelected}
                    >
                      Unique Only
                    </ActionChip>
                  )}
                  <ActionChip
                    onClick={handleDeselectAll}
                    disabled={selectedContactIds.size === 0}
                  >
                    None
                  </ActionChip>
                </GlobalActions>
              </SummaryBar>

              {/* ── Groups toggle (only shown if backup has groups) ── */}
              {groups.length > 0 && (
                <OptionsRow>
                  <OptionsLabel>
                    <OptionsLabelTitle>Include Groups</OptionsLabelTitle>
                    <OptionsLabelSub>
                      Restore group memberships from the backup. Existing groups
                      will have members merged in.
                    </OptionsLabelSub>
                  </OptionsLabel>
                  <ToggleButton
                    $active={includeGroups}
                    onClick={() => setIncludeGroups((v) => !v)}
                  >
                    {includeGroups ? (
                      <ToggleRightIcon size={22} weight="fill" />
                    ) : (
                      <ToggleLeftIcon size={22} />
                    )}
                    {includeGroups ? "On" : "Off"}
                  </ToggleButton>
                </OptionsRow>
              )}

              {/* ── Contact tables ── */}
              {uniqueContacts.length > 0 && (
                <ContactTable
                  variant="unique"
                  contacts={uniqueContacts}
                  selectedIds={selectedContactIds}
                  onToggle={handleContactToggle}
                  onSelectAll={() => handleSelectContactGroup(uniqueContacts)}
                  onDeselectAll={() =>
                    handleDeselectContactGroup(uniqueContacts)
                  }
                />
              )}

              {uniqueContacts.length > 0 && duplicateContacts.length > 0 && (
                <Divider />
              )}

              {duplicateContacts.length > 0 && (
                <ContactTable
                  variant="duplicate"
                  contacts={duplicateContacts}
                  selectedIds={selectedContactIds}
                  onToggle={handleContactToggle}
                  onSelectAll={() =>
                    handleSelectContactGroup(duplicateContacts)
                  }
                  onDeselectAll={() =>
                    handleDeselectContactGroup(duplicateContacts)
                  }
                />
              )}

              {/* ── Group table (conditionally rendered) ── */}
              {includeGroups && groups.length > 0 && (
                <>
                  <Divider />
                  <GroupPreviewTable
                    groups={groups}
                    selectedIds={selectedGroupIds}
                    existingGroupIds={existingGroupIds}
                    onToggle={handleGroupToggle}
                    onSelectAll={handleSelectAllGroups}
                    onDeselectAll={handleDeselectAllGroups}
                  />
                </>
              )}
            </>
          )}
        </ModalBody>
      </DynamicPopUp>
    );
  });

ImportContactBackupModal.displayName = "ImportContactBackupModal";
