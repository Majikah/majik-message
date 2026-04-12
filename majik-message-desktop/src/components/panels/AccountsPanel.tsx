import styled, { keyframes } from "styled-components";
import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";

import CBaseUserAccount from "../base/CBaseUserAccount";
import PopUpFormButton from "../foundations/PopUpFormButton";
import CustomInputField from "../foundations/CustomInputField";
import { ImportIcon } from "lucide-react";

import { SeedKeyInput } from "../foundations/SeedKeyInput";

import { downloadBlob } from "../../utils/utils";
import {
  KeyboardIcon,
  PlusIcon,
  UploadSimpleIcon,
  UserIcon,
  WarningDiamondIcon,
} from "@phosphor-icons/react";

import {
  jsonToSeed,
  seedStringToArray,
  type MnemonicJSON,
} from "@majikah/majik-message";

import { launchTutorialAccounts } from "@src/lib/shepherd-js/tutorials/tutorial-accounts";
import { useShepherd } from "@src/lib/shepherd-js/use-shepherd";
import GuideHelper from "../functional/GuideHelper";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import { MajikContact } from "@majikah/majik-contact";
import DropImportAccount from "../foundations/DropImportAccount";

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_ACCOUNT_LIMIT = 25;

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

// ─── Scrollable body ──────────────────────────────────────────────────────────
const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px 24px;

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

// ─── Account grid ─────────────────────────────────────────────────────────────
/**
 * auto-fill with 280px minimum — gives 3 columns on wide screens,
 * 2 on medium, 1 on narrow. No breakpoint hacks needed.
 */
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
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
      $active
        ? (theme.colors.primary)
        : theme.colors.secondaryBackground};
  background: ${({ theme, $active }) =>
    $active
      ? `${theme.colors.primary}18`
      : theme.colors.secondaryBackground};
  color: ${({ theme, $active }) =>
    $active ? (theme.colors.primary) : theme.colors.textSecondary};
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

// ─── Security warning ─────────────────────────────────────────────────────────
const SecurityWarning = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(220, 60, 60, 0.07);
  border: 1px solid rgba(220, 60, 60, 0.22);
  margin-bottom: 2em;
  animation: ${fadeIn} 0.2s ease;
`;

const SecurityWarningIcon = styled.div`
  flex-shrink: 0;
  color: #e05050;
  margin-top: 1px;
`;

const SecurityWarningBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const SecurityWarningTitle = styled.p`
  font-size: 11px;
  font-weight: 700;
  color: #e05050;
  margin: 0;
  letter-spacing: 0.02em;
`;

const SecurityWarningText = styled.p`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.5;
  opacity: 0.8;
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface PassphraseUpdateParams {
  id: string;
  passphrase: { old: string; new: string };
}

interface AccountsPanelProps {
  majik: MajikMessageDatabase;
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const AccountsPanel: React.FC<AccountsPanelProps> = ({ majik, onUpdate }) => {
  const tour = useShepherd();

  const [label, setLabel] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [mnemonic, setMnemonic] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [mnemonicJSON, setMnemonicJSON] = useState<MnemonicJSON | undefined>(
    undefined,
  );

  // ── Import mode: "drop" | "manual" ────────────────────────────────────────
  const [importMode, setImportMode] = useState<"drop" | "manual">("drop");

  // ── Listen for account changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!majik) return;
    const handler = (): void => setRefreshKey((prev) => prev + 1);
    majik.on("active-account-change", handler);
    majik.on("new-account", handler);
    return () => {
      majik.off("active-account-change", handler);
      majik.off("new-account", handler);
    };
  }, [majik]);

  // ── Create account ─────────────────────────────────────────────────────────

  const processCreateAccount = async (): Promise<string> => {
    let accountID = "Unknown";

    const createdAccount = await majik.createAccountFromMnemonic(
      mnemonic.trim(),
      passphrase,
      label,
    );
    accountID = createdAccount.id;

    const jsonData: MnemonicJSON = {
      id: createdAccount.backup,
      seed: seedStringToArray(mnemonic.trim()),
      phrase: passphrase?.trim() ? passphrase.trim() : undefined,
    };

    setMnemonicJSON(jsonData);
    const blob = new Blob([JSON.stringify(jsonData)], {
      type: "application/json;charset=utf-8",
    });

    // Open the native save dialog
    const filePath = await save({
      defaultPath: `${label} | ${createdAccount.id} | SEED KEY`,
      filters: [
        {
          name: "Backup JSON",
          extensions: ["json"],
        },
      ],
    });

    // User cancelled the dialog
    if (!filePath) {
      downloadBlob(blob, "json", `${label} | ${createdAccount.id} | SEED KEY`);
    } else {
      // Convert blob → Uint8Array and write to the chosen path
      const arrayBuffer = await blob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(arrayBuffer));
    }

    toast.success("Account Created Successfully", {
      description: `New account for ${label || accountID} created.`,
      id: `toast-success-create-${label}`,
    });

    resetForm();
    onUpdate?.(majik);
    setRefreshKey((prev) => prev + 1);

    return `New Account for ${label || accountID} created successfully.`;
  };

  const handleCreateAccount = async (): Promise<void> => {
    if (!mnemonic?.trim()) {
      toast.error("Failed to create account", {
        description: "Mnemonic Seed Phrase must be a non-empty string.",
        id: "toast-error-create",
      });
      return;
    }

    if (!passphrase?.trim()) {
      toast.error("Failed to create account", {
        description: "Password must be a non-empty string.",
        id: "toast-error-create",
      });
      return;
    }

    toast.promise(processCreateAccount(), {
      loading: "Creating your account...",
      success: (msg) => {
        sendNotification({
          title: "Account Created Successfully",
          body: `New Account for ${label || "Unknown"} created successfully.`,
        });

        return msg;
      },
      error: (err) => {
        console.error(err);
        return "Oh no... There's a problem while creating your account.";
      },
    });
  };

  // ── Edit label ─────────────────────────────────────────────────────────────
  const handleEditLabel = async (
    id: string,
    newName: string,
  ): Promise<void> => {
    try {
      majik.updateContactMeta(id, { label: newName });
      toast.success("Display Name Updated", {
        description: `Display name updated successfully.`,
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

  // ── Share invite key ───────────────────────────────────────────────────────
  const handleShare = async (id: string): Promise<void> => {
    const s = await majik.exportContactAsString(id);
    if (!s) {
      toast.error("Failed to copy", { id: `toast-error-share-${id}` });
      return;
    }
    try {
      await navigator.clipboard.writeText(s);
      toast.success("Invite Key copied to clipboard", {
        description: s,
        id: `toast-success-share-${id}`,
      });
    } catch (err) {
      toast.error("Failed to copy", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: `toast-error-share-${id}`,
      });
    }
  };

  // ── Copy public key ────────────────────────────────────────────────────────
  const handleGetPublicKey = async (contact: MajikContact): Promise<void> => {
    const pkey = await contact.getPublicKeyBase64();
    if (!pkey) {
      toast.error("Failed to copy", { id: `toast-error-get-key-${pkey}` });
      return;
    }
    try {
      await navigator.clipboard.writeText(pkey);
      toast.success("Public Key copied", {
        description: pkey,
        id: `toast-success-get-key-${pkey}`,
      });
    } catch (err) {
      toast.error("Failed to copy", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: `toast-error-get-key-${pkey}`,
      });
    }
  };

  // ── Delete account ─────────────────────────────────────────────────────────
  const handleDelete = async (id: string): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (majik as any).keyStore?.deleteIdentity?.(id).catch?.(() => {});
      try {
        const { MajikKeyStore } = await import("@majikah/majik-message");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (MajikKeyStore as any).deleteIdentity(id);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        /* ignore */
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((majik as any).removeOwnAccount) (majik as any).removeOwnAccount(id);
      onUpdate?.(majik);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Delete Failed", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: "error-majik-message-account-delete",
      });
    }
  };

  // ── Edit passphrase ────────────────────────────────────────────────────────
  const handleEditPassphrase = async (
    input: PassphraseUpdateParams,
  ): Promise<void> => {
    try {
      majik.updatePassphrase(
        input.passphrase.old,
        input.passphrase.new,
        input.id,
      );
      onUpdate?.(majik);
      setRefreshKey((prev) => prev + 1);
      const name = await majik.getContactByID(input.id)?.getDisplayName();
      toast.success("Passphrase Updated", {
        description: `Passphrase for ${name} updated.`,
        id: "success-majik-message-account-passphrase-update",
      });
    } catch (err) {
      console.error(err);
      toast.error("Update Failed", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: "error-majik-message-account-passphrase-update",
      });
    }
  };

  // ── Import mnemonic ────────────────────────────────────────────────────────
  const handleLoadMnemonicAccount = async (): Promise<void> => {
    if (!majik) {
      toast.error("Problem Loading Majik Signature");
      return;
    }
    if (!mnemonicJSON) {
      toast.error("Invalid Backup File", {
        description: "There seems to be a problem with the backup file.",
      });
      return;
    }

    if (!passphrase?.trim()) {
      toast.error("Invalid Passphrase", {
        description: "Please provide a valid passphrase.",
      });
      return;
    }
    try {
      await majik.importAccountFromMnemonicBackup(
        mnemonicJSON.id,
        mnemonic.trim(),
        passphrase || "",
        label,
      );
      resetForm();
      toast.success("Account imported from mnemonic backup");

      sendNotification({
        title: "Account Imported Successfully",
        body: `New Account for ${label || mnemonicJSON.id} created successfully.`,
      });
      onUpdate?.(majik);

      setRefreshKey((k) => k + 1);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import mnemonic backup", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
      });
    }
  };

  // ── Set active account ─────────────────────────────────────────────────────
  const handleSetAsActive = async (contact: MajikContact): Promise<void> => {
    if (!contact?.id?.trim()) {
      toast.error("Failed to set account as active", {
        description: "Unknown ID",
        id: "toast-error-active-missing-id",
      });
      return;
    }
    try {
      const ok = await majik.setActiveAccount(contact.id);
      if (!ok) {
        toast.error("Unauthorized Access", {
          description: "Failed to set account active — incorrect password.",
          id: `toast-error-active-${contact.id}`,
        });
        return;
      }

      // majik.clearIdentity();
      setRefreshKey((prev) => prev + 1);
      toast.success("Switched to this Account", {
        description: contact?.meta?.label || contact.id,
        id: `toast-success-switch-account-${contact.id}`,
      });
    } catch (e) {
      toast.error("Failed to set account as active", {
        description: `${e}`,
        id: `toast-error-active-${contact.id}`,
      });
    }
  };

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = (): void => {
    setLabel("");
    setPassphrase("");
    setMnemonic("");
    setMnemonicJSON(undefined);
  };

  const handleUpdatePassphrase = (value: string): void => {
    setPassphrase(value?.trim() ? value : "");
  };

  const handleSeedKeyChange = (input: MnemonicJSON): void => {
    if (!input || input.seed.length <= 0) return;
    setMnemonicJSON(input);
    setMnemonic(jsonToSeed(input));
  };

  // ── Drop import handlers ───────────────────────────────────────────────────
  const handleDropFileLoaded = (json: MnemonicJSON): void => {
    setMnemonicJSON(json);
    setMnemonic(jsonToSeed(json));
  };

  const handleDropClear = (): void => {
    setMnemonicJSON(undefined);
    setMnemonic("");
    setPassphrase("");
  };

  // ── Accounts list ──────────────────────────────────────────────────────────
  const userAccounts = useMemo(
    () => majik.listOwnAccounts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik, refreshKey],
  );

  const atLimit = userAccounts.length >= MAX_ACCOUNT_LIMIT;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root id="section-accounts">
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-message/docs/accounts-documentation"
        startTour={() => launchTutorialAccounts(tour)}
      />

      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>Accounts</PanelTitle>
          <PanelSubtitle>
            {userAccounts.length} / {MAX_ACCOUNT_LIMIT} accounts
          </PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          {atLimit && <LimitBadge>Limit reached</LimitBadge>}

          {/* Import */}
          <PopUpFormButton
            id="button-popup-accounts-import"
            scrollable
            icon={ImportIcon}
            text="Import"
            disabled={atLimit}
            modal={{
              title: "Import Account",
              description: atLimit
                ? "Maximum account limit reached."
                : "Import an account from a mnemonic seed phrase.",
            }}
            buttons={{
              cancel: { text: "Cancel", onClick: resetForm },
              confirm: {
                text: "Import Account",
                isDisabled:
                  !mnemonicJSON?.id?.trim() ||
                  !mnemonicJSON ||
                  mnemonicJSON.seed.length === 0 ||
                  !passphrase?.trim(),
                onClick: handleLoadMnemonicAccount,
                confirmationText:
                  "Importing your account and deriving the passphrase using Argon2. This may take several seconds, and your screen may temporarily freeze. Please do not close or refresh.",
              },
            }}
          >
            {/* Display name (shared by both modes) */}
            <CustomInputField
              onChange={(e) => setLabel(e)}
              maxChar={100}
              regex="letters"
              label="Display Name"
              currentValue={label}
              sensitive
            />

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
              <DropImportAccount
                passphrase={passphrase}
                onPassphraseChange={handleUpdatePassphrase}
                mnemonicJSON={mnemonicJSON}
                onFileLoaded={handleDropFileLoaded}
                onClear={handleDropClear}
              />
            )}

            {/* Manual input (existing flow) */}
            {importMode === "manual" && (
              <SeedKeyInput
                importProp={{ type: "json" }}
                requireBackupKey
                onUpdatePassphrase={handleUpdatePassphrase}
                onChange={handleSeedKeyChange}
                currentValue={
                  mnemonicJSON
                    ? { ...mnemonicJSON, phrase: passphrase }
                    : undefined
                }
              />
            )}
          </PopUpFormButton>

          {/* Create */}
          <PopUpFormButton
            id="button-popup-accounts-create"
            scrollable
            icon={PlusIcon}
            text="Create Account"
            disabled={atLimit}
            modal={{
              title: "Create Account",
              description: atLimit
                ? "Maximum account limit reached."
                : "Create a new encrypted account with a mnemonic seed phrase.",
            }}
            buttons={{
              cancel: { text: "Cancel" },
              confirm: {
                text: "Create Account",
                isDisabled:
                  !label?.trim() || !mnemonicJSON || !passphrase?.trim(),
                onClick: handleCreateAccount,
                confirmationText:
                  "Creating your account and deriving the passphrase using Argon2. This may take several seconds, and your screen may temporarily freeze. Please do not close or refresh.",
              },
            }}
          >
            {/* Security warning */}
            <SecurityWarning>
              <SecurityWarningIcon>
                <WarningDiamondIcon size={15} weight="fill" />
              </SecurityWarningIcon>
              <SecurityWarningBody>
                <SecurityWarningTitle>Keep this private</SecurityWarningTitle>
                <SecurityWarningText>
                  Never share your seed phrase or backup JSON file with anyone.
                  Anyone who has them gains full access to your account. Store
                  your backup in a safe, offline location.
                </SecurityWarningText>
              </SecurityWarningBody>
            </SecurityWarning>

            <CustomInputField
              onChange={(e) => setLabel(e)}
              maxChar={100}
              regex="letters"
              label="Display Name"
              currentValue={label}
              required
              importProp={{ type: "txt" }}
              sensitive
            />
            <SeedKeyInput
              importProp={{ type: "json" }}
              allowGenerate
              onUpdatePassphrase={handleUpdatePassphrase}
              onChange={handleSeedKeyChange}
            />
          </PopUpFormButton>
        </HeaderActions>
      </PanelHeader>

      <Body>
        {userAccounts.length > 0 ? (
          <Grid>
            {userAccounts.map((account, index) => (
              <CBaseUserAccount
                key={account.id}
                index={index}
                itemData={account}
                onUpdateName={(name) => handleEditLabel(account.id, name)}
                onDelete={() => handleDelete(account.id)}
                onShare={() => handleShare(account.id)}
                onCopyPublicKey={handleGetPublicKey}
                onSetActive={(item) =>
                  majik?.isAccountActive(item.id)
                    ? undefined
                    : handleSetAsActive(account)
                }
                onUpdatePassphrase={handleEditPassphrase}
                // onRegister={handleRegisterOnline}
              />
            ))}
          </Grid>
        ) : (
          <EmptyState>
            <EmptyIcon>
              <UserIcon size={22} />
            </EmptyIcon>
            <EmptyTitle>No accounts yet</EmptyTitle>
            <EmptyHint>
              Create or import an account to start using Majik Signature.
            </EmptyHint>
          </EmptyState>
        )}
      </Body>
    </Root>
  );
};

export default AccountsPanel;
