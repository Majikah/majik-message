"use client";

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  CheckIcon,
  PencilIcon,
  StarIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { MajikContact, MajikContactGroup } from "@majikah/majik-contact";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import CustomColorPicker from "@/components/foundations/CustomColorPicker";

import Fuse from "fuse.js";

const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";
const DEFAULT_GROUP_COLOR = "#ea7f05";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
const Drawer = styled.div`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-left: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
`;

const DrawerHeader = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
  background: linear-gradient(
    135deg,
    ${({ $color }) => `${$color}22`} 0%,
    transparent 60%
  );
`;

const GroupIconWrap = styled.div<{ $color: string }>`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: ${({ $color }) => `${$color}22`};
  border: 1px solid ${({ $color }) => `${$color}44`};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
`;

const GroupPhoto = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 9px;
`;

const HeaderMeta = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const GroupNameDisplay = styled.span`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const GroupMeta = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  letter-spacing: 0.04em;
`;

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 9px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: all 150ms ease;
  position: relative;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.45)};

  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 20%;
    right: 20%;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: ${({ theme }) => theme.colors.primary};
    opacity: ${({ $active }) => ($active ? 1 : 0)};
    transition: opacity 150ms ease;
  }

  &:hover {
    opacity: 1;
  }
`;

const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.colors.secondaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`;

// ─── Settings ─────────────────────────────────────────────────────────────────
const SettingsSection = styled.div`
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const FieldLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const FieldInput = styled.input`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  transition: border-color 150ms ease;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const FieldTextarea = styled.textarea`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  resize: none;
  min-height: 64px;
  line-height: 1.5;
  transition: border-color 150ms ease;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const PhotoUploadRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const PhotoPreview = styled.div<{ $color: string }>`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: ${({ $color }) => `${$color}22`};
  border: 1px solid ${({ $color }) => `${$color}44`};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
`;

const PhotoPreviewImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PhotoUploadBtn = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 150ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const PhotoClearBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 150ms ease;
  opacity: 0.6;

  &:hover {
    opacity: 1;
    border-color: ${({ theme }) => theme.colors.error};
    color: ${({ theme }) => theme.colors.error};
  }
`;

const SaveButton = styled.button<{ $disabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: ${({ $disabled, theme }) =>
    $disabled ? theme.colors.secondaryBackground : theme.colors.primary};
  color: ${({ $disabled }) => ($disabled ? "rgba(255,255,255,0.3)" : "#fff")};
  font-size: 13px;
  font-weight: 600;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  transition: all 150ms ease;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }
`;

const DangerZone = styled.div`
  padding: 12px 16px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

const DangerLabel = styled.p`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.error};
  opacity: 0.6;
  margin: 0 0 8px;
`;

const DeleteGroupBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.error};
  cursor: pointer;
  opacity: 0.7;
  transition: all 150ms ease;

  &:hover {
    opacity: 1;
    border-color: ${({ theme }) => theme.colors.error};
    background: rgba(248, 113, 113, 0.08);
  }
`;

// ─── Members ──────────────────────────────────────────────────────────────────
const MembersSearchRow = styled.div`
  padding: 10px 12px 8px;
  position: sticky;
  top: 0;
  z-index: 5;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground}55;
`;

const SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  transition: border-color 150ms ease;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.4;
  }
  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const MemberRow = styled.div<{ $isMember: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 120ms ease;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground}33;

  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const MemberAvatar = styled.div<{ $color: string }>`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: ${({ $color }) => `${$color}22`};
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  flex-shrink: 0;
`;

const MemberInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const MemberName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MemberFp = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

const MemberToggle = styled.button<{ $isMember: boolean; $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid
    ${({ $isMember, $color }) => ($isMember ? $color : "rgba(255,255,255,0.1)")};
  background: ${({ $isMember, $color }) =>
    $isMember ? `${$color}22` : "transparent"};
  color: ${({ $isMember, $color, theme }) =>
    $isMember ? $color : theme.colors.textSecondary};
  cursor: pointer;
  transition: all 120ms ease;
  flex-shrink: 0;
  opacity: ${({ $isMember }) => ($isMember ? 1 : 0.45)};

  &:hover {
    opacity: 1;
    border-color: ${({ $isMember, $color, theme }) =>
      $isMember ? theme.colors.error : $color};
    background: ${({ $isMember, $color }) =>
      $isMember ? "rgba(248,113,113,0.12)" : `${$color}1a`};
    color: ${({ $isMember, theme }) =>
      $isMember ? theme.colors.error : theme.colors.textPrimary};
  }
`;

const EmptyMembers = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  font-size: 12px;
`;

type SearchableContact = {
  contact: MajikContact;
  label: string;
  publicKey: string;
  publicKeyPrefix: string;
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface GroupManagerDrawerProps {
  group: MajikContactGroup;
  majik: MajikMessageDatabase;
  allContacts: MajikContact[];
  onClose?: () => void;
  onUpdate: () => void;
}

type DrawerTab = "members" | "settings";

// ─── Component ────────────────────────────────────────────────────────────────
const GroupManagerDrawer: React.FC<GroupManagerDrawerProps> = ({
  group,
  majik,
  allContacts = [],
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>("members");
  const [memberSearch, setMemberSearch] = useState("");

  const [editName, setEditName] = useState(group.meta.name);
  const [editDescription, setEditDescription] = useState(
    group?.meta?.description,
  );
  const [editColor, setEditColor] = useState<string[]>([
    group?.meta?.color || DEFAULT_GROUP_COLOR,
  ]);
  const [editPhotoBase64, setEditPhotoBase64] = useState<string | null>(
    group.meta.photoBase64,
  );
  const [isSaving, setIsSaving] = useState(false);

  const groupColor = group?.meta?.color || DEFAULT_GROUP_COLOR;
  const isSystem = group.isSystem;
  const isFavorites = group.isFavorites();

  const memberIds = useMemo(
    () => new Set(group.listMemberIds()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group, group.memberCount()],
  );

  const [contactLabels, setContactLabels] = useState<Record<string, string>>(
    {},
  );

  // Resolve contact labels
  useEffect(() => {
    let cancelled = false;
    const resolveLabels = async (): Promise<void> => {
      const unresolved = allContacts.filter((c) => contactLabels[c.id] == null);
      if (unresolved.length === 0) return;
      const entries = await Promise.all(
        unresolved.map(async (contact) => {
          const pk = await contact.getPublicKeyBase64();
          return [contact.id, pk] as const;
        }),
      );
      if (!cancelled) {
        setContactLabels((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      }
    };
    resolveLabels();
    return () => {
      cancelled = true;
    };
  }, [allContacts, contactLabels]);

  const getContactDisplayWithKey = (
    contact: MajikContact,
  ): { label: string; showKey: boolean; publicKey: string } => {
    const label = contact.meta.label || contactLabels[contact.id] || "…";
    const publicKey = contactLabels[contact.id] || "";
    const showKey = !!(
      contact.meta.label &&
      contact.meta.label !== publicKey &&
      publicKey
    );
    return { label, showKey, publicKey };
  };

  const normalize = (v: string): string =>
    v.toLowerCase().replace(/[^a-z0-9]/g, "");

  // ── Contact search ──────────────────────────────────────────────────────────

  const searchableContacts = useMemo<SearchableContact[]>(() => {
    return allContacts.map((contact) => {
      const pk = contactLabels[contact.id] ?? "";
      const normalizedPk = normalize(pk);
      return {
        contact,
        label: contact.meta.label ?? "",
        publicKey: normalizedPk,
        publicKeyPrefix: normalizedPk.slice(0, 32),
      };
    });
  }, [allContacts, contactLabels]);

  const contactFuse = useMemo(
    () =>
      new Fuse(searchableContacts, {
        keys: [
          { name: "label", weight: 0.7 },
          { name: "publicKeyPrefix", weight: 0.3 },
        ],
        threshold: 0.45,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 1,
        useExtendedSearch: false,
        ignoreFieldNorm: true,
      }),
    [searchableContacts],
  );

  const normalizedQuery = useMemo(
    () => normalize(memberSearch),
    [memberSearch],
  );

  const filteredContacts = useMemo(() => {
    if (!normalizedQuery) {
      return searchableContacts.map((s) => s.contact);
    }

    return contactFuse.search(normalizedQuery).map((r) => r.item.contact);
  }, [normalizedQuery, contactFuse, searchableContacts]);

  const handleToggleMember = (contact: MajikContact): void => {
    try {
      if (memberIds.has(contact.id)) {
        majik.removeContactFromGroup(group.id, contact.id);
        toast.success(`Removed from ${group.meta.name}`, {
          description: contact.meta?.label || contact.id,
          id: `grp-rm-${contact.id}`,
        });
      } else {
        majik.addContactToGroup(group.id, contact.id);
        toast.success(`Added to ${group.meta.name}`, {
          description: contact.meta?.label || contact.id,
          id: `grp-add-${contact.id}`,
        });
      }
      onUpdate();
    } catch (err) {
      toast.error("Failed to update membership", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || String(err),
      });
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditPhotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (): Promise<void> => {
    const trimmedName = editName.trim();
    if (!trimmedName && !isSystem) {
      toast.error("Group name is required");
      return;
    }
    setIsSaving(true);
    try {
      const newColor =
        (editColor[0] ?? group?.meta?.color) || DEFAULT_GROUP_COLOR;

      if (newColor !== group?.meta?.color) {
        majik.updateGroupMeta(group.id, { color: newColor });
      }

      if (!isSystem && trimmedName !== group.meta.name) {
        majik.updateGroupMeta(group.id, { name: trimmedName });
      }
      // Always update description (it carries the color)
      if (editDescription !== group.meta.description) {
        majik.updateGroupMeta(group.id, { description: editDescription });
      }
      if (editPhotoBase64 !== group.meta.photoBase64) {
        const updatedGroup = majik.getGroupOrThrow(group.id);
        if (editPhotoBase64) {
          await updatedGroup.setPhoto(editPhotoBase64);
        } else {
          updatedGroup.clearPhoto();
        }
        majik["scheduleAutosave"]?.();
      }
      onUpdate();
      toast.success("Group updated", { id: `grp-save-${group.id}` });
    } catch (err) {
      toast.error("Failed to save group settings", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || String(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = (): void => {
    try {
      majik.removeGroup(group.id);
      onUpdate();
      toast.success(`Group "${group.meta.name}" deleted`);
    } catch (err) {
      toast.error("Failed to delete group", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || String(err),
      });
    }
  };

  const settingsDirty =
    (!isSystem && editName.trim() !== group.meta.name) ||
    editDescription !== group.meta.description ||
    editColor[0] !== group.meta.color ||
    editPhotoBase64 !== group.meta.photoBase64;

  return (
    <Drawer onClick={(e) => e.stopPropagation()}>
      {/* ── Header ── */}
      <DrawerHeader $color={groupColor}>
        <GroupIconWrap $color={groupColor}>
          {editPhotoBase64 ? (
            <GroupPhoto src={editPhotoBase64} alt={group.meta.name} />
          ) : isFavorites ? (
            <StarIcon size={18} weight="fill" color={groupColor} />
          ) : (
            <UsersThreeIcon size={18} color={groupColor} />
          )}
        </GroupIconWrap>
        <HeaderMeta>
          <GroupNameDisplay>{group.meta.name}</GroupNameDisplay>
          <GroupMeta>
            {group.memberCount()} member{group.memberCount() !== 1 ? "s" : ""}
            {isSystem ? " · system" : ""}
          </GroupMeta>
        </HeaderMeta>
      </DrawerHeader>

      {/* ── Tabs ── */}
      <TabBar>
        <Tab
          $active={activeTab === "members"}
          onClick={() => setActiveTab("members")}
        >
          Members
        </Tab>
        <Tab
          $active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </Tab>
      </TabBar>

      {/* ── Body ── */}
      <DrawerBody>
        {activeTab === "members" && (
          <>
            <MembersSearchRow>
              <SearchInput
                placeholder="Type name or public key…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                autoFocus
              />
            </MembersSearchRow>

            {filteredContacts.length === 0 ? (
              <EmptyMembers>
                <UsersThreeIcon size={28} />
                No contacts to show
              </EmptyMembers>
            ) : (
              filteredContacts.map((contact) => {
                const isMember = memberIds.has(contact.id);

                const displayLabels = getContactDisplayWithKey(contact);
                const displayName = displayLabels.label || "Unknown";
                const cColor = `hsl(${[...displayName].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 50%, 54%)`;
                return (
                  <MemberRow
                    key={contact.id}
                    $isMember={isMember}
                    onClick={() => handleToggleMember(contact)}
                  >
                    <MemberAvatar $color={cColor} data-private>
                      {getInitials(displayName)}
                    </MemberAvatar>
                    <MemberInfo>
                      <MemberName data-private>{displayName}</MemberName>
                      <MemberFp data-private>
                        {displayLabels.publicKey}
                      </MemberFp>
                    </MemberInfo>
                    <MemberToggle
                      $isMember={isMember}
                      $color={groupColor}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMember(contact);
                      }}
                      title={isMember ? "Remove from group" : "Add to group"}
                    >
                      {isMember ? (
                        <UserMinusIcon size={13} weight="bold" />
                      ) : (
                        <UserPlusIcon size={13} weight="bold" />
                      )}
                    </MemberToggle>
                  </MemberRow>
                );
              })
            )}
          </>
        )}

        {activeTab === "settings" && (
          <>
            <SettingsSection>
              {/* Photo */}
              <FieldLabel>
                Group Photo
                <PhotoUploadRow>
                  <PhotoPreview $color={groupColor}>
                    {editPhotoBase64 ? (
                      <PhotoPreviewImg
                        src={editPhotoBase64}
                        alt="Group photo"
                      />
                    ) : isFavorites ? (
                      <StarIcon size={20} weight="fill" color={groupColor} />
                    ) : (
                      <UsersThreeIcon size={20} color={groupColor} />
                    )}
                  </PhotoPreview>
                  <PhotoUploadBtn>
                    <PencilIcon size={11} />
                    Upload photo
                    <HiddenFileInput
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                  </PhotoUploadBtn>
                  {editPhotoBase64 && (
                    <PhotoClearBtn
                      onClick={() => setEditPhotoBase64(null)}
                      title="Remove photo"
                    >
                      <XIcon size={10} weight="bold" />
                      Clear
                    </PhotoClearBtn>
                  )}
                </PhotoUploadRow>
              </FieldLabel>

              {/* Color — available for both system and user groups */}
              <FieldLabel>
                Group Color
                <CustomColorPicker
                  currentValue={editColor}
                  max={1}
                  defaultColor={group.meta.color}
                  onUpdate={(colors) => setEditColor(colors)}
                />
              </FieldLabel>

              {/* Name — locked for system groups */}
              <FieldLabel>
                Group Name
                <FieldInput
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={64}
                  disabled={isSystem}
                  placeholder="Group name…"
                />
              </FieldLabel>

              {/* Description */}
              <FieldLabel>
                Description
                <FieldTextarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={200}
                  placeholder="Optional description…"
                  rows={3}
                />
              </FieldLabel>

              <SaveButton
                $disabled={!settingsDirty || isSaving}
                disabled={!settingsDirty || isSaving}
                onClick={handleSaveSettings}
              >
                <CheckIcon size={14} weight="bold" />
                {isSaving ? "Saving…" : "Save Changes"}
              </SaveButton>
            </SettingsSection>

            {!isSystem && (
              <DangerZone>
                <DangerLabel>Danger zone</DangerLabel>
                <DeleteGroupBtn onClick={handleDeleteGroup}>
                  <TrashIcon size={13} />
                  Delete group
                </DeleteGroupBtn>
              </DangerZone>
            )}
          </>
        )}
      </DrawerBody>
    </Drawer>
  );
};

export default GroupManagerDrawer;
