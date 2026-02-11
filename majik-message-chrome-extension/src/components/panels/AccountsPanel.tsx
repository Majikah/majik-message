import styled from "styled-components";
import { useState } from "react";

import { toast } from "sonner";

import CBaseUserAccount from "../base/CBaseUserAccount";
import PopUpFormButton from "../foundations/PopUpFormButton";
import CustomInputField from "../foundations/CustomInputField";
import { ImportIcon } from "lucide-react";
import { SeedKeyInput } from "../foundations/SeedKeyInput";

import { downloadBlob } from "../../utils/utils";
import { PlusIcon } from "@phosphor-icons/react";
import {
  MajikContact,
  jsonToSeed,
  MnemonicJSON,
  seedStringToArray,
} from "@majikah/majik-message";
import { SectionTitleFrame } from "../../globals/styled-components";
import DynamicPlaceholder from "../foundations/DynamicPlaceholder";
import { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import ThemeToggle from "../functional/ThemeToggle";

const Container = styled.div`
  width: inherit;
  height: 100%;
  padding: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 8px 0;
  width: inherit;
  gap: 8px;
`;
const MAX_ACCOUNT_LIMIT = 25;

interface PassphraseUpdateParams {
  id: string;
  passphrase: { old: string; new: string };
}

interface AccountsPanelProps {
  majik: MajikMessageDatabase;
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void;
  accounts: MajikContact[];
}

// ======== Main Component ========

const AccountsPanel: React.FC<AccountsPanelProps> = ({
  majik,
  onUpdate,
  accounts,
}) => {
  const [label, setLabel] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [mnemonic, setMnemonic] = useState<string>("");

  const [, setRefreshKey] = useState<number>(0);

  const [mnemonicJSON, setMnemonicJSON] = useState<MnemonicJSON | undefined>(
    undefined,
  );

  const handleCreate = async (): Promise<void> => {
    if (!majik) {
      toast.error("Problem Loading Majik Message");
      return;
    }

    try {
      let accountID: string = "Unknown";

      if (mnemonic && mnemonic.trim().length > 0) {
        if (!passphrase?.trim()) {
          toast.error("Failed to create account", {
            description: "Password must be a non-empty string.",
            id: `toast-error-create`,
          });
          return;
        }

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

        const jsonString = JSON.stringify(jsonData);

        const blob = new Blob([jsonString], {
          type: "application/json;charset=utf-8",
        });
        downloadBlob(
          blob,
          "json",
          `${label} | ${createdAccount.id} | SEED KEY`,
        );
      } else {
        const res = await majik.createAccount(passphrase, label);
        accountID = res.id;
        // provide backup for download immediately
        const blob = new Blob([res.backup], {
          type: "application/octet-stream",
        });
        downloadBlob(blob, "txt", `${label} | ${res.id} | BACKUP KEY`);
      }

      toast.success("Account Created Successfully", {
        description: `New Account for ${label || accountID} created successfully.`,
        id: `toast-success-create-${label}`,
      });

      setLabel("");
      setPassphrase("");
      setMnemonic("");
      setMnemonicJSON(undefined);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Account Creation Failed", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: "error-majik-message-account-create",
      });
    }
  };
  const handleEditLabel = async (id: string) => {
    const newLabel =
      prompt(
        "New label:",
        accounts.find((a) => a.id === id)?.meta?.label || "",
      ) || "";
    if (!majik) return;
    try {
      majik.updateContactMeta(id, { label: newLabel });
      onUpdate?.(majik);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Update Failed", {
        description: (err as any)?.message || err,
        id: "error-majik-message-account-edit",
      });
    }
  };

  const handleShare = async (id: string) => {
    if (!majik) return;
    const s = await majik.exportContactAsString(id);
    if (!s) {
      toast.error("Failed to copy to clipboard", {
        description: s,
        id: `toast-error-share-${id}`,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(s);
      toast.success("Invite Key copied to clipboard", {
        description: s,
        id: `toast-success-share-${id}`,
      });
    } catch (e) {
      // fallback: show in prompt
      toast.error("Failed to copy to clipboard", {
        description: s,
        id: `toast-error-share-${id}`,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!majik) return;

    try {
      // Delete from KeyStore storage then remove from majik's in-memory list
      await (majik as any).keyStore?.deleteIdentity?.(id).catch?.(() => {});
      // Try using KeyStore API directly if available
      try {
        const { KeyStore } = await import("@majikah/majik-message");
        await (KeyStore as any).deleteIdentity(id);
      } catch (e) {
        // ignore
      }

      if ((majik as any).removeOwnAccount) (majik as any).removeOwnAccount(id);
      onUpdate?.(majik);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Delete Failed", {
        description: (err as any)?.message || err,
        id: "error-majik-message-account-delete",
      });
    }
  };

  const handleEditPassphrase = (input: PassphraseUpdateParams) => {
    if (!majik) return;
    try {
      majik.updatePassphrase(
        input.passphrase.old,
        input.passphrase.new,
        input.id,
      );
      onUpdate?.(majik);
      setRefreshKey((prev) => prev + 1);
      toast.success("Passphrase Updated", {
        description: `Passphrase for ${input.id} updated successfully.`,
        id: "success-majik-message-account-passphrase-update",
      });
    } catch (err) {
      console.error(err);
      toast.error("Update Failed", {
        description: (err as any)?.message || err,
        id: "error-majik-message-account-passphrase-update",
      });
    }
  };

  const handleLoadMnemonicAccount = async (): Promise<void> => {
    if (!majik) {
      toast.error("Problem Loading Majik Message");
      return;
    }

    if (!mnemonicJSON) {
      toast.error("Invalid Backup File", {
        description: "There seems to be a problem with the backup file.",
      });
      return;
    }
    try {
      await majik.importAccountFromMnemonicBackup(
        mnemonicJSON.id,
        mnemonic.trim(),
        mnemonicJSON.phrase || "",
        label,
      );

      setLabel("");
      setPassphrase("");
      setMnemonic("");
      setMnemonicJSON(undefined);

      toast.success("Account imported from mnemonic backup");
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
  const handleSetAsActive = (contact: MajikContact) => {
    if (!majik) return;

    if (!contact?.id?.trim()) {
      toast.error("Failed to set this account as active", {
        description: "Unknown ID",
        id: `toast-error-active-missing-id`,
      });
      return;
    }
    try {
      majik.setActiveAccount(contact.id);
      setRefreshKey((prev) => prev + 1);
      toast.success("Switched to this Account", {
        description: `${contact?.meta?.label || contact.id}`,
        id: `toast-success-switch-account-${contact.id}`,
      });
    } catch (e) {
      toast.error("Failed to set this account as active", {
        description: `${e}`,
        id: `toast-error-active-${contact.id}`,
      });
    }
  };

  const handleUpdatePassphrase = (value: string) => {
    if (!value?.trim()) {
      setPassphrase("");
      return;
    }
    setPassphrase(value);
    setRefreshKey((prev) => prev + 1);
  };

  const handleSeedKeyChange = (input: MnemonicJSON) => {
    if (!input || input.seed.length <= 0) return;
    setMnemonicJSON(input);
    const stringSeed = jsonToSeed(input);
    setMnemonic(stringSeed);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <Container>
      <ThemeToggle size={45} />
      <SectionTitleFrame>
        <Row>
          <h2>Accounts</h2>
          <div style={{ display: "flex", flexDirection: "row" }}>
            <PopUpFormButton
              scrollable
              icon={ImportIcon}
              text="Import"
              disabled={accounts.length >= MAX_ACCOUNT_LIMIT}
              modal={{
                title: "Import Account",
                description:
                  accounts.length >= MAX_ACCOUNT_LIMIT
                    ? "Max accounts reached."
                    : "Import an account from a mnemonic seed phrase.",
              }}
              buttons={{
                cancel: {
                  text: "Cancel",
                },
                confirm: {
                  text: "Save Changes",
                  isDisabled:
                    !mnemonicJSON?.id?.trim() ||
                    !mnemonicJSON ||
                    mnemonicJSON.seed.length === 0 ||
                    !passphrase?.trim(),
                  onClick: handleLoadMnemonicAccount,
                },
              }}
            >
              <CustomInputField
                onChange={(e) => setLabel(e)}
                maxChar={100}
                regex="letters"
                label="Display Name"
                currentValue={label}
                sensitive={true}
              />
              <SeedKeyInput
                importProp={{
                  type: "json",
                }}
                requireBackupKey={true}
                onUpdatePassphrase={handleUpdatePassphrase}
                onChange={handleSeedKeyChange}
                currentValue={mnemonicJSON}
              />
            </PopUpFormButton>
            <PopUpFormButton
              scrollable
              icon={PlusIcon}
              text="Create Account"
              disabled={accounts.length >= MAX_ACCOUNT_LIMIT}
              modal={{
                title: "Create Account",
                description:
                  accounts.length >= MAX_ACCOUNT_LIMIT
                    ? "Max accounts reached."
                    : "Create a new account with a mnemonic seed phrase.",
              }}
              buttons={{
                cancel: {
                  text: "Cancel",
                },
                confirm: {
                  text: "Save Changes",
                  isDisabled:
                    !label?.trim() || !mnemonicJSON || !passphrase?.trim(),
                  onClick: handleCreate,
                },
              }}
            >
              <CustomInputField
                onChange={(e) => setLabel(e)}
                maxChar={100}
                regex="letters"
                label="Display Name"
                required
                importProp={{
                  type: "txt",
                }}
                currentValue={label}
              />
              <SeedKeyInput
                importProp={{
                  type: "json",
                }}
                allowGenerate={true}
                onUpdatePassphrase={handleUpdatePassphrase}
                onChange={handleSeedKeyChange}
              />
            </PopUpFormButton>
          </div>
        </Row>
      </SectionTitleFrame>

      {accounts.length > 0 ? (
        <List>
          {accounts.map((a, index) => (
            <CBaseUserAccount
              key={a.id}
              index={index}
              itemData={a}
              onEdit={() => handleEditLabel(a.id)}
              onDelete={() => handleDelete(a.id)}
              onShare={() => handleShare(a.id)}
              onSetActive={(item) =>
                !!majik?.isAccountActive(item.id)
                  ? undefined
                  : handleSetAsActive(a)
              }
              onUpdatePassphrase={handleEditPassphrase}
            />
          ))}
        </List>
      ) : (
        <List>
          <DynamicPlaceholder>
            You haven&apos;t created any accounts yet.
          </DynamicPlaceholder>
        </List>
      )}
    </Container>
  );
};

export default AccountsPanel;
