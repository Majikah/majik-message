import { useEffect, useState, type JSX } from "react";
import styled from "styled-components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { CaretUpDownIcon, CheckIcon } from "@phosphor-icons/react";
import { Tooltip } from "react-tooltip";
import theme from "../globals/theme";
import { useMajik } from "./majik-context-wrapper/use-majik";
import type { MajikMessageIdentity } from "@majikah/majik-message";
import { toast } from "sonner";
import { useMajikah } from "./majikah-session-wrapper/use-majikah";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Trigger button ───────────────────────────────────────────────────────────
/**
 * Compact inline pill — shows avatar initial + label + key chip.
 * Replaces the large card (60px icon, full-width layout) with something
 * that sits comfortably beside pagination controls in a sub-row.
 */
const Trigger = styled.button`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px 5px 5px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 150ms ease,
    border-color 150ms ease;
  max-width: 600px;
  width: 100%;
  min-width: 0;
  overflow: hidden;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
    border-color: ${({ theme }) => theme.colors.secondaryBackground};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

// ─── Avatar initial circle ────────────────────────────────────────────────────
const IdentityAvatar = styled.div<{ $hue: number }>`
  width: 22px;
  height: 22px;
  min-width: 22px;
  border-radius: 50%;
  background: hsl(${({ $hue }) => $hue}, 38%, 26%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
  user-select: none;
  flex-shrink: 0;
`;

// ─── Label + key stacked ──────────────────────────────────────────────────────
const IdentityInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
`;

const IdentityLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  text-align: left;
`;

const IdentityKey = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  text-overflow: ellipsis;
  letter-spacing: 0.04em;
  opacity: 0.7;
  text-align: left;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
`;

const UnsetLabel = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
`;

const Caret = styled.div`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  flex-shrink: 0;
`;

// ─── Dropdown content ─────────────────────────────────────────────────────────
const MenuContent = styled(DropdownMenuContent)`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 10px;
  padding: 4px;
  min-width: 220px;
  max-width: 280px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  overflow-y: auto;
  max-height: 320px;

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

// ─── Menu header label ────────────────────────────────────────────────────────
const MenuHeading = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  padding: 6px 10px 4px;
`;

// ─── Individual identity row in dropdown ──────────────────────────────────────
const IdentityOption = styled(DropdownMenuItem)<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
  transition: background 120ms ease;
  background: ${({ $isActive, theme }) =>
    $isActive ? `${theme.colors.primary}18` : "transparent"};

  &[data-highlighted] {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const OptionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const OptionLabel = styled.span<{ $isActive: boolean }>`
  font-size: 12px;
  font-weight: ${({ $isActive }) => ($isActive ? 600 : 500)};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const OptionKey = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.04em;
`;

const ActiveCheck = styled.div`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface MajikMessageIdentitySelectorProps {
  tooltip?: string;
  onChange?: (identity: MajikMessageIdentity) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MajikMessageIdentitySelector({
  tooltip = "Switch identity",
  onChange,
}: MajikMessageIdentitySelectorProps): JSX.Element {
  const { majik } = useMajik();
  const { majikah } = useMajikah();

  const [identities, setIdentities] = useState<MajikMessageIdentity[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!majikah.isAuthenticated) return;
    majik.refreshIdentities().then((list: MajikMessageIdentity[]) => {
      setIdentities(list);
      const current = majik.currentIdentity;
      if (current) setActiveId(current.id);
    });
  }, [majik, majikah.isAuthenticated, majikah.user?.id]);

  const handleSelect = async (
    identity: MajikMessageIdentity,
  ): Promise<void> => {
    if (identity.id === activeId) {
      toast.error("Already selected", {
        description: "You're already using this identity.",
        id: "toast-error-identity-select",
      });
      return;
    }

    try {
      await majik.setActiveIdentity(identity);
    } catch (err) {
      toast.error("Failed to switch identity", {
        description: `${err}`,
        id: "toast-error-identity-select",
      });
      return;
    }

    onChange?.(identity);
    setActiveId(identity.id);
    setMenuOpen(false);
  };

  const active = identities.find((i) => i.id === activeId);
  const avatarHue = active ? getHue(active.label || active.id) : 0;
  const initials = active ? getInitials(active.label || active.id) : "?";
  const shortKey = active ? active.publicKey : "";

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Trigger
            data-tooltip-id="rtip-identity-selector"
            data-tooltip-content={tooltip}
            id="selector-active-identity"
          >
            <IdentityAvatar $hue={avatarHue}>{initials}</IdentityAvatar>

            <IdentityInfo>
              {active ? (
                <>
                  <IdentityLabel data-private>{active.label}</IdentityLabel>
                  <IdentityKey data-private>{shortKey}</IdentityKey>
                </>
              ) : (
                <UnsetLabel>{tooltip}</UnsetLabel>
              )}
            </IdentityInfo>

            <Caret>
              <CaretUpDownIcon size={13} />
            </Caret>
          </Trigger>
        </DropdownMenuTrigger>

        <MenuContent align="start" sideOffset={6}>
          <MenuHeading>Active Identity</MenuHeading>

          {identities.map((identity) => {
            const isActive = identity.id === activeId;
            const hue = getHue(identity.label || identity.id);
            const init = getInitials(identity.label || identity.id);

            return (
              <IdentityOption
                key={identity.id}
                $isActive={isActive}
                onSelect={() => handleSelect(identity)}
              >
                <IdentityAvatar $hue={hue}>{init}</IdentityAvatar>
                <OptionInfo>
                  <OptionLabel $isActive={isActive} data-private>
                    {identity.label}
                  </OptionLabel>
                  <OptionKey data-private>{identity.publicKey}</OptionKey>
                </OptionInfo>
                {isActive && (
                  <ActiveCheck>
                    <CheckIcon size={13} weight="bold" />
                  </ActiveCheck>
                )}
              </IdentityOption>
            );
          })}
        </MenuContent>
      </DropdownMenu>

      <Tooltip
        id="rtip-identity-selector"
        style={{
          fontSize: 11,
          fontWeight: 400,
          backgroundColor: theme.colors.secondaryBackground,
          color: theme.colors.textPrimary,
        }}
      />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// function shortenKey(key: string, chars = 5): string {
//   const s = String(key)
//   return `${s.slice(0, chars)}…${s.slice(-4)}`
// }
