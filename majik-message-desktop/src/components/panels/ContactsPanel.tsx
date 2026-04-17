import styled from "styled-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PopUpFormButton from "@/components/foundations/PopUpFormButton";
import {
  HandshakeIcon,
  KeyboardIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  SquaresFourIcon,
  StarIcon,
  UploadSimpleIcon,
  UserIcon,
  UserPlusIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import CustomInputField from "@/components/foundations/CustomInputField";
import { toast } from "sonner";
import CBaseUserAccount from "../base/CBaseUserAccount";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import GuideHelper from "@/components/functional/GuideHelper";
import { useShepherd } from "@/lib/shepherd-js/use-shepherd";
import { launchTutorialContacts } from "@/lib/shepherd-js/tutorials/tutorial-contacts";
import ContactRow from "../base/ContactRow";
import UserContactInvitations from "../functional/UserContactInvitations";
import { MajikContact, MajikContactGroup } from "@majikah/majik-contact";
import GroupManagerDrawer from "../functional/GroupManagerDrawer";
import DynamicSlidingDialogue from "../functional/DynamicSlidingDialogue";
import CustomColorPicker from "@/components/foundations/CustomColorPicker";
import DropImportContact from "../foundations/DropImportContact";
import { MajikBytes } from "@majikah/majik-bytes";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_CONTACTS_LIMIT = 1000;
const MAX_GROUPS_LIMIT = 100;
const LIST_DEFAULT_THRESHOLD = 10;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
const DEFAULT_GROUP_COLOR = "#ea7f05";

type ViewMode = "grid" | "list";

// ─── Layout ───────────────────────────────────────────────────────────────────
const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

// ─── Panel header ─────────────────────────────────────────────────────────────
const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const PanelSubtitle = styled.p`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.5;
  letter-spacing: 0.03em;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

// ─── View toggle ──────────────────────────────────────────────────────────────
const ViewToggle = styled.div`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  padding: 2px;
  gap: 2px;

  @media (max-width: 640px) {
    display: none;
  }
`;

const ToggleBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primaryBackground : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.5)};

  &:hover {
    opacity: 1;
    color: ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.textPrimary};
  }
`;

const LimitBadge = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 100px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  white-space: nowrap;
`;

// ─── Groups strip ─────────────────────────────────────────────────────────────
const GroupsStrip = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

/**
 * Each chip now has two visually distinct zones:
 *   - left side (label + dot + count): clicking this FILTERS
 *   - right side (pencil button): clicking this MANAGES
 *
 * The pencil zone has a subtle background on hover so users
 * immediately learn the affordance.
 */
const GroupChip = styled.button<{
  $color: string;
  $active: boolean;
  $isSystem: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 0;
  border-radius: 100px;
  border: 1px solid
    ${({ $active, $color }) => ($active ? $color : "rgba(255,255,255,0.08)")};
  background: ${({ $active, $color }) =>
    $active ? `${$color}22` : "transparent"};
  cursor: pointer;
  white-space: nowrap;
  transition: all 150ms ease;
  flex-shrink: 0;
  overflow: hidden;

  &:hover {
    border-color: ${({ $color }) => $color};
    background: ${({ $color }) => `${$color}14`};
  }
`;

// Left clickable zone — filter toggle
const ChipFilterZone = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 8px;
`;

const ChipDot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const ChipLabel = styled.span<{ $active: boolean; $color: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${({ $active, $color, theme }) =>
    $active ? $color : theme.colors.textSecondary};
  transition: color 150ms ease;
`;

const ChipCount = styled.span<{ $color: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 700;
  color: ${({ $color }) => $color};
  opacity: 0.7;
`;

/**
 * Right-side manage zone — visually separated with a divider line.
 * This makes it unmistakably a separate action from the filter tap.
 */
const ChipManageZone = styled.div<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 5px 8px;
  border-left: 1px solid ${({ $color }) => `${$color}33`};
  transition: background 150ms ease;

  &:hover {
    background: ${({ $color }) => `${$color}25`};

    svg {
      opacity: 1;
    }
  }

  svg {
    opacity: 0.45;
    transition: opacity 150ms ease;
  }
`;

const ChipManageLabel = styled.span<{ $color: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: ${({ $color }) => $color};
  opacity: 0.6;
  margin-left: 3px;
  transition: opacity 150ms ease;

  ${ChipManageZone}:hover & {
    opacity: 1;
  }
`;

// Active group filter banner
const FilterBanner = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  background: ${({ $color }) => `${$color}12`};
  border-bottom: 1px solid ${({ $color }) => `${$color}25`};
  flex-shrink: 0;
`;

const FilterLabel = styled.span<{ $color: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${({ $color }) => $color};
  flex: 1;
`;

const FilterClearBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  border-radius: 4px;
  transition: opacity 150ms ease;
  padding: 0;

  &:hover {
    opacity: 1;
  }
`;

// ─── Group creation form ──────────────────────────────────────────────────────
const CreateGroupForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const CreateGroupLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
`;

// ─── Scrollable body ──────────────────────────────────────────────────────────
const BodyWrapper = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
`;

const Body = styled.div<{ $isListView: boolean }>`
  flex: 1;
  overflow-y: auto;
  padding: ${({ $isListView }) => ($isListView ? "0" : "16px 18px 24px")};

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

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const AlphaSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const AlphaHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 18px 5px;
  background: ${({ theme }) => theme.colors.primaryBackground}f0;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground}66;
`;

const AlphaLetter = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
`;

const AlphaCount = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  letter-spacing: 0.04em;
`;

const AlphaScrollbar = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  z-index: 20;
  gap: 1px;
  user-select: none;

  @media (max-width: 640px) {
    width: 16px;
  }
`;

const AlphaScrollBtn = styled.button<{ $active: boolean; $hasItems: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  cursor: ${({ $hasItems }) => ($hasItems ? "pointer" : "default")};
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0;
  border-radius: 4px;
  transition: all 100ms ease;
  color: ${({ $active, $hasItems, theme }) =>
    $active
      ? theme.colors.primary
      : $hasItems
        ? theme.colors.textSecondary
        : theme.colors.textSecondary};
  opacity: ${({ $hasItems, $active }) =>
    $active ? 1 : $hasItems ? 0.55 : 0.18};
  background: ${({ $active, theme }) =>
    $active ? `${theme.colors.primary}22` : "transparent"};

  &:hover {
    opacity: ${({ $hasItems }) => ($hasItems ? 1 : 0.18)};
    background: ${({ $hasItems, theme }) =>
      $hasItems ? `${theme.colors.primary}15` : "transparent"};
    color: ${({ $hasItems, theme }) =>
      $hasItems ? theme.colors.primary : theme.colors.textSecondary};
  }
`;

const AlphaBubble = styled.div<{ $visible: boolean }>`
  position: absolute;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 18px;
  font-weight: 700;
  pointer-events: none;
  z-index: 30;
  transition: opacity 200ms ease;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 24px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

const EmptyTitle = styled.p`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const EmptyHint = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  max-width: 220px;
  line-height: 1.55;
  opacity: 0.6;
`;

// ─── Import mode toggle ───────────────────────────────────────────────────────
const ImportModeToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
`;

const ModeToggleButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.secondaryBackground};
  background: ${({ theme, $active }) =>
    $active ? `${theme.colors.primary}18` : theme.colors.secondaryBackground};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  letter-spacing: 0.02em;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface ContactsPanelProps {
  majik: MajikMessageDatabase;
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void;
}

function getContactLetter(label: string): string {
  const first = (label || "?").trim()[0]?.toUpperCase();
  return /[A-Z]/.test(first ?? "") ? (first ?? "#") : "#";
}

// ─── Component ────────────────────────────────────────────────────────────────
const ContactsPanel: React.FC<ContactsPanelProps> = ({ majik, onUpdate }) => {
  const tour = useShepherd();
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [inviteKey, setInviteKey] = useState<string>("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Groups state ───────────────────────────────────────────────────────────
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [managingGroup, setManagingGroup] = useState<MajikContactGroup | null>(
    null,
  );
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [newGroupColor, setNewGroupColor] = useState<string[]>([
    DEFAULT_GROUP_COLOR,
  ]);
  const [isGroupDrawerOpen, setIsGroupDrawerOpen] = useState(false);

  // ── Import mode: "drop" | "manual" ────────────────────────────────────────
  const [importMode, setImportMode] = useState<"drop" | "manual">("drop");

  // ── Contacts ───────────────────────────────────────────────────────────────
  const contacts = useMemo(() => {
    if (!majik) return [];
    return majik.listContacts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  // ── Groups ─────────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    if (!majik) return [];
    const favorites = majik.getFavoritesGroup();
    const user = majik.listUserGroups(true);
    return [favorites, ...user];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  const activeGroup = useMemo(
    () =>
      activeGroupId
        ? (groups.find((g) => g.id === activeGroupId) ?? null)
        : null,
    [groups, activeGroupId],
  );

  const displayedContacts = useMemo(() => {
    if (!activeGroupId || !activeGroup) return contacts;
    const memberIds = new Set(activeGroup.listMemberIds());
    return contacts.filter((c) => memberIds.has(c.id));
  }, [contacts, activeGroupId, activeGroup]);

  const defaultView: ViewMode =
    contacts.length > LIST_DEFAULT_THRESHOLD ? "list" : "grid";
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);

  useEffect(() => {
    setViewMode(contacts.length > LIST_DEFAULT_THRESHOLD ? "list" : "grid");
  }, [contacts.length]);

  const grouped = useMemo(() => {
    const sorted = [...displayedContacts].sort((a, b) =>
      (a.meta?.label || "")
        .toLowerCase()
        .localeCompare((b.meta?.label || "").toLowerCase()),
    );
    const map: Record<string, typeof contacts> = {};
    for (const c of sorted) {
      const letter = getContactLetter(c.meta?.label || "");
      if (!map[letter]) map[letter] = [];
      map[letter].push(c);
    }
    return map;
  }, [displayedContacts]);

  const presentLetters = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  useEffect(() => {
    if (!majik) return;
    const handler = (): void => {
      setRefreshKey((prev) => prev + 1);
      onUpdate?.(majik);
    };
    majik.on("new-contact", handler);
    majik.on("removed-contact", handler);
    majik.on("new-contact-group", handler);
    majik.on("removed-contact-group", handler);
    majik.on("contact-group-change", handler);
    return () => {
      majik.off("new-contact", handler);
      majik.off("removed-contact", handler);
      majik.off("new-contact-group", handler);
      majik.off("removed-contact-group", handler);
      majik.off("contact-group-change", handler);
    };
  }, [majik]);

  // ── Group handlers ─────────────────────────────────────────────────────────
  const handleGroupChipClick = (groupId: string): void => {
    setActiveGroupId((prev) => (prev === groupId ? null : groupId));
  };

  const handleOpenGroupManager = (
    e: React.MouseEvent,
    group: MajikContactGroup,
  ): void => {
    e.stopPropagation();
    setManagingGroup(group);
    setIsGroupDrawerOpen(true);
  };

  const handleCreateGroup = async (): Promise<void> => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      toast.error("Group name required");
      return;
    }
    try {
      const id = `group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const color = newGroupColor[0] ?? DEFAULT_GROUP_COLOR;
      // Store color in description using our encoding scheme
      majik.createGroup(id, trimmed, {
        color: color,
      });
      setNewGroupName("");
      setNewGroupColor([DEFAULT_GROUP_COLOR]);
      setRefreshKey((prev) => prev + 1);
      toast.success(`Group "${trimmed}" created`);
    } catch (err) {
      toast.error("Failed to create group", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || String(err),
      });
    }
  };

  // ── Contact handlers ───────────────────────────────────────────────────────
  const handleAddContact = async (): Promise<void> => {
    if (!inviteKey?.trim()) {
      toast.error("Invalid Invite Key", {
        description: "Please provide a valid invite key.",
        id: `toast-error-add-${inviteKey}`,
      });
      return;
    }
    try {
      const importResponse = await majik.importContactFromString(inviteKey);
      if (!importResponse.success) {
        toast.error("Failed to Add New Contact", {
          description: importResponse.message,
          id: "error-majik-add",
        });
        return;
      }
      setRefreshKey((prev) => prev + 1);
      toast.success("New Contact Added Successfully", {
        description: inviteKey,
        id: `toast-success-add-${inviteKey}`,
      });
    } catch (e) {
      toast.error("Failed to Add New Contact", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: "error-majik-add",
      });
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      majik.removeContact(id);
      onUpdate?.(majik);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to Delete Contact", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: "error-majik-delete",
      });
    }
  };

  const handleEditLabel = async (
    id: string,
    newName: string,
  ): Promise<void> => {
    try {
      majik.updateContactMeta(id, { label: newName });
      toast.success("Display Name Updated", {
        description: `Display name for ${id} updated successfully.`,
        id: "success-majik-message-account-label-update",
      });
      onUpdate?.(majik);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Update Failed", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: "error-majik-message-account-edit",
      });
    }
  };

  const handleDownloadCard = async (input: MajikContact): Promise<void> => {
    const s = await majik.exportContactAsString(input.id);
    if (!s) {
      toast.error("Failed to download", {
        id: `toast-error-download-${input.id}`,
      });
      return;
    }

    try {
      const majikByte = await MajikBytes.create(s);

      const mbyteFile = await majikByte.toPNG();

      const defaultName = `${input?.meta?.label || input.id} - Contact Card PNG`;

      // Open the native save dialog
      const filePath = await save({
        defaultPath: defaultName,
        filters: [
          {
            name: "Contact Card PNG",
            extensions: ["png"],
          },
        ],
      });

      // User cancelled the dialog
      if (!filePath) {
        toast.info("Contact Card export cancelled", {
          id: `toast-info-download-${input.id}`,
        });
        return;
      } else {
        // Convert blob → Uint8Array and write to the chosen path
        const arrayBuffer = await mbyteFile.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }

      toast.success("Contact Card exported successfully", {
        id: `toast-success-download-${input.id}`,
      });
    } catch (err) {
      toast.error("Failed to copy", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: `toast-error-share-${input.id}`,
      });
    }
  };

  const scrollToLetter = useCallback(
    (letter: string) => {
      if (!grouped[letter]) return;
      const el = sectionRefs.current[letter];
      if (el && bodyRef.current) {
        bodyRef.current.scrollTo({ top: el.offsetTop, behavior: "smooth" });
      }
      setActiveLetter(letter);
      setBubbleVisible(true);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => {
        setBubbleVisible(false);
        setActiveLetter(null);
      }, 800);
    },
    [grouped],
  );

  // ── Drop import handlers ───────────────────────────────────────────────────
  const handleDropFileLoaded = (input: string): void => {
    setInviteKey(input);
  };

  const handleDropClear = (): void => {
    setInviteKey("");
  };

  const atLimitContact = contacts.length >= MAX_CONTACTS_LIMIT;
  const atLimitGroup = groups.length >= MAX_GROUPS_LIMIT;
  const isListView = viewMode === "list";
  const activeGroupColor = activeGroup?.meta?.color || "#ea7f05";

  return (
    <Root id="section-contacts">
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-message/docs/contacts-documentation"
        startTour={() => launchTutorialContacts(tour)}
      />

      {/* ── Header ── */}
      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>Contacts</PanelTitle>
          <PanelSubtitle>
            {contacts.length} / {MAX_CONTACTS_LIMIT} contacts
          </PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          {atLimitContact && <LimitBadge>Limit reached</LimitBadge>}

          {contacts.length > 0 && (
            <ViewToggle>
              <ToggleBtn
                $active={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <SquaresFourIcon size={14} />
              </ToggleBtn>
              <ToggleBtn
                $active={viewMode === "list"}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <ListIcon size={14} />
              </ToggleBtn>
            </ViewToggle>
          )}

          <PopUpFormButton
            scrollable
            id="button-popup-contacts-invites"
            icon={HandshakeIcon}
            text="Manage Invites"
            modal={{
              title: "Manage Invites",
              description: "View and manage your contact invites.",
            }}
            buttons={{
              cancel: { text: "Go Back" },
              confirm: { text: "Save Changes", hide: true },
            }}
          >
            <UserContactInvitations majik={majik} />
          </PopUpFormButton>

          <PopUpFormButton
            id="button-popup-contacts-add"
            icon={UserPlusIcon}
            text="Add Contact"
            modal={{
              title: "Add Contact",
              description: "Add a new contact to your list.",
            }}
            buttons={{
              cancel: { text: "Cancel" },
              confirm: { text: "Save Changes", onClick: handleAddContact },
            }}
          >
            {/* Mode toggle */}
            <ImportModeToggle>
              <ModeToggleButton
                $active={importMode === "drop"}
                onClick={() => {
                  setImportMode("drop");
                  handleDropClear();
                }}
                type="button"
              >
                <UploadSimpleIcon size={12} />
                Backup file
              </ModeToggleButton>
              <ModeToggleButton
                $active={importMode === "manual"}
                onClick={() => {
                  setImportMode("manual");
                  handleDropClear();
                }}
                type="button"
              >
                <KeyboardIcon size={12} />
                Enter manually
              </ModeToggleButton>
            </ImportModeToggle>

            {/* Drop zone */}
            {importMode === "drop" && (
              <DropImportContact
                inviteKey={inviteKey}
                onFileLoaded={handleDropFileLoaded}
                onClear={handleDropClear}
              />
            )}

            {/* Manual input (existing flow) */}
            {importMode === "manual" && (
              <CustomInputField
                currentValue={inviteKey}
                onChange={(e) => setInviteKey(e)}
                maxChar={10000}
                label="Invite Key"
                required
                importProp={{ type: "txt" }}
                sensitive={true}
              />
            )}
          </PopUpFormButton>
        </HeaderActions>
      </PanelHeader>

      {/* ── Groups strip ── */}
      <GroupsStrip id="section-contact-groups">
        {groups.map((group, index) => {
          const color = group.meta?.color || DEFAULT_GROUP_COLOR;
          const isActive = activeGroupId === group.id;
          const memberCount = group.memberCount();
          return (
            <GroupChip
              key={group.id}
              $color={color}
              $active={isActive}
              $isSystem={group.isSystem}
              // Chip itself has no onClick — zones handle interaction
              onClick={undefined}
              id={`button-contact-groups-item-${index}`}
            >
              {/* Filter zone */}
              <ChipFilterZone onClick={() => handleGroupChipClick(group.id)}>
                {group.isFavorites() ? (
                  <StarIcon size={9} weight="fill" color={color} />
                ) : (
                  <ChipDot $color={color} />
                )}
                <ChipLabel $active={isActive} $color={color}>
                  {group.meta.name}
                </ChipLabel>
                <ChipCount $color={color}>{memberCount}</ChipCount>
              </ChipFilterZone>

              {/* Manage zone — always visible, labeled, never ambiguous */}
              <ChipManageZone
                $color={color}
                onClick={(e) => handleOpenGroupManager(e, group)}
                title={`Manage ${group.meta.name}`}
                id={`button-contact-groups-manage-${index}`}
              >
                <PencilIcon size={9} weight="bold" color={color} />
                <ChipManageLabel $color={color}>EDIT</ChipManageLabel>
              </ChipManageZone>
            </GroupChip>
          );
        })}

        {/* Create new group */}
        <PopUpFormButton
          id="button-popup-contacts-create-group"
          scrollable={false}
          icon={PlusIcon}
          text="New Group"
          modal={{
            title: "Create Group",
            description: atLimitGroup
              ? "Limit reached. Only 100 groups are allowed."
              : "Create a new contact group.",
          }}
          buttons={{
            cancel: { text: "Cancel" },
            confirm: {
              text: "Create",
              onClick: handleCreateGroup,
              isDisabled: !newGroupName.trim(),
            },
          }}
          disabled={atLimitGroup}
        >
          <CreateGroupForm>
            <CustomInputField
              currentValue={newGroupName}
              onChange={(e) => setNewGroupName(e)}
              maxChar={64}
              label="Group Name"
              required
            />
            <CreateGroupLabel>
              Group Color
              <CustomColorPicker
                currentValue={newGroupColor}
                max={1}
                defaultColor={DEFAULT_GROUP_COLOR}
                onUpdate={(colors) => setNewGroupColor(colors)}
              />
            </CreateGroupLabel>
          </CreateGroupForm>
        </PopUpFormButton>
      </GroupsStrip>

      {/* ── Active group filter banner ── */}
      {activeGroup && (
        <FilterBanner $color={activeGroupColor}>
          <UsersThreeIcon size={12} color={activeGroupColor} />
          <FilterLabel $color={activeGroupColor}>
            {activeGroup.meta.name} · {displayedContacts.length} member
            {displayedContacts.length !== 1 ? "s" : ""}
          </FilterLabel>
          <FilterClearBtn
            onClick={() => setActiveGroupId(null)}
            title="Clear filter"
          >
            <XIcon size={12} weight="bold" />
          </FilterClearBtn>
        </FilterBanner>
      )}

      {/* ── Body ── */}
      <BodyWrapper>
        <Body $isListView={isListView} ref={bodyRef}>
          {displayedContacts.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                {activeGroup ? (
                  <UsersThreeIcon size={22} />
                ) : (
                  <UserIcon size={22} />
                )}
              </EmptyIcon>
              <EmptyTitle>
                {activeGroup
                  ? `No members in ${activeGroup.meta.name}`
                  : "No contacts yet"}
              </EmptyTitle>
              <EmptyHint>
                {activeGroup
                  ? "Open the group manager to add contacts."
                  : "You haven't added any contacts yet."}
              </EmptyHint>
            </EmptyState>
          ) : isListView ? (
            <>
              {presentLetters.map((letter) => {
                const items = grouped[letter] ?? [];
                return (
                  <AlphaSection
                    key={letter}
                    ref={(el) => {
                      sectionRefs.current[letter] = el;
                    }}
                  >
                    <AlphaHeader>
                      <AlphaLetter>{letter}</AlphaLetter>
                      <AlphaCount>{items.length}</AlphaCount>
                    </AlphaHeader>
                    {items.map((c) => (
                      <ContactRow
                        key={c.id}
                        itemData={c}
                        isActiveAccount={false}
                        onDelete={() => handleDelete(c.id)}
                        onUpdateName={(name) => handleEditLabel(c.id, name)}
                      />
                    ))}
                  </AlphaSection>
                );
              })}
            </>
          ) : (
            <Grid>
              {displayedContacts.map((c) => (
                <CBaseUserAccount
                  key={c.id}
                  itemData={c}
                  onDelete={() => handleDelete(c.id)}
                  onUpdateName={(name) => handleEditLabel(c.id, name)}
                  onDownload={() => handleDownloadCard(c)}
                />
              ))}
            </Grid>
          )}
        </Body>

        {isListView && displayedContacts.length > 0 && (
          <AlphaScrollbar>
            {ALPHABET.map((letter) => {
              const hasItems = !!grouped[letter];
              return (
                <AlphaScrollBtn
                  key={letter}
                  $active={activeLetter === letter}
                  $hasItems={hasItems}
                  onClick={() => hasItems && scrollToLetter(letter)}
                  aria-label={`Jump to ${letter}`}
                >
                  {letter}
                </AlphaScrollBtn>
              );
            })}
          </AlphaScrollbar>
        )}

        <AlphaBubble $visible={bubbleVisible}>{activeLetter ?? ""}</AlphaBubble>
      </BodyWrapper>

      <DynamicSlidingDialogue
        isOpen={isGroupDrawerOpen && !!managingGroup}
        onOpenChange={(e) => {
          setIsGroupDrawerOpen(e);
        }}
        scrollable={true}
        buttons={{
          cancel: { text: "Cancel", hide: true },
          confirm: { text: "Save Changes", hide: true },
        }}
        modal={{
          title: `Manage ${managingGroup?.meta?.name || "Group"}`,
          description: "",
        }}
        width={700}
      >
        <GroupManagerDrawer
          group={managingGroup!}
          majik={majik}
          allContacts={contacts}
          onUpdate={() => setRefreshKey((prev) => prev + 1)}
        />
      </DynamicSlidingDialogue>
    </Root>
  );
};

export default ContactsPanel;
