"use client";

import React, { useEffect, useState } from "react";
import styled, { css } from "styled-components";
import { MajikContact } from "@majikah/majik-contact";
import DeleteButton from "@/components/foundations/DeleteButton";
import StyledIconButton from "@/components/foundations/StyledIconButton";
import {
  CheckCircleIcon,
  GearIcon,
  KeyIcon,
  LinkIcon,
  PencilIcon,
  ProhibitIcon,
  StarIcon,
  WifiHighIcon,
} from "@phosphor-icons/react";
import ConfirmationButton from "@/components/foundations/ConfirmationButton";
import PopUpFormButton from "@/components/foundations/PopUpFormButton";
import CustomInputField from "@/components/foundations/CustomInputField";
import { toast } from "sonner";
import { useMajik } from "@/components/majik-context-wrapper/use-majik";
import { useMajikah } from "@/components/majikah-session-wrapper/use-majikah";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row = styled.div<{ $isActive: boolean; $isBlocked: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: transparent;
  cursor: pointer;
  user-select: none;
  transition: background 150ms ease;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground}44;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }

  &:hover > div[data-actions] {
    visibility: visible;
    opacity: 1;
    transition:
      opacity 150ms ease,
      visibility 0ms linear 0ms;
  }

  ${({ $isActive }) =>
    $isActive &&
    css`
      &::before {
        content: "";
        position: absolute;
        left: 0;
        top: 20%;
        bottom: 20%;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: ${({ theme }) => theme.gradients.strong};
      }
    `}
`;

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const Avatar = styled.div<{ $hue: number }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: hsl(${({ $hue }) => $hue}, 38%, 24%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  user-select: none;
`;

const ActiveDot = styled.span`
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.brand?.green ?? "#10b981"};
  border: 2px solid ${({ theme }) => theme.colors.primaryBackground};
`;

// ─── Info ─────────────────────────────────────────────────────────────────────
const Info = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const DisplayName = styled.span<{ $blocked: boolean }>`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ $blocked, theme }) =>
    $blocked ? theme.colors.error : theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SubRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Fingerprint = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
`;

// ─── Status pills (compact) ───────────────────────────────────────────────────
type PillVariant = "active" | "online" | "offline" | "blocked";

const StatusPill = styled.span<{ $variant: PillVariant }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "active":
        return css`
          background: rgba(79, 110, 247, 0.15);
          color: ${theme.colors.primary};
          border: 1px solid rgba(79, 110, 247, 0.25);
        `;
      case "online":
        return css`
          background: rgba(16, 185, 129, 0.12);
          color: ${theme.colors.brand?.green ?? "#10b981"};
          border: 1px solid rgba(16, 185, 129, 0.2);
        `;
      case "offline":
        return css`
          background: rgba(255, 255, 255, 0.04);
          color: ${theme.colors.textSecondary};
          border: 1px solid ${theme.colors.secondaryBackground};
        `;
      case "blocked":
        return css`
          background: rgba(248, 113, 113, 0.12);
          color: ${theme.colors.error};
          border: 1px solid rgba(248, 113, 113, 0.2);
        `;
    }
  }}
`;

const PillDot = styled.span`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
`;

// ─── Action buttons ───────────────────────────────────────────────────────────
const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  visibility: hidden;
  opacity: 0;
  transition:
    opacity 150ms ease,
    visibility 0ms linear 150ms;
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface PassphraseUpdateParams {
  id: string;
  passphrase: { old: string; new: string };
}

interface ContactRowProps {
  itemData: MajikContact;
  isActiveAccount?: boolean;
  onPressed?: (itemData: MajikContact) => void;
  onDelete?: (data: MajikContact) => void;
  onShare?: (data: MajikContact) => void;
  onCopyPublicKey?: (data: MajikContact) => void;
  onSetActive?: (data: MajikContact) => void;
  onBlock?: (data: MajikContact) => void;
  onUnBlock?: (data: MajikContact) => void;
  onUpdatePassphrase?: (params: PassphraseUpdateParams) => void;
  onUpdateName?: (name: string) => void;
  onRegister?: (data: MajikContact) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
const ContactRow: React.FC<ContactRowProps> = ({
  itemData,
  isActiveAccount = false,
  onPressed,
  onDelete,
  onShare,
  onCopyPublicKey,
  onSetActive,
  onBlock,
  onUnBlock,
  onUpdatePassphrase,
  onUpdateName,
  onRegister,
  canEdit = true,
  canDelete = true,
}) => {
  const { majik } = useMajik();
  const { majikah } = useMajikah();

  const [passphraseUpdate, setPassphraseUpdate] =
    useState<PassphraseUpdateParams>({
      id: itemData.id,
      passphrase: { old: "", new: "" },
    });
  const [newName, setNewName] = useState<string | null>(
    itemData?.meta?.label || null,
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isAccountOnline, setIsAccountOnline] = useState<boolean | undefined>(
    itemData.isMajikahIdentityChecked()
      ? itemData.isMajikahRegistered()
      : undefined,
  );

  // ── Check online/registration status ──────────────────────────────────────
  useEffect(() => {
    if (!majikah.isAuthenticated) return;
    let cancelled = false;

    const checkOnlineStatus = async (): Promise<void> => {
      try {
        if (!itemData?.id?.trim()) {
          setIsAccountOnline(false);
          return;
        }
        if (
          isAccountOnline !== undefined ||
          majik.isContactMajikahIdentityChecked(itemData.id)
        )
          return;

        const doesExist = await majik.identityExists(itemData.id);
        majik.setContactMajikahStatus(itemData.id, doesExist);
        if (!cancelled) setIsAccountOnline(doesExist);
      } catch (err) {
        console.error("Online status check failed", err);
        if (!cancelled) setIsAccountOnline(false);
      }
    };

    checkOnlineStatus();
    return () => {
      cancelled = true;
    };
  }, [majik, itemData.id, isAccountOnline, majikah.isAuthenticated]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const resetSubmission = (): void => {
    setPassphraseUpdate({ id: itemData.id, passphrase: { old: "", new: "" } });
    setNewName(itemData?.meta?.label || null);
  };

  const processUpdatePassphrase = async (): Promise<string> => {
    const isOldPasswordValid = await majik.isPassphraseValid(
      passphraseUpdate.passphrase.old.trim(),
      itemData.id,
    );
    if (!isOldPasswordValid) throw new Error("Old password is invalid");
    onUpdatePassphrase?.(passphraseUpdate);
    resetSubmission();
    return `Password for ${itemData.meta?.label || itemData.id} updated successfully.`;
  };

  const handleUpdatePassphrase = (): void => {
    if (!itemData) return;
    if (passphraseUpdate.passphrase.old === passphraseUpdate.passphrase.new) {
      toast.error("Invalid Password", {
        description: "New password must not be the same as the old password.",
      });
      resetSubmission();
      return;
    }
    setIsChecking(true);
    toast.promise(processUpdatePassphrase(), {
      loading: "Updating password...",
      success: (msg) => {
        setIsChecking(false);
        return msg;
      },
      error: (err) => {
        setIsChecking(false);
        return `${err}`;
      },
    });
  };

  const handleSubmitNameUpdate = (): void => {
    if (!newName?.trim()) {
      toast.error("Invalid Name", {
        description: "Display name must not be empty.",
      });
      resetSubmission();
      return;
    }
    if (itemData.meta.label === newName) {
      toast.error("No Changes Made", {
        description:
          "New display name must not be the same as the old display name.",
      });
      resetSubmission();
      return;
    }
    onUpdateName?.(newName);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const displayName = itemData?.meta?.label || "User Account";
  const isBlocked = itemData?.isBlocked?.() ?? false;
  const isRegistered = itemData?.isMajikahRegistered?.() ?? false;
  const avatarHue = getHue(displayName);
  const initials = getInitials(displayName);
  const shortId = shortenKey(itemData.id);

  const hasAnyAction =
    (!!onDelete && canDelete) ||
    (!!canEdit && !!onUpdateName) ||
    !!onSetActive ||
    !!onShare ||
    !!onCopyPublicKey ||
    !!onBlock ||
    !!onUnBlock ||
    !!onUpdatePassphrase;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Row
      $isActive={isActiveAccount}
      $isBlocked={isBlocked}
      onClick={() => onPressed?.(itemData)}
    >
      {/* Avatar */}
      <AvatarWrap data-private>
        <Avatar $hue={avatarHue} data-private>
          {initials}
        </Avatar>
        {isActiveAccount && <ActiveDot />}
      </AvatarWrap>

      {/* Info */}
      <Info>
        <DisplayName $blocked={isBlocked} data-private>
          {displayName}
        </DisplayName>
        <SubRow>
          <Fingerprint data-private>{shortId}</Fingerprint>
          {isActiveAccount && (
            <StatusPill $variant="active">
              <PillDot />
              Active
            </StatusPill>
          )}
          {isAccountOnline === true && (
            <StatusPill $variant="online">
              <PillDot />
              Online
            </StatusPill>
          )}
          {isAccountOnline === false && !isBlocked && (
            <StatusPill $variant="offline">
              <PillDot />
              Local
            </StatusPill>
          )}
          {isBlocked && <StatusPill $variant="blocked">⊘ Blocked</StatusPill>}
          {!!onRegister && !isRegistered && (
            <StatusPill
              $variant="offline"
              onClick={(e) => {
                e.stopPropagation();
                onRegister(itemData);
              }}
              style={{ cursor: "pointer" }}
            >
              <WifiHighIcon size={8} />
              Register
            </StatusPill>
          )}
        </SubRow>
      </Info>

      {/* Actions — revealed on row hover */}
      {hasAnyAction && (
        <RowActions data-actions>
          {!!onSetActive && !isActiveAccount && (
            <StyledIconButton
              icon={StarIcon}
              title="Set as Active"
              onClick={(e) => {
                e.stopPropagation();
                onSetActive(itemData);
              }}
              size={18}
            />
          )}

          {!!onUpdateName && canEdit && (
            <PopUpFormButton
              icon={PencilIcon}
              text="Edit"
              modal={{
                title: "Edit Label",
                description: "Update your contact label.",
              }}
              buttons={{
                cancel: { text: "Cancel" },
                confirm: {
                  text: "Save Changes",
                  isDisabled: !newName?.trim(),
                  onClick: handleSubmitNameUpdate,
                },
              }}
            >
              <CustomInputField
                currentValue={newName ?? undefined}
                onChange={(e) => setNewName(e)}
                maxChar={100}
                regex="letters"
                label="Display Name"
                required
                importProp={{ type: "txt" }}
                sensitive
              />
            </PopUpFormButton>
          )}

          {!!onUpdatePassphrase && (
            <PopUpFormButton
              icon={GearIcon}
              text="Change Passphrase"
              modal={{
                title: "Change Passphrase",
                description:
                  "Updating your account passphrase using Argon2. This process may take several seconds.",
              }}
              buttons={{
                cancel: { text: "Cancel" },
                confirm: {
                  text: isChecking ? "Updating..." : "Save Changes",
                  isDisabled:
                    !passphraseUpdate?.passphrase?.old?.trim() ||
                    !passphraseUpdate?.passphrase?.new?.trim() ||
                    isChecking,
                  onClick: handleUpdatePassphrase,
                  confirmationText:
                    "Are you sure you want to proceed? This may take a few seconds.",
                },
              }}
              loading={{ isLoading: isChecking }}
            >
              <CustomInputField
                label="Enter Old Password"
                onChange={(value) =>
                  setPassphraseUpdate((prev) => ({
                    ...prev,
                    passphrase: { ...prev.passphrase, old: value },
                  }))
                }
                type="password"
                passwordType="NONE"
                currentValue={passphraseUpdate.passphrase.old}
              />
              {passphraseUpdate.passphrase.old?.trim() && (
                <CustomInputField
                  label="Enter New Password"
                  onChange={(value) =>
                    setPassphraseUpdate((prev) => ({
                      ...prev,
                      passphrase: { ...prev.passphrase, new: value },
                    }))
                  }
                  type="password"
                  passwordType="NONE"
                  currentValue={passphraseUpdate.passphrase.new}
                />
              )}
            </PopUpFormButton>
          )}

          {!!onShare && (
            <StyledIconButton
              icon={LinkIcon}
              title="Share"
              onClick={(e) => {
                e.stopPropagation();
                onShare(itemData);
              }}
              size={18}
            />
          )}

          {!!onCopyPublicKey && (
            <StyledIconButton
              icon={KeyIcon}
              title="Copy Public Key"
              onClick={(e) => {
                e.stopPropagation();
                onCopyPublicKey(itemData);
              }}
              size={18}
            />
          )}

          {!!onBlock && !isBlocked && (
            <ConfirmationButton
              text="Block"
              onClick={() => onBlock(itemData)}
              alertTextTitle="Block Contact"
              strict
              icon={{
                icon: ProhibitIcon,
              }}
            />
          )}

          {!!onUnBlock && isBlocked && (
            <ConfirmationButton
              text="Unblock"
              onClick={() => onUnBlock(itemData)}
              icon={{ icon: CheckCircleIcon }}
              alertTextTitle="Unblock Contact"
              strict
            />
          )}

          {!!onDelete && canDelete && (
            <DeleteButton title="contact" onClick={() => onDelete(itemData)} />
          )}
        </RowActions>
      )}
    </Row>
  );
};

export default ContactRow;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function shortenKey(key: string, chars = 6): string {
  const s = String(key);
  return `${s.slice(0, chars)}…${s.slice(-4)}`;
}
