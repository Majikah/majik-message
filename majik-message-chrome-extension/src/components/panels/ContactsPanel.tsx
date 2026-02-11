import styled from "styled-components";
import { useMemo, useState } from "react";
import PopUpFormButton from "../foundations/PopUpFormButton";
import { UserPlusIcon } from "@phosphor-icons/react";
import CustomInputField from "../foundations/CustomInputField";

import { toast } from "sonner";
import CBaseUserAccount from "../base/CBaseUserAccount";
import { SectionTitleFrame } from "../../globals/styled-components";
import { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import DynamicPlaceholder from "../foundations/DynamicPlaceholder";
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

interface ContactsPanelProps {
  majik: MajikMessageDatabase;
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void;
}

const ContactsPanel: React.FC<ContactsPanelProps> = ({ majik, onUpdate }) => {
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [inviteKey, setInviteKey] = useState<string>("");

  const handleAddContact = async () => {
    if (!majik) return;

    if (!inviteKey?.trim()) {
      toast.error("Invalid Invite Key", {
        description: "Please provide a valid invite key.",
        id: `toast-error-add-${inviteKey}`,
      });
      return;
    }
    try {
      await majik.importContactFromString(inviteKey);
      setRefreshKey((prev) => prev + 1);
      toast.success("New Friend Added Succesfully", {
        description: inviteKey,
        id: `toast-success-add-${inviteKey}`,
      });
    } catch (e) {
      toast.error("Failed to Add New Contact", {
        description: (e as any)?.message || e,
        id: "error-majik-add",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!majik) return;

    try {
      majik.removeContact(id);

      onUpdate?.(majik);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to Delete Contact", {
        description: (err as any)?.message || err,
        id: "error-majik-delete",
      });
    }
  };

  // const handleBlock = async (id: string) => {
  //   if (!majik) return;

  //   try {
  //     majik.blockContact(id);

  //     onUpdate?.(majik);
  //     setRefreshKey((prev) => prev + 1);
  //   } catch (err) {
  //     console.error(err);
  //     toast.error("Failed to Block Contact", {
  //       description: (err as any)?.message || err,
  //       id: "error-majik-block",
  //     });
  //   }
  // };

  // const handleUnBlock = async (id: string) => {
  //   if (!majik) return;

  //   try {
  //     majik.unblockContact(id);

  //     onUpdate?.(majik);
  //     setRefreshKey((prev) => prev + 1);
  //   } catch (err) {
  //     console.error(err);
  //     toast.error("Failed to Unblock Contact", {
  //       description: (err as any)?.message || err,
  //       id: "error-majik-unblock",
  //     });
  //   }
  // };

  const contacts = useMemo(() => {
    if (!majik) return [];

    return majik.listContacts(false);
  }, [majik, refreshKey]);

  return (
    <Container>
      <ThemeToggle size={45} />
      <SectionTitleFrame>
        <Row>
          <h2>Contacts</h2>
          <div style={{ display: "flex", flexDirection: "row" }}>
            <PopUpFormButton
              icon={UserPlusIcon}
              text="Add Contact"
              modal={{
                title: "Add Contact",
                description: "Add a new contact to your list.",
              }}
              buttons={{
                cancel: {
                  text: "Cancel",
                },
                confirm: {
                  text: "Save Changes",
                  onClick: handleAddContact,
                },
              }}
            >
              <CustomInputField
                onChange={(e) => setInviteKey(e)}
                maxChar={500}
                label="Invite Key"
                required
                importProp={{
                  type: "txt",
                }}
              />
            </PopUpFormButton>
          </div>
        </Row>
      </SectionTitleFrame>

      {contacts.length > 0 ? (
        <List>
          {contacts.map((c) => (
            <CBaseUserAccount
              key={c.id}
              itemData={c}
              onDelete={() => handleDelete(c.id)}
              // onBlock={() => handleBlock(c.id)}
              // onUnBlock={() => handleUnBlock(c.id)}
            />
          ))}
        </List>
      ) : (
        <List>
          <DynamicPlaceholder>
            {" "}
            You haven&apos;t added any contacts yet.
          </DynamicPlaceholder>
        </List>
      )}
    </Container>
  );
};

export default ContactsPanel;
