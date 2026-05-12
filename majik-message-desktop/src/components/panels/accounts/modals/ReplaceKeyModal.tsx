/**
 * modals/ReplaceKeyModal.tsx
 *
 * Isolated modal for replacing the local key account with the MUID-bound key.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UploadSimpleIcon, KeyboardIcon } from "@phosphor-icons/react";




import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";
import DropImportAccount from "@/components/foundations/DropImportAccount";
import { SeedKeyInput } from "@/components/foundations/SeedKeyInput";
import { ImportModeToggle, ModeToggleButton } from "../../shared/atoms";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { jsonToSeed, MnemonicJSON } from "@majikah/majik-message";

interface ReplaceKeyModalProps {
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

export const ReplaceKeyModal: React.FC<ReplaceKeyModalProps> = React.memo(
  ({ open, onOpenChange, majik, onSuccess }) => {
    const [passphrase, setPassphrase] = useState("");
    const [mnemonic, setMnemonic] = useState("");
    const [mnemonicJSON, setMnemonicJSON] =
      useState<MnemonicJSON>(EMPTY_MNEMONIC);
    const [importMode, setImportMode] = useState<"drop" | "manual">("drop");

    useEffect(() => {
      if (open) {
        setPassphrase("");
        setMnemonic("");
        setMnemonicJSON(EMPTY_MNEMONIC);
        setImportMode("drop");
      }
    }, [open]);

    const handleClear = useCallback(() => {
      setMnemonicJSON(EMPTY_MNEMONIC);
      setMnemonic("");
      setPassphrase("");
    }, []);

    const handleConfirm = useCallback(async () => {
      if (!mnemonicJSON?.id?.trim() || !passphrase?.trim()) {
        toast.error("Incomplete import data");
        return;
      }
      try {
        await majik.replaceAccountFromMnemonicBackup(
          mnemonicJSON.id,
          mnemonic.trim(),
          passphrase,
          undefined,
        );
        onOpenChange(false);
        onSuccess();
        toast.success("Key account replaced", {
          description: "Your local key now matches the bound MUID key.",
        });
      } catch (err) {
        toast.error("Replace failed", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (err as any)?.message || `${err}`,
        });
      }
    }, [majik, mnemonicJSON, mnemonic, passphrase, onOpenChange, onSuccess]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Switch to Matching Key",
          description:
            "Import the backup for the key bound to your MUID. This will replace your current local account.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handleCancel },
          confirm: {
            text: "Replace Key",
            isDisabled: !mnemonicJSON?.id?.trim() || !passphrase?.trim(),
            onClick: handleConfirm,
          },
        }}
      >
        <DynamicAlertBanner
          level="warning"
          title="Warning"
          description="Your current local key will be removed. Make sure you have its backup before continuing."
        />
        <ImportModeToggle>
          <ModeToggleButton
            $active={importMode === "drop"}
            onClick={() => setImportMode("drop")}
            type="button"
          >
            <UploadSimpleIcon size={12} /> Backup file
          </ModeToggleButton>
          <ModeToggleButton
            $active={importMode === "manual"}
            onClick={() => setImportMode("manual")}
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
            onFileLoaded={(json) => {
              setMnemonicJSON(json);
              setMnemonic(jsonToSeed(json));
            }}
            onClear={handleClear}
          />
        ) : (
          <SeedKeyInput
            importProp={{ type: "json" }}
            requireBackupKey
            onUpdatePassphrase={(v) => setPassphrase(v?.trim() ? v : "")}
            onChange={(input) => {
              if (!input) return;
              setMnemonicJSON(input);
              setMnemonic(jsonToSeed(input));
            }}
            readonly={false}
            currentValue={{ ...mnemonicJSON, phrase: passphrase }}
          />
        )}
      </DynamicPopUp>
    );
  },
);

ReplaceKeyModal.displayName = "ReplaceKeyModal";
