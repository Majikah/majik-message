import React, { useEffect, useState } from "react";
import styled, { css } from "styled-components";
import { MajikContact } from "@majikah/majik-message";
import { isDevEnvironment } from "../../utils/utils";
import DeleteButton from "../foundations/DeleteButton";
import StyledIconButton from "../foundations/StyledIconButton";
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
import ConfirmationButton from "../foundations/ConfirmationButton";
import PopUpFormButton from "../foundations/PopUpFormButton";
import CustomInputField from "../foundations/CustomInputField";
import { toast } from "sonner";
import { useMajik } from "../majik-context-wrapper/use-majik";
import { useMajikah } from "../majikah-session-wrapper/use-majikah";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Card ─────────────────────────────────────────────────────────────────────
/**
 * Square-radius avatar (12px) distinguishes owned accounts from
 * circular contact/conversation avatars used throughout the app.
 *
 * Active card: 2px gradient top strip via ::before + primary-tinted border.
 * Non-active: transparent border that fills on hover.
 */
const Card = styled.div<{ $isActive: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid
    ${({ $isActive, theme }) =>
      $isActive ? theme.colors.primary : theme.colors.secondaryBackground};
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: all 250ms ease;
  width: 100%;

  &:hover {
    border-color: ${({ $isActive, theme }) =>
      $isActive ? theme.colors.primary : theme.colors.secondaryBackground};
    transform: translateY(-3px);
  }

  /* Gradient top accent for active account */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${({ $isActive, theme }) =>
      $isActive ? theme.gradients.strong : "transparent"};
    transition: opacity 150ms ease;
  }
`;

// ─── Card header row ──────────────────────────────────────────────────────────
const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 16px 0;
  gap: 12px;
`;

const IdentityRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

// ─── Avatar ───────────────────────────────────────────────────────────────────
/**
 * Square-radius (12px) — deliberately different from circular chat avatars.
 * Circles = contacts/conversations. Squares = owned cryptographic identities.
 */
const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const Avatar = styled.div<{ $hue: number }>`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: hsl(${({ $hue }) => $hue}, 38%, 24%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  user-select: none;
`;

/** Green dot = active account indicator on avatar */
const ActiveDot = styled.span`
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.brand?.green ?? "#10b981"};
  border: 2px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

// ─── Identity meta ────────────────────────────────────────────────────────────
const IdentityMeta = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const AccountName = styled.h3<{ $blocked: boolean }>`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ $blocked, theme }) =>
    $blocked ? theme.colors.error : theme.colors.textPrimary};
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
`;

const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
`;

// ─── Status pills ─────────────────────────────────────────────────────────────
type PillVariant = "active" | "online" | "offline" | "blocked";

const StatusPill = styled.span<{ $variant: PillVariant }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;

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

const PillDot = styled.span<{ $variant: PillVariant }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
`;

// ─── Action buttons ───────────────────────────────────────────────────────────
/**
 * visibility:hidden keeps layout stable — same pattern as CBaseChatBubble.
 * Buttons sit in the card header top-right, always the same width.
 */
const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  visibility: hidden;
  opacity: 0;
  transition:
    opacity 150ms ease,
    visibility 0ms linear 150ms;

  ${Card}:hover & {
    visibility: visible;
    opacity: 1;
    transition:
      opacity 150ms ease,
      visibility 0ms linear 0ms;
  }
`;

// ─── Public key box ───────────────────────────────────────────────────────────
const KeySection = styled.div`
  padding: 12px 16px 0;
  text-align: left;
`;

const KeyLabel = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  margin-bottom: 5px;
`;

const KeyBox = styled.div<{ $isActive: boolean }>`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  word-break: break-all;
  line-height: 1.7;
  background: ${({ $isActive }) =>
    $isActive ? "rgba(79, 110, 247, 0.04)" : "rgba(255, 255, 255, 0.02)"};
  border: 1px solid
    ${({ $isActive }) =>
      $isActive ? "rgba(79, 110, 247, 0.18)" : "rgba(255, 255, 255, 0.05)"};
  border-radius: 7px;
  padding: 8px 10px;
  opacity: 0.75;
  transition:
    border-color 150ms ease,
    background 150ms ease;
`;

// ─── Card footer ──────────────────────────────────────────────────────────────
const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 14px;
  margin-top: 12px;
  border-top: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  gap: 8px;
`;

const FooterMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
`;

const MetaChip = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.05em;
  opacity: 0.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/** Inline register nudge button — shown only for unregistered accounts */
const RegisterBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 7px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  cursor: pointer;
  transition: all 120ms ease;
  flex-shrink: 0;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
    background: rgba(79, 110, 247, 0.08);
  }
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface PassphraseUpdateParams {
  id: string;
  passphrase: { old: string; new: string };
}

interface CBaseUserAccountProps {
  itemData: MajikContact;
  onPressed?: (itemData: MajikContact) => void;
  onEdit?: (data: MajikContact) => void;
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
  index?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
const CBaseUserAccount: React.FC<CBaseUserAccountProps> = ({
  itemData,
  onPressed,
  onDelete,
  onEdit,
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
  index,
}) => {
  const { majik } = useMajik();
  const { majikah } = useMajikah();

  const isActiveAccount = index === 0;

  const [passphraseUpdate, setPassphraseUpdate] =
    useState<PassphraseUpdateParams>({
      id: itemData.id,
      passphrase: { old: "", new: "" },
    });
  const [newName, setNewName] = useState<string | null>(
    itemData?.meta?.label || null,
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string>("Loading…");
  const [isAccountOnline, setIsAccountOnline] = useState<boolean | undefined>(
    itemData.isMajikahIdentityChecked()
      ? itemData.isMajikahRegistered()
      : undefined,
  );

  // ── Fetch public key ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchKey = async (): Promise<void> => {
      if (!itemData) return;
      const key = await itemData.getPublicKeyBase64();
      if (!cancelled) setPublicKey(key);
    };
    fetchKey();
    return () => {
      cancelled = true;
    };
  }, [itemData]);

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
  const handleOnPressed = (): void => {
    if (isDevEnvironment()) console.log("Account pressed:", itemData);
    if (!itemData) return;
    onPressed?.(itemData);
  };

  const processUpdatePassphrase = async (): Promise<string> => {
    const isOldPasswordValid = await majik.isPassphraseValid(
      passphraseUpdate.passphrase.old.trim(),
      itemData.id,
    );

    if (!isOldPasswordValid) {
      throw new Error("Old password is invalid");
    }

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
        console.error(err);
        setIsChecking(false);

        return `${err}`;
      },
    });
  };

  const handleSubmitNameUpdate = (): void => {
    if (!itemData) return;
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

  const resetSubmission = (): void => {
    setPassphraseUpdate({ id: itemData.id, passphrase: { old: "", new: "" } });
    setNewName(itemData?.meta?.label || null);
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const displayName = itemData?.meta?.label || "User Account";
  const isBlocked = itemData?.isBlocked?.() ?? false;
  const isRegistered = itemData?.isMajikahRegistered?.() ?? false;
  const avatarHue = getHue(displayName);
  const initials = getInitials(displayName);
  const shortId = shortenKey(itemData.id ?? publicKey);

  const hasAnyAction =
    (!!onDelete && canDelete) ||
    (!!onEdit && canEdit) ||
    !!onSetActive ||
    !!onShare ||
    !!onCopyPublicKey ||
    !!onBlock ||
    !!onUnBlock ||
    !!onUpdatePassphrase ||
    !!onUpdateName;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card $isActive={isActiveAccount} onClick={handleOnPressed}>
      {/* ── Header: avatar + name + badges + action buttons ── */}
      <CardHeader>
        <IdentityRow>
          <AvatarWrap data-private>
            <Avatar $hue={avatarHue} data-private>
              {initials}
            </Avatar>
            {isActiveAccount && <ActiveDot />}
          </AvatarWrap>

          <IdentityMeta>
            <AccountName $blocked={isBlocked} data-private>
              {displayName}
            </AccountName>
            <BadgeRow>
              {isActiveAccount && (
                <StatusPill $variant="active">
                  <PillDot $variant="active" />
                  Active
                </StatusPill>
              )}
              {isAccountOnline === true && (
                <StatusPill $variant="online">
                  <PillDot $variant="online" />
                  Online
                </StatusPill>
              )}
              {isAccountOnline === false && !isBlocked && (
                <StatusPill $variant="offline">
                  <PillDot $variant="offline" />
                  Local only
                </StatusPill>
              )}
              {isBlocked && (
                <StatusPill $variant="blocked">⊘ Blocked</StatusPill>
              )}
            </BadgeRow>
          </IdentityMeta>
        </IdentityRow>

        {/* Action buttons — revealed on hover */}
        {hasAnyAction && (
          <CardActions>
            {/* Set as Active — only for non-active accounts */}
            {!!onSetActive && !isActiveAccount && (
              <StyledIconButton
                icon={StarIcon}
                title="Set as Active"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetActive(itemData);
                }}
                size={22}
              />
            )}

            {/* Edit name */}
            {!!onUpdateName && (
              <PopUpFormButton
                icon={PencilIcon}
                text="Edit"
                modal={{
                  title: "Edit Label",
                  description: "Update your account label.",
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

            {/* Change passphrase */}
            {!!onUpdatePassphrase && (
              <PopUpFormButton
                icon={GearIcon}
                text="Change Passphrase"
                modal={{
                  title: "Change Passphrase",
                  description:
                    "Updating your account passphrase using Argon2. This process may take several seconds, and your screen may temporarily freeze. Please do not close or refresh.",
                }}
                buttons={{
                  cancel: { text: "Cancel" },
                  confirm: {
                    text: isChecking ? "Updating..." : "Save Changes",
                    isDisabled:
                      !passphraseUpdate?.id?.trim() ||
                      !passphraseUpdate?.passphrase?.old?.trim() ||
                      !passphraseUpdate?.passphrase?.new?.trim() ||
                      isChecking,
                    onClick: handleUpdatePassphrase,
                    confirmationText:
                      "Are you sure you want to proceed with this action? This may take up to a few seconds to complete.",
                  },
                }}
                loading={{
                  isLoading: isChecking,
                }}
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

            {/* Share */}
            {!!onShare && (
              <StyledIconButton
                icon={LinkIcon}
                title="Share"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(itemData);
                }}
                size={22}
              />
            )}

            {/* Copy public key */}
            {!!onCopyPublicKey && (
              <StyledIconButton
                icon={KeyIcon}
                title="Copy Public Key"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyPublicKey(itemData);
                }}
                size={22}
              />
            )}

            {/* Block */}
            {!!onBlock && !isBlocked && (
              <ConfirmationButton
                text="Block"
                onClick={() => onBlock(itemData)}
                icon={ProhibitIcon}
                alertTextTitle="Block Contact"
                strict
              />
            )}

            {/* Unblock */}
            {!!onUnBlock && isBlocked && (
              <ConfirmationButton
                text="Unblock"
                onClick={() => onUnBlock(itemData)}
                icon={CheckCircleIcon}
                alertTextTitle="Unblock Contact"
                strict
              />
            )}

            {/* Delete */}
            {!!onDelete && canDelete && (
              <DeleteButton
                title="account"
                onClick={() => {
                  onDelete(itemData);
                }}
              />
            )}
          </CardActions>
        )}
      </CardHeader>

      {/* ── Public key display ── */}
      <KeySection>
        <KeyLabel>Public Key</KeyLabel>
        <KeyBox $isActive={isActiveAccount} data-private>
          {publicKey}
        </KeyBox>
      </KeySection>

      {/* ── Footer: ID chip + register nudge ── */}
      <CardFooter>
        <FooterMeta>
          <MetaChip>Fingerprint</MetaChip>
          <MetaChip data-private>· {shortId}</MetaChip>
        </FooterMeta>

        {/* Register nudge — only shown for unregistered accounts */}
        {!!onRegister && !isRegistered && (
          <RegisterBtn
            onClick={(e) => {
              e.stopPropagation();
              onRegister(itemData);
            }}
          >
            <WifiHighIcon size={10} />
            Register Online
          </RegisterBtn>
        )}
      </CardFooter>
    </Card>
  );
};

export default CBaseUserAccount;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function shortenKey(key: string, chars = 5): string {
  const s = String(key);
  return `${s.slice(0, chars)}…${s.slice(-4)}`;
}
