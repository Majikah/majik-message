import styled from 'styled-components'
import { useEffect, useMemo, useState } from 'react'
import PopUpFormButton from '../foundations/PopUpFormButton'
import { UserIcon, UserPlusIcon } from '@phosphor-icons/react'
import CustomInputField from '../foundations/CustomInputField'

import { toast } from 'sonner'
import CBaseUserAccount from '../base/CBaseUserAccount'

import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'

import GuideHelper from '../functional/GuideHelper'
import { launchTutorialContacts } from '@renderer/lib/shepherd-js/tutorials/tutorial-contacts'
import { useShepherd } from '@renderer/lib/shepherd-js/use-shepherd'

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_CONTACTS_LIMIT = 1000

// ─── Layout ───────────────────────────────────────────────────────────────────
const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
`

// ─── Panel header ─────────────────────────────────────────────────────────────
const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`

const PanelSubtitle = styled.p`
  font-family: 'Fira Mono', 'JetBrains Mono', monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.5;
  letter-spacing: 0.03em;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

// ─── Scrollable body ──────────────────────────────────────────────────────────
const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px 24px;

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.secondaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`

// ─── Account grid ─────────────────────────────────────────────────────────────
/**
 * auto-fill with 280px minimum — gives 3 columns on wide screens,
 * 2 on medium, 1 on narrow. No breakpoint hacks needed.
 */
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 24px;
  text-align: center;
`

const EmptyIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`

const EmptyTitle = styled.p`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`

const EmptyHint = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  max-width: 220px;
  line-height: 1.55;
  opacity: 0.6;
`

// ─── Account limit badge ──────────────────────────────────────────────────────
const LimitBadge = styled.span`
  font-family: 'Fira Mono', 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 100px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  white-space: nowrap;
`

interface AccountsPanelProps {
  majik: MajikMessageDatabase
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
const AccountsPanel: React.FC<AccountsPanelProps> = ({ majik, onUpdate }) => {
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

  const atLimit = contacts.length >= MAX_CONTACTS_LIMIT

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root id="section-contacts">
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-message/docs/contacts-documentation"
        startTour={() => launchTutorialContacts(tour)}
      />

      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>Contacts</PanelTitle>
          <PanelSubtitle>
            {contacts.length} / {MAX_CONTACTS_LIMIT} contacts
          </PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          {atLimit && <LimitBadge>Limit reached</LimitBadge>}

          {/* Import */}
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
              maxChar={5000}
              label="Invite Key"
              required
              importProp={{
                type: 'txt'
              }}
              sensitive={true}
            />
          </PopUpFormButton>
        </HeaderActions>
      </PanelHeader>

      <Body>
        {contacts.length > 0 ? (
          <Grid>
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
          </Grid>
        ) : (
          <EmptyState>
            <EmptyIcon>
              <UserIcon size={22} />
            </EmptyIcon>
            <EmptyTitle>No contacts yet</EmptyTitle>
            <EmptyHint>You haven&apos;t added any contacts yet.</EmptyHint>
          </EmptyState>
        )}
      </Body>
    </Root>
  )
}

export default AccountsPanel
