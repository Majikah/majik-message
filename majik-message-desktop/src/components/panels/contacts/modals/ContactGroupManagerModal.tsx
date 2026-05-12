/**
 * modals/ContactGroupManagerModal.tsx
 *
 * Self-contained sliding dialogue for managing members of a contact group.
 * Owns its own open state — parent just passes the group to manage + contacts.
 */

import React from "react";

import DynamicSlidingDialogue from "@/components/functional/DynamicSlidingDialogue";
import GroupManagerDrawer from "@/components/functional/GroupManagerDrawer";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { MajikContact, MajikContactGroup } from "@majikah/majik-contact";


interface ContactGroupManagerModalProps {
  isOpen: boolean;
  group: MajikContactGroup | null;
  majik: MajikMessageDatabase;
  allContacts: MajikContact[];
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const ContactGroupManagerModal: React.FC<ContactGroupManagerModalProps> =
  React.memo(
    ({ isOpen, group, majik, allContacts, onOpenChange, onUpdate }) => {
      //   const handleCancel = useCallback(
      //     () => onOpenChange(false),
      //     [onOpenChange],
      //   );

      return (
        <DynamicSlidingDialogue
          isOpen={isOpen && !!group}
          onOpenChange={onOpenChange}
          scrollable
          buttons={{
            cancel: { text: "Cancel", hide: true },
            confirm: { text: "Save Changes", hide: true },
          }}
          modal={{
            title: `Manage ${group?.meta?.name || "Group"}`,
            description: "",
          }}
          width={700}
        >
          {isOpen && group && (
            <GroupManagerDrawer
              group={group}
              majik={majik}
              allContacts={allContacts}
              onUpdate={onUpdate}
            />
          )}
        </DynamicSlidingDialogue>
      );
    },
  );

ContactGroupManagerModal.displayName = "ContactGroupManagerModal";
