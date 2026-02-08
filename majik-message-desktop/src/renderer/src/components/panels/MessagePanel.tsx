import styled from 'styled-components'
import { useEffect, useMemo, useState } from 'react'
import PopUpFormButton from '../foundations/PopUpFormButton'
import { UserPlusIcon } from '@phosphor-icons/react'
import CustomInputField from '../foundations/CustomInputField'
import { MajikContact, MessageEnvelope } from '@majikah/majik-message'

import { toast } from 'sonner'

import TextEditPreviewInput from '../functional/TextEditPreviewInput'

import { MajikContactListSelector } from '../MajikContactListSelector'
import { SectionSubTitle, SectionTitleFrame, Subtext } from '../../globals/styled-components'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import DynamicPlaceholder from '../foundations/DynamicPlaceholder'

import { ChoiceButton } from '@renderer/globals/buttons'
import { useNavigate } from 'react-router-dom'

const Container = styled.div`
  width: inherit;
  height: 100%;
  padding: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const BodyContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 8px 0;
  width: inherit;
  gap: 8px;
  width: 100%;
`

const EmptyContainer = styled(BodyContainer)`
  max-width: 600px;
`

interface MessagePanelProps {
  majik: MajikMessageDatabase
}

const MessagePanel: React.FC<MessagePanelProps> = ({ majik }) => {
  const navigate = useNavigate()
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [inviteKey, setInviteKey] = useState<string>('')

  const [recipients, setRecipients] = useState<MajikContact[]>(() => {
    const myAccount = majik.getActiveAccount()
    if (!myAccount) return []
    return [myAccount]
  })

  const [myAccount] = useState<MajikContact | null>(() => {
    const userAccount = majik.getActiveAccount()
    if (!userAccount) return null
    return userAccount
  })

  useEffect(() => {
    // define an async function inside useEffect
    const unlockIdentity = async (): Promise<void> => {
      try {
        if (!majik) return
        const activeAccount = majik.getActiveAccount()
        if (!activeAccount) return
        await majik.ensureIdentityUnlocked(activeAccount.id)

        console.log('Access granted: Identity unlocked')
      } catch (err) {
        toast.error('Unlock failed', {
          description: `Incorrect passphrase. Please try again. ${err}`,
          id: 'toast-error-unlock'
        })
        console.warn('Failed to unlock identity:', err)
      }
    }

    // call the async function
    unlockIdentity()
  }, [majik]) // add dependencies as needed

  const handleAddContact = async (): Promise<void> => {
    if (!majik) return

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
      toast.success('New Friend Added Succesfully', {
        description: inviteKey,
        id: `toast-success-add-${inviteKey}`
      })
    } catch (e) {
      toast.error('Failed to Add New Contact', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: 'error-majik-add'
      })
    }
  }

  const handleRecipientsUpdate = (updated: MajikContact[]): void => {
    if (updated.length === 0) {
      if (!myAccount) {
        setRecipients([])
      } else {
        setRecipients([myAccount])
      }
    }
    setRecipients(updated)
  }

  const handleRecipientsClear = (): void => {
    if (!myAccount) {
      setRecipients([])
    } else {
      setRecipients([myAccount])
    }
  }

  const handleEncryptMessage = async (input: string): Promise<string> => {
    if (!input?.trim()) {
      return ''
    }

    if (!myAccount) {
      return 'No active account found.'
    }

    if (!recipients || recipients.length === 0) {
      return 'No recipients selected.'
    }

    const recipientIds = recipients.map((contact) => contact.id)

    const encryptedMessage = await majik.encryptTextForScanner(input, recipientIds, false)
    return encryptedMessage ?? ''
  }

  const handleDecryptMessage = async (input: string): Promise<string> => {
    if (!input?.trim()) {
      return ''
    }

    if (!myAccount) {
      return 'No active account found.'
    }

    const envelope = MessageEnvelope.fromMatchedString(input)

    const encryptedMessage = await majik.decryptEnvelope(envelope, true)
    return encryptedMessage
  }

  const handleGoToAccounts = (): void => {
    navigate('/accounts')
  }

  const contacts = useMemo(() => {
    if (!majik) return []

    return majik.listContacts(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey])

  return (
    <Container>
      <SectionTitleFrame>
        <Row>
          Message
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <PopUpFormButton
              icon={UserPlusIcon}
              text="Add Contact"
              modal={{
                title: 'Add Friend',
                description: 'Add a new contact to your friend list.'
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
              />
            </PopUpFormButton>
          </div>
        </Row>
      </SectionTitleFrame>
      <Subtext>
        This is your Local Message Encryptor/Decryptor, a secure space to encrypt and decrypt
        messages both online and offline. Unlike the Chats window, which is for live conversations
        with other Majikah users, this tool works with any message—even if the recipient isn’t
        registered on Majikah—as long as it’s encrypted using Majik Message’s built-in mechanism.
        Use it to safely prepare messages for sending, or to open encrypted messages from any
        source, giving you full control over your secure communication anytime, anywhere.
      </Subtext>

      {!myAccount ? (
        <EmptyContainer>
          <DynamicPlaceholder>
            Please create an account first to start encrypting and/or decrypting messages.
          </DynamicPlaceholder>
          <ChoiceButton variant="primary" onClick={handleGoToAccounts}>
            Create or Import Account
          </ChoiceButton>
        </EmptyContainer>
      ) : (
        <BodyContainer>
          <SectionSubTitle>Recipients</SectionSubTitle>
          <MajikContactListSelector
            id="message-recipients"
            contacts={contacts}
            value={recipients}
            onUpdate={handleRecipientsUpdate}
            onClearAll={handleRecipientsClear}
            allowEmpty={false}
          />

          <TextEditPreviewInput
            onEncrypt={handleEncryptMessage}
            onDecrypt={handleDecryptMessage}
            downloadName={`Message from ${myAccount?.meta?.label || myAccount?.id}`}
          />
        </BodyContainer>
      )}
    </Container>
  )
}

export default MessagePanel
