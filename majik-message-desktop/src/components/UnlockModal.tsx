/**
 * modals/UnlockModal.tsx
 *
 * Self-contained modal for unlocking a Majik Key account.
 * Supports three modes:
 *   - "passphrase"  — enter passphrase directly (default)
 *   - "backup"      — load backup PNG/JSON to unlock without passphrase
 *   - "forgot"      — load backup PNG/JSON + enter new passphrase to reset
 *
 * All form state lives here — keystrokes NEVER re-render the parent.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  KeyIcon,
  LockKeyOpenIcon,
} from "@phosphor-icons/react";

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@src/globals/styled-dialogs";
import { ChoiceButton } from "@src/globals/buttons";

import DuoButton from "./foundations/DuoButton";
import CustomInputField from "./foundations/CustomInputField";
import ConfirmationButton from "./foundations/ConfirmationButton";
import DynamicAlertBanner from "./foundations/DynamicAlertBanner";
import DropImportAccount from "./foundations/DropImportAccount";

import { useMajikah } from "./majikah-session-wrapper/use-majikah";
import { MajikMessageAccountSelector } from "./MajikMessageAccountSelector";

import { ImportModeToggle, ModeToggleButton } from "./panels/shared/atoms";
import { toast } from "sonner";
import { MajikMessageDatabase } from "./majik-context-wrapper/majik-message-database";
import { MajikContact } from "@majikah/majik-contact";
import { jsonToSeed, MnemonicJSON } from "@majikah/majik-message";

// ─── Types ───────────────────────────────────────────────────────────────────

type UnlockMode = "passphrase" | "backup" | "forgot";

interface UnlockModalProps {
  majik: MajikMessageDatabase;
  identityId: string | null;
  onCancel: () => void;
  onSubmit: (passphrase: string) => void;
  onSignout: () => void;
  strict?: boolean;
  onSwitchAccount: (account: MajikContact) => void;
  onReset?: () => void;
  isUnlocking?: boolean;
}

// ─── Styled Components ───────────────────────────────────────────────────────

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: ${({ theme }) => theme.colors.textPrimary};
  padding: 1rem 50px;
`;

const ExtraButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;
  flex: 1;
  gap: 15px;
  padding: 1rem 50px;
`;

const SignOutButton = styled(ChoiceButton)`
  min-width: 100px;
  width: inherit;
`;

const ForgotLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin-top: -4px;
  color: ${({ theme }) => theme.colors.primary ?? theme.colors.textSecondary};
  font-size: 0.8rem;
  cursor: pointer;
  text-align: right;
  align-self: flex-end;
  text-decoration: underline;
  opacity: 0.8;

  &:hover {
    opacity: 1;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;

  &::before,
  &::after {
    content: "";
    flex: 1;
    border-bottom: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  }

  &::before {
    margin-right: 0.75rem;
  }
  &::after {
    margin-left: 0.75rem;
  }
`;

// ─── Constants ───────────────────────────────────────────────────────────────

const EMPTY_MNEMONIC: MnemonicJSON = {
  id: "",
  seed: Array(12).fill(""),
  phrase: "",
};

// ─── Main Component ──────────────────────────────────────────────────────────

const UnlockModal: React.FC<UnlockModalProps> = React.memo(
  ({
    majik,
    identityId,
    onCancel,
    onSubmit,
    onSignout,
    strict = false,
    onSwitchAccount,
    onReset,
    isUnlocking = false,
  }) => {
    const navigate = useNavigate();
    const { majikah } = useMajikah();

    // ── Per-mode form state ──────────────────────────────────────────────────
    const [mode, setMode] = useState<UnlockMode>("passphrase");
    const [pass, setPass] = useState("");
    const [mnemonicJSON, setMnemonicJSON] =
      useState<MnemonicJSON>(EMPTY_MNEMONIC);
    const [mnemonic, setMnemonic] = useState("");
    const [newPassphrase, setNewPassphrase] = useState("");
    const [confirmPassphrase, setConfirmPassphrase] = useState("");
    const [, setRefreshKey] = useState(0);

    // Prevents double-fire on auto-unlock
    const hasUnlockedRef = useRef(false);

    // Reset all state when identity changes or modal re-opens
    useEffect(() => {
      if (identityId) {
        setMode("passphrase");
        setPass("");
        setMnemonicJSON(EMPTY_MNEMONIC);
        setMnemonic("");
        setNewPassphrase("");
        setConfirmPassphrase("");
        hasUnlockedRef.current = false;
      }
    }, [identityId]);

    const backupReady =
      !!mnemonicJSON?.id?.trim() && mnemonicJSON.seed.length > 0;

    // ── Helpers ─────────────────────────────────────────────────────────────

    const resetBackupState = useCallback(() => {
      setMnemonicJSON(EMPTY_MNEMONIC);
      setMnemonic("");
    }, []);

    const handleDropFileLoaded = useCallback((json: MnemonicJSON) => {
      setMnemonicJSON(json);
      setMnemonic(jsonToSeed(json));
    }, []);

    const handleModeSwitch = useCallback(
      (next: UnlockMode) => {
        setMode(next);
        resetBackupState();
        setNewPassphrase("");
        setConfirmPassphrase("");
      },
      [resetBackupState],
    );

    // ── Actions ─────────────────────────────────────────────────────────────

    const handleCancel = useCallback(() => {
      onCancel();
      setPass("");
    }, [onCancel]);

    /** Mode: passphrase — standard unlock */
    const handlePassphraseSubmit = useCallback(() => {
      onSubmit(pass.trim());
      setPass("");
    }, [onSubmit, pass]);



    /** Mode: forgot — reset passphrase using backup then re-unlock */
    const handleForgotSubmit = useCallback(async () => {
      if (!backupReady || !newPassphrase.trim() || !identityId) return;
      try {
        await majik.replacePassphrase(
          mnemonicJSON.id, // backup base64 string
          mnemonic, // seed via jsonToSeed(mnemonicJSON)
          newPassphrase.trim(),
          identityId, // must match the stored account
        );
        onSubmit(newPassphrase.trim());
      } catch (err) {
        console.error("[UnlockModal] Passphrase reset failed:", err);
        toast.error("Passphrase Reset Failed", {
          description: err instanceof Error ? err.message : "Please try again",
        });
      }
    }, [
      majik,
      mnemonicJSON,
      mnemonic,
      newPassphrase,
      identityId,
      onSubmit,
      backupReady,
    ]);

    const handleSignOut = useCallback(async () => {
      await majikah.signOut();
      navigate("/muid");
      onSignout?.();
    }, [majikah, navigate, onSignout]);

    const handleSwitchAccount = useCallback(
      async (account: MajikContact) => {
        await majik.setActiveAccount(account.id);
        onSwitchAccount(account);
        navigate("/muid");
        setRefreshKey((p) => p + 1);
      },
      [majik, navigate, onSwitchAccount],
    );

    const handleReset = useCallback(async () => {
      await majik.resetData();
      onReset?.();
      navigate("/muid");
    }, [majik, navigate, onReset]);

    // ── Derived state ────────────────────────────────────────────────────────

    const contactLabel = majik
      ? identityId
        ? majik.getContactByID(identityId)?.meta?.label
        : identityId
      : identityId;

    const forgotReady =
      backupReady &&
      !!newPassphrase.trim() &&
      newPassphrase === confirmPassphrase;

    const passphrasesMismatch =
      !!newPassphrase &&
      !!confirmPassphrase &&
      newPassphrase !== confirmPassphrase;

    // ── Early exit ───────────────────────────────────────────────────────────

    if (!identityId) return null;

    // ── Render ───────────────────────────────────────────────────────────────

    return (
      <AlertDialog.Root open={!!identityId?.trim()}>
        <DialogOverlay>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unlock Majik Key</DialogTitle>
              <DialogDescription>
                Enter credentials for{" "}
                <strong data-private>{contactLabel}</strong>
              </DialogDescription>
            </DialogHeader>

            {/* ── Mode Toggle ── */}
            <ModalContainer>
              <ImportModeToggle>
                <ModeToggleButton
                  $active={mode === "passphrase"}
                  onClick={() => handleModeSwitch("passphrase")}
                  type="button"
                >
                  <KeyIcon size={12} /> Passphrase
                </ModeToggleButton>
           
                <ModeToggleButton
                  $active={mode === "forgot"}
                  onClick={() => handleModeSwitch("forgot")}
                  type="button"
                >
                  <LockKeyOpenIcon size={12} /> Forgot Passphrase
                </ModeToggleButton>
              </ImportModeToggle>

              {/* ── Account Switcher (shared across modes) ── */}
              {majik.listOwnAccounts().length > 1 && (
                <MajikMessageAccountSelector
                  currentAccountId={identityId}
                  onChange={handleSwitchAccount}
                />
              )}

              {/* ── Mode: Passphrase ── */}
              {mode === "passphrase" && (
                <>
                  <DynamicAlertBanner
                    title="Majik Key and Majikah accounts are separate"
                    description="Majik Keys use their own local passphrases. This is different from your Majikah account password."
                    level="info"
                  />
                  <CustomInputField
                    currentValue={pass}
                    label="Enter Passphrase"
                    onChange={(value) => {
                      hasUnlockedRef.current = false;
                      setPass(value);
                    }}
                    type="password"
                    passwordType="NONE"
                    key={identityId}
                    autofocus
                  />
                  <ForgotLink
                    type="button"
                    onClick={() => handleModeSwitch("forgot")}
                  >
                    Forgot passphrase?
                  </ForgotLink>
                </>
              )}

      

              {/* ── Mode: Forgot passphrase ── */}
              {mode === "forgot" && (
                <>
                  <DynamicAlertBanner
                    title="Reset your passphrase"
                    description="Load your backup file to verify identity, then set a new passphrase."
                    level="warning"
                  />
                  <DropImportAccount
                    mnemonicJSON={mnemonicJSON}
                    onFileLoaded={handleDropFileLoaded}
                    onClear={resetBackupState}
                  />
                  {backupReady && (
                    <>
                      <CustomInputField
                        currentValue={newPassphrase}
                        label="New Passphrase"
                        onChange={setNewPassphrase}
                        type="password"
                        passwordType="NONE"
                        autofocus
                      />
                      <CustomInputField
                        currentValue={confirmPassphrase}
                        label="Confirm New Passphrase"
                        onChange={setConfirmPassphrase}
                        type="password"
                        passwordType="NONE"
                      />
                      {passphrasesMismatch && (
                        <DynamicAlertBanner
                          level="error"
                          title="Passphrase Mismatch"
                          description="Passphrases do not match"
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </ModalContainer>

            {/* ── Action Buttons ── */}
            {mode === "passphrase" && (
              <DuoButton
                textButtonA="Cancel"
                textButtonB={isUnlocking ? "Unlocking…" : "Unlock"}
                onClickButtonA={handleCancel}
                onClickButtonB={handlePassphraseSubmit}
                isDisabledButtonB={!pass.trim() || isUnlocking}
                isDisabledButtonA={strict}
                enableColumn
                direction="column"
              />
            )}


            {mode === "forgot" && (
              <DuoButton
                textButtonA="Cancel"
                textButtonB="Reset & Unlock"
                onClickButtonA={handleCancel}
                onClickButtonB={handleForgotSubmit}
                isDisabledButtonB={!forgotReady || isUnlocking}
                isDisabledButtonA={strict}
                enableColumn
                direction="column"
              />
            )}

            <Divider>or</Divider>

            <ExtraButtonContainer>
              <ConfirmationButton
                requiredText="CLEAR MY DATA"
                text="Reset Local Accounts"
                strict
                alertTextTitle="Reset Local Accounts"
                descriptionText={`This will permanently remove all locally stored accounts, identities, and contacts on this device. You will be signed out and this action cannot be undone.\n\nHowever, you can re-import your accounts at any time using your saved JSON files containing the seed phrases.`}
                onClick={handleReset}
              />
              {majikah.isAuthenticated && (
                <SignOutButton
                  $variant="secondary"
                  onClick={handleSignOut}
                  disabled={!majikah.isAuthenticated}
                >
                  Sign Out
                </SignOutButton>
              )}
            </ExtraButtonContainer>
          </DialogContent>
        </DialogOverlay>
      </AlertDialog.Root>
    );
  },
);

UnlockModal.displayName = "UnlockModal";

export default UnlockModal;
