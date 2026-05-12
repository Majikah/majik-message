/**
 * modals/ImportContactModal.tsx
 *
 * Externally triggered modal for importing a contact from a backup file or
 * invite key string. Caller controls open/close — no trigger button inside.
 * All form state lives here; keystrokes never re-render the parent.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyboardIcon, UploadSimpleIcon } from "@phosphor-icons/react";

import DynamicPopUp from "@/components/functional/DynamicPopUp";
import CustomInputField from "@/components/foundations/CustomInputField";
import DropImportContact from "@/components/foundations/DropImportContact";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { ImportModeToggle, ModeToggleButton } from "../../shared/atoms";
import { sendNotification } from "@tauri-apps/plugin-notification";

// ─── Props ────────────────────────────────────────────────────────────────────
interface ImportContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikMessageDatabase;
  onSuccess?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ImportContactModal: React.FC<ImportContactModalProps> = React.memo(
  ({ open, onOpenChange, majik, onSuccess }) => {
    const [inviteKey, setInviteKey] = useState("");
    const [importMode, setImportMode] = useState<"drop" | "manual">("drop");

    // Reset form state every time the modal opens
    useEffect(() => {
      if (open) {
        setInviteKey("");
        setImportMode("drop");
      }
    }, [open]);

    const handleDropClear = useCallback(() => setInviteKey(""), []);

    const handleDropFileLoaded = useCallback((input: string) => {
      setInviteKey(input);
    }, []);

    const handleConfirm = useCallback(async () => {
      if (!inviteKey?.trim()) {
        toast.error("Invalid Invite Key", {
          description: "Please provide a valid invite key.",
          id: `toast-error-import-${inviteKey}`,
        });
        return;
      }
      try {
        const importResponse = await majik.importContactFromString(inviteKey);
        if (!importResponse.success) {
          toast.error("Failed to Import Contact", {
            description: importResponse.message,
            id: "error-majik-import",
          });
          return;
        }
        sendNotification({
          title: "New Contact Added Successfully",
          body: inviteKey,
        });
        toast.success("Contact Imported Successfully", {
          id: `toast-success-import-${inviteKey}`,
        });
        onOpenChange(false);
        onSuccess?.();
      } catch (e) {
        toast.error("Failed to Import Contact", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (e as any)?.message || e,
          id: "error-majik-import",
        });
      }
    }, [majik, inviteKey, onOpenChange, onSuccess]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Import Contact",
          description: "Add a new contact from a backup file or invite key.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handleCancel },
          confirm: {
            text: "Import Contact",
            onClick: handleConfirm,
            isDisabled: !inviteKey?.trim(),
          },
        }}
      >
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

        {importMode === "drop" ? (
          <DropImportContact
            inviteKey={inviteKey}
            onFileLoaded={handleDropFileLoaded}
            onClear={handleDropClear}
          />
        ) : (
          <CustomInputField
            currentValue={inviteKey}
            onChange={(e) => setInviteKey(e)}
            maxChar={10000}
            label="Invite Key"
            required
            importProp={{ type: "txt" }}
            sensitive={true}
          />
        )}
      </DynamicPopUp>
    );
  },
);

ImportContactModal.displayName = "ImportContactModal";
