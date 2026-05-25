// ImportAppDataModal.tsx

import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import { toast } from "sonner";
import styled from "styled-components";

import DynamicPopUp from "@/components/functional/DynamicPopUp";

import {
  ReceiptIcon,
  UsersThreeIcon,
  IdentificationBadgeIcon,
  GearIcon,
  WarningCircleIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { AppDataSnapshot } from "@majikah/majik-message/dist/core/backup/types";

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
`;

const SummaryBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  flex-wrap: wrap;
`;

const SummaryChip = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10.5px;
  color: ${({ theme }) => theme.colors.textPrimary};
  opacity: 0.75;

  span {
    font-family: ${({ theme }) => theme.typography.fonts.numbers};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const SummaryDot = styled.div`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  opacity: 0.25;
`;

// ── Section toggles ───────────────────────────────────────────────────────

const SectionList = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.primary}14;
  border-radius: 8px;
  overflow: hidden;
`;

const SectionRow = styled.div<{ $enabled: boolean; $unavailable: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0d;
  background: ${({ theme, $enabled }) =>
    $enabled ? `${theme.colors.primary}05` : "transparent"};
  cursor: ${({ $unavailable }) => ($unavailable ? "default" : "pointer")};
  opacity: ${({ $unavailable }) => ($unavailable ? 0.35 : 1)};
  transition: background 0.1s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme, $unavailable }) =>
      $unavailable ? "transparent" : theme.colors.primarySoft};
  }
`;

const SectionIcon = styled.div<{ $enabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: ${({ theme, $enabled }) =>
    $enabled ? `${theme.colors.primary}14` : `${theme.colors.primary}08`};
  color: ${({ theme, $enabled }) =>
    $enabled ? theme.colors.primary : theme.colors.textSecondary};
  flex-shrink: 0;
  transition:
    background 0.1s,
    color 0.1s;
`;

const SectionContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const SectionTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const SectionSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  margin-top: 1px;
`;

const SectionRight = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const CountBadge = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary}14;
  padding: 2px 7px;
  border-radius: 4px;
`;

const ToggleSwitch = styled.div<{ $active: boolean }>`
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary : `${theme.colors.primary}28`};
  position: relative;
  transition: background 0.15s;
  flex-shrink: 0;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${({ $active }) => ($active ? "16px" : "2px")};
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    transition: left 0.15s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
`;

// ── Sub-section for overwrite option ─────────────────────────────────────

const SubOption = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 8px 56px;
  background: ${({ theme }) => theme.colors.primarySoft}55;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0d;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }
`;

const SubOptionLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const SubOptionSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 9.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  margin-top: 1px;
`;

// ── Warning row ───────────────────────────────────────────────────────────

const WarningRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.error}0e;
  border: 1px solid ${({ theme }) => theme.colors.error}28;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.5;
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
// Types
// ---------------------------------------------------------------------------

interface ImportAppDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikMessageDatabase;
  /**
   * Parsed snapshot from readAppDataBackup().
   * The caller handles file picking + parsing, then passes the result here.
   */
  snapshot: AppDataSnapshot | null;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Section config helper
// ---------------------------------------------------------------------------

interface SectionDef {
  key: "chats" | "contacts" | "groups" | "preferences";
  label: string;
  sub: (snapshot: AppDataSnapshot) => string;
  icon: React.ReactNode;
  count: (snapshot: AppDataSnapshot) => number | null;
  available: (snapshot: AppDataSnapshot) => boolean;
}

const SECTIONS: SectionDef[] = [
  {
    key: "chats",
    label: "Chat Messages",
    icon: <ReceiptIcon size={16} />,
    sub: (s) =>
      s.chats?.length === 0
        ? "No chats in this backup"
        : `${s.chats?.length} invoice${s.chats?.length !== 1 ? "s" : ""} will be restored`,
    count: (s) =>
      s.chats ? (s.chats.length > 0 ? s.chats.length : null) : null,
    available: (s) => (s.chats ? s.chats.length > 0 : false),
  },
  {
    key: "contacts",
    label: "Contacts",
    icon: <IdentificationBadgeIcon size={16} />,
    sub: (s) =>
      s.contacts.length === 0
        ? "No contacts in this backup"
        : `${s.contacts.length} contact${s.contacts.length !== 1 ? "s" : ""} will be restored`,
    count: (s) => (s.contacts.length > 0 ? s.contacts.length : null),
    available: (s) => s.contacts.length > 0,
  },
  {
    key: "groups",
    label: "Contact Groups",
    icon: <UsersThreeIcon size={16} />,
    sub: (s) =>
      s.groups.length === 0
        ? "No groups in this backup"
        : `${s.groups.length} group${s.groups.length !== 1 ? "s" : ""} will be merged`,
    count: (s) => (s.groups.length > 0 ? s.groups.length : null),
    available: (s) => s.groups.length > 0,
  },

  {
    key: "preferences",
    label: "App Preferences",
    icon: <GearIcon size={16} />,
    sub: (s) =>
      s.preferences
        ? "Dashboard, privacy, and invoice preferences will be restored"
        : "No app preferences in this backup",
    count: () => null,
    available: (s) => !!s.preferences,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportAppDataModal: React.FC<ImportAppDataModalProps> = memo(
  ({ open, onOpenChange, majik, snapshot, onSuccess }) => {
    const [isImporting, setIsImporting] = useState(false);

    // Which sections are toggled on
    const [enabled, setEnabled] = useState<Record<string, boolean>>({});

    // Sub-option: overwrite existing contacts
    const [overwriteContacts, setOverwriteContacts] = useState(true);

    // ── Default all available sections to enabled on open ─────────────────
    useEffect(() => {
      if (open && snapshot) {
        const defaults: Record<string, boolean> = {};
        for (const s of SECTIONS) {
          defaults[s.key] = s.available(snapshot);
        }
        setEnabled(defaults);
        setOverwriteContacts(true);
      }
    }, [open, snapshot]);

    const toggle = useCallback((key: string) => {
      setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // Groups can only be on if contacts is also on
    const groupsEffectivelyEnabled = enabled["groups"] && enabled["contacts"];

    const anyEnabled = Object.values(enabled).some(Boolean);

    // ── Duplicate detection counts ─────────────────────────────────────────
    const duplicateCounts = useMemo(() => {
      if (!snapshot) return { contacts: 0, chats: 0 };
      return {
        contacts: snapshot.contacts.filter((c) => majik.getContactByID(c.id))
          .length,
        // chats: snapshot.chats?.filter((inv) => majik.hasInvoice(inv.id))
        //   .length,
      };
    }, [snapshot, majik]);

    const showOverwriteWarning =
      (enabled["contacts"] &&
        duplicateCounts.contacts > 0 &&
        overwriteContacts) ||
      (enabled["chats"] && duplicateCounts.chats && duplicateCounts.chats > 0);

    // ── Confirm ────────────────────────────────────────────────────────────
    const handleConfirm = useCallback(() => {
      if (!snapshot) return;

      const run = async (): Promise<string> => {
        setIsImporting(true);

        const result = await majik.restoreAppDataSelective(snapshot, {
          chatMessages: enabled["chats"],
          contacts: enabled["contacts"],
          groups: groupsEffectivelyEnabled,
          invoiceDefaults: enabled["invoiceDefaults"],
          preferences: enabled["preferences"],
          overwriteContacts,
        });

        const parts: string[] = [];
        if (result.chatMessages > 0)
          parts.push(
            `${result.chatMessages} invoice${result.chatMessages !== 1 ? "s" : ""}`,
          );
        if (result.contacts > 0)
          parts.push(
            `${result.contacts} contact${result.contacts !== 1 ? "s" : ""}`,
          );
        if (result.groups > 0)
          parts.push(`${result.groups} group${result.groups !== 1 ? "s" : ""}`);
        if (result.invoiceDefaults) parts.push("invoice settings");
        if (result.preferences) parts.push("app preferences");

        return parts.length > 0
          ? `Restored: ${parts.join(", ")}.`
          : "Nothing to restore.";
      };

      toast.promise(run(), {
        loading: "Restoring backup data…",
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
      snapshot,
      enabled,
      groupsEffectivelyEnabled,
      overwriteContacts,
      majik,
      onOpenChange,
      onSuccess,
    ]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    // ── Confirm button label ───────────────────────────────────────────────
    const confirmLabel = useMemo(() => {
      if (isImporting) return "Restoring…";
      if (!anyEnabled) return "Restore";
      const active = SECTIONS.filter(
        (s) => enabled[s.key] && snapshot && s.available(snapshot),
      );
      if (
        active.length ===
        SECTIONS.filter((s) => snapshot && s.available(snapshot)).length
      ) {
        return "Restore All";
      }
      return `Restore Selected (${active.length})`;
    }, [isImporting, anyEnabled, enabled, snapshot]);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Restore App Backup",
          description:
            "Choose which parts of the backup to restore. Unavailable sections are greyed out — they were not included in this backup file.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleCancel,
            isDisabled: isImporting,
          },
          confirm: {
            text: confirmLabel,
            isDisabled: !anyEnabled || isImporting,
            onClick: handleConfirm,
          },
        }}
      >
        <ModalBody>
          {!snapshot ? (
            <EmptyNotice>
              <ArrowCounterClockwiseIcon size={38} weight="thin" />
              <EmptyText>No backup data loaded.</EmptyText>
            </EmptyNotice>
          ) : (
            <>
              {/* ── Summary bar ── */}
              <SummaryBar>
                {!!snapshot.chats && snapshot.chats.length > 0 && (
                  <>
                    <SummaryChip>
                      <ReceiptIcon size={11} />
                      <span>{snapshot.chats?.length}</span> chats
                    </SummaryChip>
                    <SummaryDot />
                  </>
                )}
                {snapshot.contacts.length > 0 && (
                  <>
                    <SummaryChip>
                      <IdentificationBadgeIcon size={11} />
                      <span>{snapshot.contacts.length}</span> contacts
                    </SummaryChip>
                    <SummaryDot />
                  </>
                )}
                {snapshot.groups.length > 0 && (
                  <>
                    <SummaryChip>
                      <UsersThreeIcon size={11} />
                      <span>{snapshot.groups.length}</span> groups
                    </SummaryChip>
                    <SummaryDot />
                  </>
                )}

                {snapshot.preferences && (
                  <SummaryChip>
                    <GearIcon size={11} />
                    Preferences
                  </SummaryChip>
                )}
              </SummaryBar>

              {/* ── Section toggles ── */}
              <SectionList>
                {SECTIONS.map((section) => {
                  const unavailable = !section.available(snapshot);
                  const isOn = enabled[section.key] && !unavailable;
                  const count = section.count(snapshot);

                  // Groups row: visually dim if contacts is off
                  const dimmed =
                    section.key === "groups" &&
                    enabled["contacts"] === false &&
                    !unavailable;

                  return (
                    <React.Fragment key={section.key}>
                      <SectionRow
                        $enabled={isOn}
                        $unavailable={unavailable}
                        style={{ opacity: dimmed ? 0.45 : undefined }}
                        onClick={() => {
                          if (unavailable) return;
                          toggle(section.key);
                        }}
                      >
                        <SectionIcon $enabled={isOn}>
                          {section.icon}
                        </SectionIcon>
                        <SectionContent>
                          <SectionTitle>{section.label}</SectionTitle>
                          <SectionSub>
                            {section.sub(snapshot)}
                            {section.key === "groups" &&
                              !unavailable &&
                              enabled["contacts"] === false && (
                                <> · Enable Contacts to restore groups</>
                              )}
                          </SectionSub>
                        </SectionContent>
                        <SectionRight>
                          {count !== null && <CountBadge>{count}</CountBadge>}
                          {unavailable ? (
                            <WarningCircleIcon
                              size={15}
                              style={{ opacity: 0.4 }}
                            />
                          ) : (
                            <ToggleSwitch $active={isOn} />
                          )}
                        </SectionRight>
                      </SectionRow>

                      {/* ── Contacts sub-option: overwrite ── */}
                      {section.key === "contacts" &&
                        isOn &&
                        duplicateCounts.contacts > 0 && (
                          <SubOption
                            onClick={() => setOverwriteContacts((v) => !v)}
                          >
                            <div>
                              <SubOptionLabel>
                                Overwrite existing contacts
                              </SubOptionLabel>
                              <SubOptionSub>
                                {duplicateCounts.contacts} contact
                                {duplicateCounts.contacts !== 1 ? "s" : ""}{" "}
                                already exist
                                {overwriteContacts
                                  ? " — they will be replaced"
                                  : " — they will be skipped"}
                              </SubOptionSub>
                            </div>
                            <ToggleSwitch $active={overwriteContacts} />
                          </SubOption>
                        )}
                    </React.Fragment>
                  );
                })}
              </SectionList>

              {/* ── Overwrite warning ── */}
              {showOverwriteWarning && (
                <WarningRow>
                  <WarningCircleIcon
                    size={14}
                    style={{ marginTop: 1, flexShrink: 0 }}
                  />
                  <div>
                    {enabled["chats"] &&
                      !!duplicateCounts.chats &&
                      duplicateCounts.chats > 0 && (
                        <>
                          <strong>{duplicateCounts.chats}</strong> existing
                          invoice
                          {duplicateCounts.chats !== 1 ? "s" : ""} will be
                          overwritten.{" "}
                        </>
                      )}
                    {enabled["contacts"] &&
                      duplicateCounts.contacts > 0 &&
                      overwriteContacts && (
                        <>
                          <strong>{duplicateCounts.contacts}</strong> existing
                          contact
                          {duplicateCounts.contacts !== 1 ? "s" : ""} will be
                          overwritten.
                        </>
                      )}
                  </div>
                </WarningRow>
              )}
            </>
          )}
        </ModalBody>
      </DynamicPopUp>
    );
  },
);

ImportAppDataModal.displayName = "ImportAppDataModal";
