/**
 * modals/ExportAccountKeyModal.tsx
 *
 * Self-contained modal for exporting the active key account as a ZIP backup.
 * The user must supply their original mnemonic seed words to authorize the export.
 * Keystrokes never escape to the parent.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import { downloadBlob } from "@/utils/utils";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";
import { SeedKeyInput } from "@/components/foundations/SeedKeyInput";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { MnemonicJSON } from "@majikah/majik-message";

interface ExportAccountKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikMessageDatabase;
  onSuccess?: () => void;
}

const EMPTY_MNEMONIC: MnemonicJSON = {
  id: "",
  seed: Array(12).fill(""),
  phrase: "",
};

export const ExportAccountKeyModal: React.FC<ExportAccountKeyModalProps> =
  React.memo(({ open, onOpenChange, majik, onSuccess }) => {
    const [mnemonicJSON, setMnemonicJSON] =
      useState<MnemonicJSON>(EMPTY_MNEMONIC);
    const [isExporting, setIsExporting] = useState(false);

    // Reset form whenever modal opens
    useEffect(() => {
      if (open) {
        setMnemonicJSON(EMPTY_MNEMONIC);
        setIsExporting(false);
      }
    }, [open]);

    const handleSeedKeyChange = useCallback((input: MnemonicJSON) => {
      if (!input) return;
      setMnemonicJSON(input);
    }, []);

    const handleConfirm = useCallback(async () => {
      const seed = mnemonicJSON.seed;

      if (!seed.length || seed.some((w) => !w.trim())) {
        toast.error("All seed words are required");
        return;
      }

      setIsExporting(true);
      try {
        const zipBlob = await majik.exportActiveAccountKey(seed);

        if (!zipBlob) {
          toast.error("Export failed", {
            description: "No active account found or account is locked.",
          });
          return;
        }

        const activeKey = majik.getActiveAccountKey();
        const accountId = activeKey?.id ?? "account";
        const defaultFileName = `${accountId} - SEED KEY`;

        const filePath = await save({
          defaultPath: defaultFileName,
          filters: [{ name: "Backup ZIP", extensions: ["zip"] }],
        });

        if (!filePath) {
          downloadBlob(zipBlob, "zip", defaultFileName);
        } else {
          const ab = await zipBlob.arrayBuffer();
          await writeFile(filePath, new Uint8Array(ab));
        }

        toast.success("Account exported", {
          description: `Backup saved for account ${accountId}.`,
        });
        sendNotification({
          title: "Key Account Exported",
          body: `Backup ZIP saved for account ${accountId}.`,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err) {
        console.error(err);
        toast.error("Export failed", {
          description: (err as any)?.message || `${err}`,
        });
      } finally {
        setIsExporting(false);
      }
    }, [majik, mnemonicJSON, onOpenChange, onSuccess]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    const confirmDisabled =
      isExporting ||
      mnemonicJSON.seed.length === 0 ||
      mnemonicJSON.seed.some((w) => !w.trim());

    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Export Key Account",
          description: "Download a ZIP backup of the active key account.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleCancel,
            isDisabled: isExporting,
          },
          confirm: {
            text: isExporting ? "Exporting…" : "Export Account",
            isDisabled: confirmDisabled,
            onClick: handleConfirm,
          },
        }}
      >
        <DynamicAlertBanner
          title="Your seed phrase is required"
          description="To export your account key you must enter the original 12-word mnemonic seed phrase you were given when the account was created. Never share this backup with anyone."
          level="danger"
        />
        <SeedKeyInput
          importProp={{ type: "json" }}
          onChange={handleSeedKeyChange}
          readonly={false}
          currentValue={mnemonicJSON}
        />
      </DynamicPopUp>
    );
  });

ExportAccountKeyModal.displayName = "ExportAccountKeyModal";
