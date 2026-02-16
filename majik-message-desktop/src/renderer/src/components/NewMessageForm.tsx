import React, { useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

import { toast } from 'sonner'

import { ButtonPrimaryConfirm } from '@renderer/globals/buttons'
import { downloadBlob, isDevEnvironment } from '@renderer/utils/utils'
import type { MajikMessageDatabase } from './majik-context-wrapper/majik-message-database'
import type { MajikContact, MajikMessagePublicKey } from '@majikah/majik-message'
import { MajikContactListSelector } from './MajikContactListSelector'
import { ChatInputBox } from './functional/ChatInputBox'
import type { MajikahSession } from './majikah-session-wrapper/majikah-session'

/* ---------------------------------------------
 * Styled Components
 * ------------------------------------------- */
const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  color: ${({ theme }) => theme.colors.textPrimary};
  gap: 25px;
`

const Body = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`

const Section = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`

const PreviewActions = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`

const ExportButton = styled(ButtonPrimaryConfirm)`
  padding: 6px 20px;
  width: 100%;
`

interface NewMessageFormProps {
  majikah: MajikahSession
  majik: MajikMessageDatabase
  onUpdate?: (message: string) => void
  onSend?: (message: string) => void
}

/* ---------------------------------------------
 * Component
 * ------------------------------------------- */
const NewMessageForm: React.FC<NewMessageFormProps> = ({ majikah, majik, onUpdate, onSend }) => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')

  const [myAccount] = useState<MajikContact | null>(() => {
    const userAccount = majik.getActiveAccount()
    if (!userAccount) return null
    return userAccount
  })

  const [recipients, setRecipients] = useState<MajikContact[]>(() => {
    const myAccount = majik.getActiveAccount()
    if (!myAccount) return []
    return [myAccount]
  })

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

  const handleCopy = useCallback(() => {
    if (!output?.trim()) {
      toast.error('Failed to copy to clipboard', {
        description: 'No text to copy.',
        id: `toast-error-copy-${output}`
      })
      return
    }
    try {
      navigator.clipboard.writeText(output)
      toast.success('Copied to clipboard', {
        description: output.length > 200 ? output.slice(0, 200) + '…' : output,
        id: `toast-success-copy-${output}`
      })
    } catch (e) {
      // fallback: show in prompt
      toast.error('Failed to copy to clipboard', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-copy-${output}`
      })
    }
  }, [output])

  const handleDownloadTxt = (): void => {
    const blob = new Blob([output], {
      type: 'application/octet-stream'
    })
    downloadBlob(blob, 'txt', `Message from ${myAccount?.meta?.label || myAccount?.id}`)
  }

  const handleDownloadJson = (): void => {
    const messageJSON = {
      original: input,
      encrypted: output
    }

    const jsonString = JSON.stringify(messageJSON)

    const blob = new Blob([jsonString], {
      type: 'application/json;charset=utf-8'
    })
    downloadBlob(blob, 'json', `Message from ${myAccount?.meta?.label || myAccount?.id}`)
  }

  const handleEncryptMessage = async (input: string): Promise<void> => {
    if (!input?.trim()) {
      setInput('')
      onUpdate?.('')
      return
    }
    setInput(input)
    onUpdate?.(input)

    if (!myAccount) {
      toast.error('No active account found.', { id: 'toast-error-no-account' })
      return
    }

    if (!recipients || recipients.length === 0) {
      toast.error('No recipients selected.', { id: 'toast-error-no-recipients' })
      return
    }

    const recipientIds = recipients.map((contact) => contact.id)

    const encryptedMessage = await majik.encryptTextForScanner(input, recipientIds, false)
    setOutput(encryptedMessage ?? '')
  }

  const processSend = async (
    senderPublicKey: MajikMessagePublicKey,
    text: string
  ): Promise<string> => {
    if (isDevEnvironment()) console.log('Sending message from: ', senderPublicKey)

    if (!text?.trim()) {
      throw new Error('A valid message is required.')
    }

    if (!senderPublicKey?.trim()) {
      throw new Error('A valid sender public key is required.')
    }

    if (!recipients || recipients.length <= 1) {
      throw new Error('Assign recipients first.')
    }

    const messageRecipients = (
      await Promise.all(
        recipients.filter((r) => r.isMajikahRegistered()).map(async (r) => r.getPublicKeyBase64())
      )
    ).filter((pk) => pk !== senderPublicKey)

    const sendMessageResponse = await majik.createMessage(messageRecipients, text)

    if (
      sendMessageResponse !== null &&
      sendMessageResponse.success &&
      sendMessageResponse.message
    ) {
      onSend?.(text)
      return `Message sent successfully! ${sendMessageResponse.message}`
    } else {
      return `Oh no... There's a problem while sending the message.`
    }
  }

  const handleSend = async (): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    const currentUserPublicKey = activeAccount.publicKey

    if (!recipients || recipients.length <= 1) {
      toast.error('Assign recipients first.')
      return
    }

    toast.promise(processSend(currentUserPublicKey, input), {
      loading: `Sending message...`,
      success: (outputMessage) => {
        setTimeout(() => {}, 1000)

        return outputMessage
      },
      error: (error) => {
        return `${error.message}`
      }
    })
  }

  const contacts = useMemo(() => {
    if (!majik) return []

    return majik.listContacts(false, true)
  }, [majik])

  return (
    <Root>
      <MajikContactListSelector
        id="message-recipients"
        contacts={contacts}
        value={recipients}
        onUpdate={handleRecipientsUpdate}
        onClearAll={handleRecipientsClear}
        allowEmpty={false}
      />

      <Body>
        <Section>
          <ChatInputBox
            majikah={majikah}
            onSend={handleSend}
            onUpdate={handleEncryptMessage}
            disabled={!recipients || recipients.length <= 1}
          />
          <PreviewActions>
            <ExportButton onClick={handleCopy}>Copy</ExportButton>
            <ExportButton onClick={handleDownloadTxt}>Download .txt</ExportButton>
            <ExportButton onClick={handleDownloadJson}>Download .json</ExportButton>
          </PreviewActions>
        </Section>
      </Body>
    </Root>
  )
}

export default NewMessageForm
