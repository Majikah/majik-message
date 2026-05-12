/**
 * modals/CreateKeyModal.tsx
 *
 * Self-contained modal for creating a new key account.
 * Handles the zip/PNG generation and Tauri save dialog internally.
 * Keystrokes never escape to the parent.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import { MajikBytes } from "@majikah/majik-bytes";

import { downloadBlob } from "@/utils/utils";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";
import CustomInputField from "@/components/foundations/CustomInputField";
import { SeedKeyInput } from "@/components/foundations/SeedKeyInput";

import JSZip from "jszip";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import {
  jsonToSeed,
  seedStringToArray,
  MnemonicJSON,
} from "@majikah/majik-message";

interface CreateKeyModalProps {
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

export const CreateKeyModal: React.FC<CreateKeyModalProps> = React.memo(
  ({ open, onOpenChange, majik, onSuccess }) => {
    const [label, setLabel] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [mnemonic, setMnemonic] = useState("");
    const [mnemonicJSON, setMnemonicJSON] =
      useState<MnemonicJSON>(EMPTY_MNEMONIC);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
      if (open) {
        setLabel("");
        setPassphrase("");
        setMnemonic("");
        setMnemonicJSON(EMPTY_MNEMONIC);
        setIsCreating(false);
      }
    }, [open]);

    const handleSeedKeyChange = useCallback((input: MnemonicJSON) => {
      if (!input) return;
      setMnemonicJSON(input);
      setMnemonic(jsonToSeed(input));
    }, []);

    const handleConfirm = useCallback(async () => {
      if (!mnemonic?.trim()) {
        toast.error("Seed phrase required");
        return;
      }
      if (!passphrase?.trim()) {
        toast.error("Password required");
        return;
      }

      setIsCreating(true);
      try {
        const createdAccount = await majik.createAccount(
          mnemonic.trim(),
          passphrase,
          label,
        );
        const jsonData: MnemonicJSON = {
          id: createdAccount.backup,
          seed: seedStringToArray(mnemonic.trim()),
          phrase: passphrase?.trim() ? passphrase.trim() : undefined,
        };
        const base64String = btoa(JSON.stringify(jsonData));
        const seedJSONBlob = new Blob([JSON.stringify(jsonData)], {
          type: "application/json;charset=utf-8",
        });
        const majikByte = await MajikBytes.create(base64String);
        const mbyteFile = await majikByte.toPNG();
        const pngBuffer = await mbyteFile.arrayBuffer();

        const readmeContent = `
Majik Key Backup\n
IMPORTANT: Keep this file secure and private at all times. If lost or compromised, your account access may be permanently at risk.\n\n

Overview\n
This backup ZIP file contains your raw JSON data and a Backup PNG. These files are essential for recovering your account.\n\n

Usage Instructions\n
• Storage: You may delete the JSON file and keep only the PNG file if preferred.\n
• Customization: You can rename the PNG file for added discretion.\n
• Recovery: This PNG allows you to securely re-import your account without exposing raw JSON data.\n\n

Critical Handling Requirements\n
To prevent data corruption and ensure the backup remains functional, please follow these rules:\n

• No Modifications: Do not edit, crop, or apply filters to the PNG image.\n
• No Processing: Avoid running the image through compression tools or "optimization" software.\n
• Storage Only: Store the image as is. Do not upload it to social media, messaging apps, or cloud platforms that automatically compress or manipulate images, as this will destroy the embedded data.\n\n

Backup created on: ${new Date().toLocaleString()}\n
IMPORTANT: Keep this file secure and private at all times. If lost or compromised, your account access may be permanently at risk.\n\n
    `;

        const zip = new JSZip();
        const defaultFileName = `${label} - ${createdAccount.id} - SEED KEY`;
        zip.file("backup.json", seedJSONBlob);
        zip.file("backup.png", pngBuffer, { binary: true });
        zip.file("IMPORTANT README.txt", readmeContent);

        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 9 },
        });

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

        toast.success("Account Created", {
          description: `Key account for ${label || createdAccount.id} created.`,
        });
        sendNotification({
          title: "Key Account Created",
          body: `Account for ${label || "Unknown"} created.`,
        });
        onOpenChange(false);
        onSuccess();
      } catch (err) {
        console.error(err);
        toast.error("Failed to create account.");
      } finally {
        setIsCreating(false);
      }
    }, [majik, mnemonic, passphrase, label, onOpenChange, onSuccess]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Create Key Account",
          description:
            "Create a new encrypted account with a mnemonic seed phrase.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleCancel,
            isDisabled: isCreating,
          },
          confirm: {
            text: isCreating ? "Creating…" : "Create Account",
            isDisabled:
              !label?.trim() ||
              !mnemonicJSON ||
              !passphrase?.trim() ||
              isCreating,
            onClick: handleConfirm,
          },
        }}
      >
        <DynamicAlertBanner
          title="Keep this private"
          description="Never share your seed phrase or backup JSON with anyone. Store your backup in a safe, offline location."
          level="danger"
        />
        <CustomInputField
          onChange={setLabel}
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
          onUpdatePassphrase={(v) => setPassphrase(v?.trim() ? v : "")}
          onChange={handleSeedKeyChange}
          readonly
          currentValue={{ ...mnemonicJSON, phrase: passphrase }}
        />
      </DynamicPopUp>
    );
  },
);

CreateKeyModal.displayName = "CreateKeyModal";
