/**
 * modals/AddContactModal.tsx
 *
 * Self-contained modal for adding a contact from a backup file or invite key.
 * All form state lives here — keystrokes never re-render ContactsPanel.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  KeyboardIcon,
  UploadSimpleIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";

import PopUpFormButton from "@/components/foundations/PopUpFormButton";
import CustomInputField from "@/components/foundations/CustomInputField";
import DropImportContact from "@/components/foundations/DropImportContact";

import { ImportModeToggle, ModeToggleButton } from "../../shared/atoms";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";

interface AddContactModalProps {
  majik: MajikMessageDatabase;
  disabled?: boolean;
}

export const AddContactModal: React.FC<AddContactModalProps> = React.memo(
  ({ majik, disabled }) => {
    const [inviteKey, setInviteKey] = useState("");
    const [importMode, setImportMode] = useState<"drop" | "manual">("drop");
    const [isOpen, setIsOpen] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
      if (isOpen) {
        setInviteKey("");
        setImportMode("drop");
      }
    }, [isOpen]);

    const handleDropClear = useCallback(() => setInviteKey(""), []);

    const handleDropFileLoaded = useCallback((input: string) => {
      setInviteKey(input);
    }, []);

    const handleConfirm = useCallback(async () => {
      if (!inviteKey?.trim()) {
        toast.error("Invalid Invite Key", {
          description: "Please provide a valid invite key.",
          id: `toast-error-add-${inviteKey}`,
        });
        return;
      }
      try {
        const importResponse = await majik.importContactFromString(inviteKey);
        if (!importResponse.success) {
          toast.error("Failed to Add New Contact", {
            description: importResponse.message,
            id: "error-majik-add",
          });
          return;
        }

        sendNotification({
          title: "New Contact Added Successfully",
          body: inviteKey,
        });
        toast.success("New Contact Added Successfully", {
          id: `toast-success-add-${inviteKey}`,
        });
      } catch (e) {
        toast.error("Failed to Add New Contact", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (e as any)?.message || e,
          id: "error-majik-add",
        });
      }
    }, [majik, inviteKey]);

    return (
      <PopUpFormButton
        id="button-popup-contacts-add"
        icon={UserPlusIcon}
        text="Add Contact"
        modal={{
          title: "Add Contact",
          description: "Add a new contact to your list.",
        }}
        buttons={{
          cancel: { text: "Cancel" },
          confirm: { text: "Save Changes", onClick: handleConfirm },
        }}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        disabled={disabled}
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
      </PopUpFormButton>
    );
  },
);

AddContactModal.displayName = "AddContactModal";
