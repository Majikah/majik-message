import styled from 'styled-components'
import { useEffect, useMemo, useState } from 'react'
import PopUpFormButton from '../foundations/PopUpFormButton'
import { UserPlusIcon } from '@phosphor-icons/react'
import CustomInputField from '../foundations/CustomInputField'

import { toast } from 'sonner'
import CBaseUserAccount from '../base/CBaseUserAccount'
import { SectionTitleFrame } from '../../globals/styled-components'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import DynamicPlaceholder from '../foundations/DynamicPlaceholder'
import GuideHelper from '../functional/GuideHelper'
import { launchTutorialContacts } from '@renderer/lib/shepherd-js/tutorials/tutorial-contacts'
import { useShepherd } from '@renderer/lib/shepherd-js/use-shepherd'

const Container = styled.div`
  width: inherit;
  height: 100%;
  padding: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const List = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    padding: 0;
    margin: 8px 0;
    width: inherit;
    gap: 8px;
  }
`

interface ContactsPanelProps {
  majik: MajikMessageDatabase
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void
}

const ContactsPanel: React.FC<ContactsPanelProps> = ({ majik, onUpdate }) => {
  const tour = useShepherd()
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [inviteKey, setInviteKey] = useState<string>('')

  useEffect(() => {
    if (!majik) return

    const handler = (): void => {
      setRefreshKey((prev) => prev + 1)
    }

    majik.on('new-contact', handler)

    // Cleanup
    return () => {
      majik.off('new-contact', handler)
    }
  }, [majik])

  const handleAddContact = async (): Promise<void> => {
    if (!inviteKey?.trim()) {
      toast.error('Invalid Invite Key', {
        description: 'Please provide a valid invite key.',
        id: `toast-error-add-${inviteKey}`
      })
      return
    }
    try {
      await majik.importContactFromString(inviteKey)
      setRefreshKey((prev) => prev + 1)
      toast.success('New Contact Added Succesfully', {
        description: inviteKey,
        id: `toast-success-add-${inviteKey}`
      })

      window.electron.notify('New Contact Added Succesfully', inviteKey)
    } catch (e) {
      toast.error('Failed to Add New Contact', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: 'error-majik-add'
      })
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      majik.removeContact(id)

      onUpdate?.(majik)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      console.error(err)
      toast.error('Failed to Delete Contact', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: 'error-majik-delete'
      })
    }
  }

  const handleEditLabel = async (id: string, newName: string): Promise<void> => {
    try {
      majik.updateContactMeta(id, { label: newName })
      toast.success('Display Name Updated', {
        description: `Display name for ${id} updated successfully.`,
        id: 'success-majik-message-account-label-update'
      })
      onUpdate?.(majik)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      console.error(err)
      toast.error('Update Failed', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: 'error-majik-message-account-edit'
      })
    }
  }

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
    if (!majik) return []

    return majik.listContacts(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey])

  return (
    <Container id="section-contacts">
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-message/docs/contacts-documentation"
        startTour={() => launchTutorialContacts(tour)}
      />
      <SectionTitleFrame>
        <Row>
          <h2>Contacts</h2>
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <PopUpFormButton
              id="button-popup-contacts-add"
              icon={UserPlusIcon}
              text="Add Contact"
              modal={{
                title: 'Add Contact',
                description: 'Add a new contact to your list.'
              }}
              buttons={{
                cancel: {
                  text: 'Cancel'
                },
                confirm: {
                  text: 'Save Changes',
                  onClick: handleAddContact
                }
              }}
            >
              <CustomInputField
                currentValue={inviteKey}
                onChange={(e) => setInviteKey(e)}
                maxChar={500}
                label="Invite Key"
                required
                importProp={{
                  type: 'txt'
                }}
                sensitive={true}
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
              onUpdateName={(name) => handleEditLabel(c.id, name)}
              // onBlock={() => handleBlock(c.id)}
              // onUnBlock={() => handleUnBlock(c.id)}
            />
          ))}
        </List>
      ) : (
        <DynamicPlaceholder> You haven&apos;t added any contacts yet.</DynamicPlaceholder>
      )}
    </Container>
  )
}

export default ContactsPanel
