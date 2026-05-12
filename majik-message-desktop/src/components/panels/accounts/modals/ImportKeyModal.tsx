/**
 * modals/ImportKeyModal.tsx
 *
 * Self-contained modal for importing a key account from a mnemonic backup.
 * All form state lives here — keystrokes NEVER re-render the parent panel.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { UploadSimpleIcon, KeyboardIcon } from "@phosphor-icons/react";




import DynamicPopUp from "@/components/functional/DynamicPopUp";
import CustomInputField from "@/components/foundations/CustomInputField";
import DropImportAccount from "@/components/foundations/DropImportAccount";
import { SeedKeyInput } from "@/components/foundations/SeedKeyInput";
import { ImportModeToggle, ModeToggleButton } from "../../shared/atoms";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { jsonToSeed, MnemonicJSON } from "@majikah/majik-message";

interface ImportKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikMessageDatabase;
  onSuccess: () => void;
}

const EMPTY_MNEMONIC: MnemonicJSON = {
  id: "",
  seed: Array(12).fill(""),
  phrase: "",
};

export const ImportKeyModal: React.FC<ImportKeyModalProps> = React.memo(
  ({ open, onOpenChange, majik, onSuccess }) => {
    const [label, setLabel] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [mnemonic, setMnemonic] = useState("");
    const [mnemonicJSON, setMnemonicJSON] =
      useState<MnemonicJSON>(EMPTY_MNEMONIC);
    const [importMode, setImportMode] = useState<"drop" | "manual">("drop");

    // Reset all form state whenever modal opens
    useEffect(() => {
      if (open) {
        setLabel("");
        setPassphrase("");
        setMnemonic("");
        setMnemonicJSON(EMPTY_MNEMONIC);
        setImportMode("drop");
      }
    }, [open]);

    const handleDropClear = useCallback(() => {
      setMnemonicJSON(EMPTY_MNEMONIC);
      setMnemonic("");
      setPassphrase("");
    }, []);

    const handleDropFileLoaded = useCallback((json: MnemonicJSON) => {
      setMnemonicJSON(json);
      setMnemonic(jsonToSeed(json));
    }, []);

    const handleSeedKeyChange = useCallback((input: MnemonicJSON) => {
      if (!input) return;
      setMnemonicJSON(input);
      setMnemonic(jsonToSeed(input));
    }, []);

    const handleConfirm = useCallback(async () => {
      if (!mnemonicJSON?.id?.trim() || !passphrase?.trim()) {
        toast.error("Incomplete import data");
        return;
      }
      try {
        await majik.importAccountFromMnemonicBackup(
          mnemonicJSON.id,
          mnemonic.trim(),
          passphrase || "",
          label,
        );
        toast.success("Account imported");
        sendNotification({
          title: "Account Imported",
          body: `Key account for ${label || mnemonicJSON.id} imported.`,
        });
        onOpenChange(false);
        onSuccess();
      } catch (e) {
        toast.error("Import failed", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (e as any)?.message || `${e}`,
        });
      }
    }, [
      majik,
      mnemonicJSON,
      mnemonic,
      passphrase,
      label,
      onOpenChange,
      onSuccess,
    ]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    const confirmDisabled =
      !mnemonicJSON?.id?.trim() ||
      mnemonicJSON.seed.length === 0 ||
      !passphrase?.trim();

    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Import Key Account",
          description: "Import an account from a mnemonic seed phrase.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handleCancel },
          confirm: {
            text: "Import Account",
            isDisabled: confirmDisabled,
            onClick: handleConfirm,
          },
        }}
      >
        <CustomInputField
          onChange={setLabel}
          maxChar={100}
          regex="letters"
          label="Display Name"
          currentValue={label}
          sensitive
        />
        <ImportModeToggle>
          <ModeToggleButton
            $active={importMode === "drop"}
            onClick={() => {
              setImportMode("drop");
              handleDropClear();
            }}
            type="button"
          >
            <UploadSimpleIcon size={12} /> Backup file
          </ModeToggleButton>
          <ModeToggleButton
            $active={importMode === "manual"}
            onClick={() => {
              setImportMode("manual");
              handleDropClear();
            }}
            type="button"
          >
            <KeyboardIcon size={12} /> Enter manually
          </ModeToggleButton>
        </ImportModeToggle>
        {importMode === "drop" ? (
          <DropImportAccount
            passphrase={passphrase}
            onPassphraseChange={(v) => setPassphrase(v?.trim() ? v : "")}
            mnemonicJSON={mnemonicJSON}
            onFileLoaded={handleDropFileLoaded}
            onClear={handleDropClear}
          />
        ) : (
          <SeedKeyInput
            importProp={{ type: "json" }}
            requireBackupKey
            onUpdatePassphrase={(v) => setPassphrase(v?.trim() ? v : "")}
            onChange={handleSeedKeyChange}
            readonly={false}
            currentValue={{ ...mnemonicJSON, phrase: passphrase }}
          />
        )}
      </DynamicPopUp>
    );
  },
);

ImportKeyModal.displayName = "ImportKeyModal";
