/**
 * modals/CreateGroupModal.tsx
 *
 * Self-contained modal for creating a new contact group.
 * All form state lives here — keystrokes never re-render ContactsPanel.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "@phosphor-icons/react";
import styled from "styled-components";

import PopUpFormButton from "@/components/foundations/PopUpFormButton";
import CustomInputField from "@/components/foundations/CustomInputField";
import CustomColorPicker from "@/components/foundations/CustomColorPicker";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { sendNotification } from "@tauri-apps/plugin-notification";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_GROUP_COLOR = "#ea7f05";
const MAX_GROUPS_LIMIT = 100;

// ─── Styles ───────────────────────────────────────────────────────────────────
const CreateGroupForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const CreateGroupLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface CreateGroupModalProps {
  majik: MajikMessageDatabase;
  groupCount: number;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = React.memo(
  ({ majik, groupCount }) => {
    const [name, setName] = useState("");
    const [color, setColor] = useState<string[]>([DEFAULT_GROUP_COLOR]);
    const [isOpen, setIsOpen] = useState(false);

    const atLimit = groupCount >= MAX_GROUPS_LIMIT;

    // Reset form when modal opens
    useEffect(() => {
      if (isOpen) {
        setName("");
        setColor([DEFAULT_GROUP_COLOR]);
      }
    }, [isOpen]);

    const handleConfirm = useCallback(async () => {
      const trimmed = name.trim();
      if (!trimmed) {
        toast.error("Group name required");
        return;
      }
      try {
        const id = `group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await majik.createGroup(id, trimmed, {
          color: color[0] ?? DEFAULT_GROUP_COLOR,
        });

        sendNotification({
          title: "New Group Created Successfully",
          body: trimmed,
        });
        toast.success("Group created");
      } catch (err) {
        toast.error("Failed to create group", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (err as any)?.message || String(err),
        });
      }
    }, [majik, name, color]);

    return (
      <PopUpFormButton
        id="button-popup-contacts-create-group"
        scrollable={false}
        icon={PlusIcon}
        text="New Group"
        modal={{
          title: "Create Group",
          description: atLimit
            ? "Limit reached. Only 100 groups are allowed."
            : "Create a new contact group.",
        }}
        buttons={{
          cancel: { text: "Cancel" },
          confirm: {
            text: "Create",
            onClick: handleConfirm,
            isDisabled: !name.trim(),
          },
        }}
        disabled={atLimit}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      >
        <CreateGroupForm>
          <CustomInputField
            currentValue={name}
            onChange={(e) => setName(e)}
            maxChar={64}
            label="Group Name"
            required
          />
          <CreateGroupLabel>
            Group Color
            <CustomColorPicker
              currentValue={color}
              max={1}
              defaultColor={DEFAULT_GROUP_COLOR}
              onUpdate={(colors) => setColor(colors)}
            />
          </CreateGroupLabel>
        </CreateGroupForm>
      </PopUpFormButton>
    );
  },
);

CreateGroupModal.displayName = "CreateGroupModal";
