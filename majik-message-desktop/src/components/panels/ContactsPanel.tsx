import styled from "styled-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PopUpFormButton from "@/components/foundations/PopUpFormButton";
import {
  HandshakeIcon,
  ListIcon,
  SquaresFourIcon,
  UserIcon,
  UserPlusIcon,
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

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_CONTACTS_LIMIT = 1000;
const LIST_DEFAULT_THRESHOLD = 10;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

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

// ─── Account limit badge ──────────────────────────────────────────────────────
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

// ─── Grid layout ──────────────────────────────────────────────────────────────
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

// ─── List layout ──────────────────────────────────────────────────────────────
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

// ─── iOS-style alphabetical scrollbar ────────────────────────────────────────
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

// ─── "Touch" floating bubble for the active letter (iOS style) ───────────────
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

// ─── Empty state ──────────────────────────────────────────────────────────────
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface ContactsPanelProps {
  majik: MajikMessageDatabase;
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

  // ── Contacts ───────────────────────────────────────────────────────────────
  const contacts = useMemo(() => {
    if (!majik) return [];
    return majik.listContacts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  // ── View mode: default based on count + mobile override ───────────────────
  const defaultView: ViewMode =
    contacts.length > LIST_DEFAULT_THRESHOLD ? "list" : "grid";
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);

  // Update view mode when contact count crosses threshold (initial load)
  useEffect(() => {
    setViewMode(contacts.length > LIST_DEFAULT_THRESHOLD ? "list" : "grid");
  }, [contacts.length]);

  // ── Alphabetical grouping ─────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const sorted = [...contacts].sort((a, b) => {
      const nameA = (a.meta?.label || "").toLowerCase();
      const nameB = (b.meta?.label || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const map: Record<string, typeof contacts> = {};
    for (const c of sorted) {
      const letter = getContactLetter(c.meta?.label || "");
      if (!map[letter]) map[letter] = [];
      map[letter].push(c);
    }
    return map;
  }, [contacts]);

  const presentLetters = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  // ── Event listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!majik) return;
    const handler = (): void => setRefreshKey((prev) => prev + 1);
    majik.on("new-contact", handler);
    return () => {
      majik.off("new-contact", handler);
    };
  }, [majik]);

  // ── Handlers ───────────────────────────────────────────────────────────────
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
      toast.success("New Contact Added Succesfully", {
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

  // ── Alpha scrollbar scroll-to ──────────────────────────────────────────────
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

  const atLimit = contacts.length >= MAX_CONTACTS_LIMIT;
  const isListView = viewMode === "list";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root id="section-contacts">
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-message/docs/contacts-documentation"
        startTour={() => launchTutorialContacts(tour)}
      />

      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>Contacts</PanelTitle>
          <PanelSubtitle>
            {contacts.length} / {MAX_CONTACTS_LIMIT} contacts
          </PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          {atLimit && <LimitBadge>Limit reached</LimitBadge>}

          {/* View toggle — hidden on mobile (always list) */}
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

          {/* Invites */}
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
              confirm: {
                text: "Save Changes",
                hide: true,
              },
            }}
          >
            <UserContactInvitations majik={majik} />
          </PopUpFormButton>

          {/* Import */}
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
              confirm: {
                text: "Save Changes",
                onClick: handleAddContact,
              },
            }}
          >
            <CustomInputField
              currentValue={inviteKey}
              onChange={(e) => setInviteKey(e)}
              maxChar={10000}
              label="Invite Key"
              required
              importProp={{ type: "txt" }}
              sensitive={true}
            />
          </PopUpFormButton>
        </HeaderActions>
      </PanelHeader>

      {/* ── Body ── */}
      <BodyWrapper>
        <Body $isListView={isListView} ref={bodyRef}>
          {contacts.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <UserIcon size={22} />
              </EmptyIcon>
              <EmptyTitle>No contacts yet</EmptyTitle>
              <EmptyHint>You haven&apos;t added any contacts yet.</EmptyHint>
            </EmptyState>
          ) : isListView ? (
            /* ── List view: alphabetical sections ── */
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
            /* ── Grid view ── */
            <Grid>
              {contacts.map((c) => (
                <CBaseUserAccount
                  key={c.id}
                  itemData={c}
                  onDelete={() => handleDelete(c.id)}
                  onUpdateName={(name) => handleEditLabel(c.id, name)}
                />
              ))}
            </Grid>
          )}
        </Body>

        {/* ── iOS-style alphabetical fast-scroll — only in list view ── */}
        {isListView && contacts.length > 0 && (
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

        {/* ── Floating bubble overlay ── */}
        {isListView && (
          <AlphaBubble $visible={bubbleVisible}>
            {activeLetter ?? ""}
          </AlphaBubble>
        )}
      </BodyWrapper>
    </Root>
  );
};

export default ContactsPanel;
