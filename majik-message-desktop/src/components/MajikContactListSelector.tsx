import React, { useState, useEffect, useRef, useMemo, type JSX } from "react";
import styled, { keyframes } from "styled-components";
import { toast } from "sonner";
import Fuse from "fuse.js";
import { TrashIcon, UsersIcon, UserIcon } from "@phosphor-icons/react";
import type { MajikContact } from "@majikah/majik-contact";
import type { MajikContactGroup } from "@majikah/majik-contact";

type SearchMode = "contact" | "group";

type SearchableContact = {
  contact: MajikContact;
  label: string;
  publicKey: string;
  publicKeyPrefix: string;
};

type SearchableGroup = {
  group: MajikContactGroup;
  name: string;
  description: string;
  id: string;
};

interface MajikContactListSelectorProps {
  id?: string;
  contacts: MajikContact[];
  groups?: MajikContactGroup[];
  value?: MajikContact[];
  onUpdate?: (value: MajikContact[]) => void;
  onClearAll?: () => void;
  emptyActionButton?: () => void;
  emptyActionText?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  compact?: boolean;
  maxContacts?: number; // ← new: 1 = single-select mode
}

const arraysEqual = (a: MajikContact[], b: MajikContact[]): boolean =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id);

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
`;

export function MajikContactListSelector({
  id,
  contacts,
  groups = [],
  value = [],
  onUpdate,
  onClearAll,
  emptyActionButton,
  emptyActionText = "Add New Contact",
  allowEmpty = true,
  disabled = false,
  compact = false,
  maxContacts,
}: MajikContactListSelectorProps): JSX.Element {
  const isSingleMode = maxContacts === 1;

  const [list, setList] = useState<MajikContact[]>(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [contactLabels, setContactLabels] = useState<Record<string, string>>(
    {},
  );
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchMode>("contact");
  const [pendingGroupContacts, setPendingGroupContacts] = useState<
    MajikContact[] | null
  >(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolve contact labels
  useEffect(() => {
    let cancelled = false;
    const resolveLabels = async (): Promise<void> => {
      const unresolved = contacts.filter((c) => contactLabels[c.id] == null);
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
  }, [contacts, contactLabels]);

  // Sync external value
  useEffect(() => {
    if (value && !arraysEqual(value, list)) setList(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setQuery("");
        setPendingGroupContacts(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getContactLabelSync = (contact: MajikContact): string =>
    contact.meta.label || contactLabels[contact.id] || "…";

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

  const availableContacts = useMemo(
    () => contacts.filter((c) => !list.some((sel) => sel.id === c.id)),
    [contacts, list],
  );

  const searchableContacts = useMemo<SearchableContact[]>(() => {
    return availableContacts.map((contact) => {
      const pk = contactLabels[contact.id] ?? "";
      const normalizedPk = normalize(pk);
      return {
        contact,
        label: contact.meta.label ?? "",
        publicKey: normalizedPk,
        publicKeyPrefix: normalizedPk.slice(0, 32),
      };
    });
  }, [availableContacts, contactLabels]);

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

  // ── Group search ────────────────────────────────────────────────────────────

  const searchableGroups = useMemo<SearchableGroup[]>(() => {
    return groups.map((group) => ({
      group,
      name: group.meta.name ?? "",
      description: group.meta.description ?? "",
      id: group.id,
    }));
  }, [groups]);

  const groupFuse = useMemo(
    () =>
      new Fuse(searchableGroups, {
        keys: [
          { name: "name", weight: 0.6 },
          { name: "id", weight: 0.25 },
          { name: "description", weight: 0.15 },
        ],
        threshold: 0.45,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 1,
        ignoreFieldNorm: true,
      }),
    [searchableGroups],
  );

  const normalizedQuery = useMemo(() => normalize(query), [query]);

  const filteredContacts = useMemo(() => {
    const pool =
      pendingGroupContacts ??
      (searchMode === "contact" ? availableContacts : []);
    if (!pendingGroupContacts && searchMode !== "contact") return [];
    if (!normalizedQuery && !pendingGroupContacts) return pool;
    if (pendingGroupContacts) {
      if (!normalizedQuery)
        return pendingGroupContacts.filter(
          (c) => !list.some((sel) => sel.id === c.id),
        );
      const fusePool = pendingGroupContacts
        .filter((c) => !list.some((sel) => sel.id === c.id))
        .map((contact) => {
          const pk = contactLabels[contact.id] ?? "";
          const normalizedPk = normalize(pk);
          return {
            contact,
            label: contact.meta.label ?? "",
            publicKey: normalizedPk,
            publicKeyPrefix: normalizedPk.slice(0, 32),
          };
        });
      const f = new Fuse(fusePool, {
        keys: [
          { name: "label", weight: 0.7 },
          { name: "publicKeyPrefix", weight: 0.3 },
        ],
        threshold: 0.45,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 1,
        ignoreFieldNorm: true,
      });
      return f.search(normalizedQuery).map((r) => r.item.contact);
    }
    return contactFuse.search(normalizedQuery).map((r) => r.item.contact);
  }, [
    normalizedQuery,
    contactFuse,
    availableContacts,
    searchMode,
    pendingGroupContacts,
    list,
    contactLabels,
  ]);

  const filteredGroups = useMemo(() => {
    if (searchMode !== "group" || pendingGroupContacts) return [];
    if (!normalizedQuery) return searchableGroups.map((s) => s.group);
    return groupFuse.search(normalizedQuery).map((r) => r.item.group);
  }, [
    normalizedQuery,
    groupFuse,
    searchableGroups,
    searchMode,
    pendingGroupContacts,
  ]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const commitContacts = (incoming: MajikContact[]): void => {
    if (isSingleMode) {
      const picked = incoming[0];
      if (!picked) return;
      setList([picked]);
      onUpdate?.([picked]);
    } else {
      const deduped = incoming.filter(
        (c) => !list.some((sel) => sel.id === c.id),
      );
      if (
        maxContacts !== undefined &&
        list.length + deduped.length > maxContacts
      ) {
        toast.error(`You can only select up to ${maxContacts} contacts.`);
        const allowed = deduped.slice(0, maxContacts - list.length);
        const updated = [...list, ...allowed];
        setList(updated);
        onUpdate?.(updated);
        return;
      }
      const updated = [...list, ...deduped];
      setList(updated);
      onUpdate?.(updated);
    }
    setQuery("");
    setShowDropdown(false);
    setHighlightedIndex(0);
    setPendingGroupContacts(null);
  };

  const handleSelectContact = (contact: MajikContact): void => {
    if (disabled) return;
    if (list.some((c) => c.id === contact.id)) {
      toast.error("This contact is already added.");
      return;
    }
    if (
      maxContacts !== undefined &&
      !isSingleMode &&
      list.length >= maxContacts
    ) {
      toast.error(`You can only select up to ${maxContacts} contacts.`);
      return;
    }
    commitContacts([contact]);
  };

  const handleSelectGroup = (group: MajikContactGroup): void => {
    if (disabled) return;
    const memberIds = group.listMemberIds();
    const groupContacts = contacts.filter((c) => memberIds.includes(c.id));
    if (groupContacts.length === 0) {
      toast.error("This group has no contacts in your directory.");
      return;
    }
    // Switch to contact preview mode — show group members, switch mode back to contact
    setSearchMode("contact");
    setPendingGroupContacts(groupContacts);
    setQuery("");
    setHighlightedIndex(0);
    toast.success(
      `${group.meta.name} — ${groupContacts.length} contact${groupContacts.length !== 1 ? "s" : ""} loaded`,
    );
  };

  const handleRemove = (index: number, e: React.MouseEvent): void => {
    e.stopPropagation();
    if (disabled) return;
    const updated = list.filter((_, i) => i !== index);
    if (!allowEmpty && updated.length === 0) {
      toast.error("Recipient cannot be empty.");
      return;
    }
    setList(updated);
    onUpdate?.(updated);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (disabled) return;
    setQuery(e.target.value);
    setShowDropdown(true);
    setHighlightedIndex(0);
  };

  const handleInputFocus = (): void => {
    if (disabled) return;
    if (
      searchMode === "contact" &&
      !pendingGroupContacts &&
      contacts.length === 0
    ) {
      toast.error("No contacts available.", {
        description:
          "You currently do not have available contacts to choose from.",
        action: emptyActionButton
          ? { label: emptyActionText, onClick: emptyActionButton }
          : undefined,
      });
      return;
    }
    if (searchMode === "group" && groups.length === 0) {
      toast.error("No groups available.");
      return;
    }
    setShowDropdown(true);
  };

  const allDropdownItems =
    searchMode === "group" && !pendingGroupContacts
      ? filteredGroups
      : filteredContacts;

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (disabled) return;
    if (e.key === "Backspace" && query === "" && list.length > 0) {
      e.preventDefault();
      if (allowEmpty || list.length > 1) {
        const updated = list.slice(0, -1);
        setList(updated);
        onUpdate?.(updated);
      } else {
        toast.error("Recipient cannot be empty.", {
          id: "toast-error-remove-last",
        });
      }
      return;
    }
    if (!showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < allDropdownItems.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (searchMode === "group" && !pendingGroupContacts) {
          const g = filteredGroups[highlightedIndex];
          if (g) handleSelectGroup(g);
        } else {
          const c = filteredContacts[highlightedIndex];
          if (c) handleSelectContact(c);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setQuery("");
        setPendingGroupContacts(null);
        break;
    }
  };

  const handleSelectAllGroupMembers = (): void => {
    if (!pendingGroupContacts) return;
    const unselected = pendingGroupContacts.filter(
      (c) => !list.some((sel) => sel.id === c.id),
    );
    if (unselected.length === 0) {
      toast.error("All group members are already selected.");
      return;
    }
    commitContacts(unselected);
  };

  const handleClearAll = (): void => {
    onClearAll?.();
    setList([]);
    setQuery("");
    setShowDropdown(false);
    setPendingGroupContacts(null);
  };

  const toggleSearchMode = (): void => {
    if (disabled) return;
    const next: SearchMode = searchMode === "contact" ? "group" : "contact";
    setSearchMode(next);
    setPendingGroupContacts(null);
    setQuery("");
    setHighlightedIndex(0);
    setShowDropdown(true);
    inputRef.current?.focus();
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const el = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, showDropdown]);

  const isAtMax = maxContacts !== undefined && list.length >= maxContacts;

  const inputPlaceholder = (() => {
    if (disabled) return "";
    if (isSingleMode && list.length > 0) return "Replace contact…";
    if (pendingGroupContacts)
      return `Filter ${pendingGroupContacts.length} group members…`;
    if (searchMode === "group")
      return "Search by group name, ID, or description…";
    if (list.length === 0) return "Type to search contacts…";
    return "Type name or public key…";
  })();

  return (
    <SelectorWrapper ref={wrapperRef} id={id}>
      <InputContainer
        $compact={compact}
        $disabled={disabled}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Tags — hidden in single mode when showing input instead */}
        {!isSingleMode &&
          list.map((contact, index) => (
            <Tag key={contact.id} $compact={compact}>
              <span data-private>{getContactLabelSync(contact)}</span>
              {!disabled && (
                <RemoveButton onClick={(e) => handleRemove(index, e)}>
                  ✕
                </RemoveButton>
              )}
            </Tag>
          ))}

        {/* Single-mode: show selected as a pill that covers the row, or show input */}
        {isSingleMode && list.length > 0 && !showDropdown && (
          <SingleTag
            $compact={compact}
            onClick={() => {
              if (!disabled) {
                setShowDropdown(true);
                inputRef.current?.focus();
              }
            }}
          >
            <span data-private>{getContactLabelSync(list[0])}</span>
            {!disabled && (
              <RemoveButton onClick={(e) => handleRemove(0, e)}>✕</RemoveButton>
            )}
          </SingleTag>
        )}

        <InputRow $hidden={isSingleMode && list.length > 0 && !showDropdown}>
          {/* Mode toggle button */}
          <ModeToggle
            $compact={compact}
            $active={searchMode === "group"}
            $disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              toggleSearchMode();
            }}
            title={
              searchMode === "contact"
                ? "Switch to group search"
                : "Switch to contact search"
            }
            type="button"
          >
            {pendingGroupContacts ? (
              <UsersIcon size={compact ? 12 : 14} weight="fill" />
            ) : searchMode === "group" ? (
              <UsersIcon size={compact ? 12 : 14} />
            ) : (
              <UserIcon size={compact ? 12 : 14} />
            )}
          </ModeToggle>

          {pendingGroupContacts && (
            <GroupBadge $compact={compact}>
              {pendingGroupContacts.length} members
              <ClearGroupButton
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingGroupContacts(null);
                  setQuery("");
                }}
              >
                ✕
              </ClearGroupButton>
            </GroupBadge>
          )}

          <StyledInput
            $compact={compact}
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled || (isAtMax && !isSingleMode)}
            placeholder={inputPlaceholder}
          />
        </InputRow>
      </InputContainer>

      {/* Max count indicator */}
      {maxContacts !== undefined && !isSingleMode && (
        <CountBadge $atMax={isAtMax} $compact={compact}>
          {list.length} / {maxContacts}
        </CountBadge>
      )}

      {showDropdown && (
        <Dropdown ref={dropdownRef}>
          {/* Group mode — showing groups */}
          {searchMode === "group" && !pendingGroupContacts && (
            <>
              {filteredGroups.length > 0 ? (
                filteredGroups.map((group, index) => (
                  <DropdownItem
                    key={group.id}
                    $highlighted={index === highlightedIndex}
                    onClick={() => handleSelectGroup(group)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <GroupItemLeft>
                      <GroupItemIcon>
                        <UsersIcon size={13} />
                      </GroupItemIcon>
                      <GroupItemInfo>
                        <ContactLabel data-private>
                          {group.meta.name}
                        </ContactLabel>
                        {group.meta.description && (
                          <GroupDescription data-private>
                            {group.meta.description}
                          </GroupDescription>
                        )}
                      </GroupItemInfo>
                    </GroupItemLeft>
                    <MemberCount>{group.memberCount()} members</MemberCount>
                  </DropdownItem>
                ))
              ) : (
                <EmptyState>No groups found</EmptyState>
              )}
            </>
          )}

          {/* Contact mode (direct or post-group-select preview) */}
          {(searchMode === "contact" || pendingGroupContacts) && (
            <>
              {pendingGroupContacts && (
                <GroupPreviewHeader $compact={compact}>
                  <UsersIcon size={12} weight="fill" /> Select from group
                  members
                </GroupPreviewHeader>
              )}

              {/* ← ADD THIS */}
              {pendingGroupContacts &&
                (() => {
                  const unselectedCount = pendingGroupContacts.filter(
                    (c) => !list.some((sel) => sel.id === c.id),
                  ).length;
                  return unselectedCount > 0 ? (
                    <SelectAllItem onClick={handleSelectAllGroupMembers}>
                      <UsersIcon size={14} weight="fill" />
                      Add all {unselectedCount} member
                      {unselectedCount !== 1 ? "s" : ""}
                    </SelectAllItem>
                  ) : null;
                })()}
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact, index) => {
                  const { label, showKey, publicKey } =
                    getContactDisplayWithKey(contact);
                  return (
                    <DropdownItem
                      key={contact.id}
                      $highlighted={index === highlightedIndex}
                      onClick={() => handleSelectContact(contact)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <ContactLabel data-private>{label}</ContactLabel>
                      {showKey && (
                        <PublicKey data-private>{publicKey}</PublicKey>
                      )}
                    </DropdownItem>
                  );
                })
              ) : (
                <EmptyState>
                  {pendingGroupContacts
                    ? "All group members already selected"
                    : "No contacts found"}
                </EmptyState>
              )}
            </>
          )}

          {onClearAll && list.length > 0 && (
            <>
              <Divider />
              <ActionItem onClick={handleClearAll}>
                <TrashIcon size={16} /> Clear All
              </ActionItem>
            </>
          )}

          {emptyActionButton && (
            <ActionItem
              onClick={() => {
                emptyActionButton();
                setShowDropdown(false);
              }}
            >
              ➕ {emptyActionText}
            </ActionItem>
          )}
        </Dropdown>
      )}
    </SelectorWrapper>
  );
}

export default MajikContactListSelector;

// ── Styled Components ────────────────────────────────────────────────────────

const SelectorWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const RemoveButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  margin: 0;
  line-height: 1;
  transition: color 0.2s ease;
  &:hover {
    color: #e74c3c;
  }
`;

const InputContainer = styled.div<{ $compact?: boolean; $disabled?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: ${({ $compact }) => ($compact ? "30px" : "42px")};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: ${({ $compact }) => ($compact ? "7px" : "8px")};
  padding: ${({ $compact }) => ($compact ? "3px 7px" : "6px 10px")};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "text")};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`;

const InputRow = styled.div<{ $hidden?: boolean }>`
  display: ${({ $hidden }) => ($hidden ? "none" : "flex")};
  align-items: center;
  flex: 1;
  gap: 6px;
  min-width: 0;
`;

const Tag = styled.span<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: ${({ $compact }) => ($compact ? "2px 6px" : "5px 10px")};
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ $compact }) => ($compact ? "5px" : "6px")};
  font-size: ${({ $compact }) => ($compact ? "10px" : "0.875rem")};
  white-space: nowrap;
  transition: all 0.2s ease;
  &:hover {
    transform: scale(1.05);
  }
`;

const SingleTag = styled.span<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  padding: ${({ $compact }) => ($compact ? "2px 6px" : "4px 8px")};
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ $compact }) => ($compact ? "5px" : "6px")};
  font-size: ${({ $compact }) => ($compact ? "10px" : "0.875rem")};
  cursor: pointer;
  justify-content: space-between;
  transition: all 0.2s ease;
  &:hover {
    opacity: 0.85;
  }
`;

const ModeToggle = styled.button<{
  $compact?: boolean;
  $active?: boolean;
  $disabled?: boolean;
}>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $compact }) => ($compact ? "20px" : "24px")};
  height: ${({ $compact }) => ($compact ? "20px" : "24px")};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.secondaryBackground};
  border-radius: 5px;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primaryBackground : theme.colors.textSecondary};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  transition: all 0.15s ease;
  padding: 0;
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const GroupBadge = styled.span<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: ${({ $compact }) => ($compact ? "1px 6px" : "2px 8px")};
  background: ${({ theme }) =>
    theme.gradients?.secondary ?? theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: 4px;
  font-size: ${({ $compact }) => ($compact ? "9px" : "0.75rem")};
  white-space: nowrap;
  flex-shrink: 0;
`;

const ClearGroupButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  margin: 0;
  line-height: 1;
  transition: color 0.15s ease;
  &:hover {
    color: #e74c3c;
  }
`;

const StyledInput = styled.input<{ $compact?: boolean }>`
  flex: 1;
  min-width: ${({ $compact }) => ($compact ? "70px" : "120px")};
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ $compact }) => ($compact ? "10px" : "0.875rem")};
  outline: none;
  padding: 4px 0;
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
  &:disabled {
    cursor: not-allowed;
  }
`;

const CountBadge = styled.div<{ $atMax?: boolean; $compact?: boolean }>`
  display: flex;
  justify-content: flex-end;
  font-size: ${({ $compact }) => ($compact ? "9px" : "0.7rem")};
  color: ${({ theme, $atMax }) =>
    $atMax ? "#e74c3c" : theme.colors.textSecondary};
  margin-top: 3px;
  padding-right: 2px;
  animation: ${({ $atMax }) => ($atMax ? pulse : "none")} 1.5s ease-in-out
    infinite;
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: ${fadeIn} 0.12s ease;
`;

const DropdownItem = styled.div<{ $highlighted: boolean }>`
  padding: 10px 16px;
  cursor: pointer;
  background: ${({ theme, $highlighted }) =>
    $highlighted
      ? (theme.gradients?.secondary ?? theme.colors.secondaryBackground)
      : theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  transition: all 0.15s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: row;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primaryBackground};
  }
  &:hover ${/* styled-components ref trick — fallback */ String} {
    color: inherit;
  }
`;

const GroupPreviewHeader = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: ${({ $compact }) => ($compact ? "5px 12px" : "7px 16px")};
  font-size: ${({ $compact }) => ($compact ? "9px" : "0.7rem")};
  color: ${({ theme }) => theme.colors.textSecondary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const GroupItemLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const GroupItemIcon = styled.div`
  flex-shrink: 0;
  opacity: 0.6;
`;

const GroupItemInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const GroupDescription = styled.span`
  font-size: 0.72rem;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
`;

const MemberCount = styled.span`
  font-size: 0.72rem;
  opacity: 0.55;
  flex-shrink: 0;
  margin-left: 8px;
`;

const EmptyState = styled.div`
  padding: 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  margin: 4px 0;
`;

const ActionItem = styled.div`
  padding: 10px 16px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: 0.875rem;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const ContactLabel = styled.span`
  font-weight: 500;
`;

const PublicKey = styled.span`
  font-size: 0.8rem;
  opacity: 0.8;
  font-family: monospace;
`;

const SelectAllItem = styled.div`
  padding: 9px 16px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary};
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  transition: all 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primaryBackground};
  }
`;
