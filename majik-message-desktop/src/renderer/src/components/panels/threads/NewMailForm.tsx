import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import { toast } from 'sonner'

import { ButtonPrimaryConfirm } from '@renderer/globals/buttons'
import { downloadBlob, isDevEnvironment } from '@renderer/utils/utils'

import type {
  MajikContact,
  MajikMessagePublicKey,
  MajikMessageThread
} from '@majikah/majik-message'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'
import MajikContactListSelector from '@renderer/components/MajikContactListSelector'
import { ChatInputBox } from '@renderer/components/functional/ChatInputBox'
import CustomInputField from '@renderer/components/foundations/CustomInputField'

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
`

interface NewMailFormProps {
  majik: MajikMessageDatabase
  thread: MajikMessageThread
  onUpdate?: (message: string, subject?: string) => void
  onSend?: (message: string, subject?: string) => void
  reply?: boolean
}

/* ---------------------------------------------
 * Component
 * ------------------------------------------- */
const NewMailForm: React.FC<NewMailFormProps> = ({ majik, thread, onUpdate, onSend }) => {
  const [input, setInput] = useState<string>('')
  const [output, setOutput] = useState<string>('')
  const [subject, setSubject] = useState<string | undefined>(undefined)

  const [myAccount] = useState<MajikContact | null>(() => {
    const userAccount = majik.getActiveAccount()
    if (!userAccount) return null
    return userAccount
  })

  const [recipients, setRecipients] = useState<MajikContact[]>([])

  const handleSetSubject = (inputSubject: string | undefined): void => {
    if (!inputSubject?.trim()) {
      setSubject(undefined)
    } else {
      setSubject(inputSubject)
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
      onUpdate?.('', subject)
      return
    }
    setInput(input)
    onUpdate?.(input, subject)

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

    const sendMessageResponse = await majik.createThreadMail(thread, text, subject)

    if (
      sendMessageResponse !== null &&
      sendMessageResponse.success &&
      sendMessageResponse.message
    ) {
      onSend?.(text, subject)
      return sendMessageResponse?.message || `Message sent successfully!`
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

  useEffect(() => {
    let cancelled = false

    const loadRecipients = async (): Promise<void> => {
      if (!thread?.participants?.length) return

      try {
        const resolved = await Promise.all(
          thread.participants.map((pKey) => majik.getContactByPublicKey(pKey))
        )

        // filter out null / undefined if getContact can fail
        const validRecipients = resolved.filter((c): c is MajikContact => Boolean(c))

        if (!cancelled) {
          setRecipients(validRecipients)
        }
      } catch (err) {
        console.error('Failed to load recipients', err)
        if (!cancelled) setRecipients(myAccount ? [myAccount] : [])
      }
    }

    loadRecipients()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik])

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
        disabled={true}
      />
      <CustomInputField
        label="Subject"
        sensitive={true}
        onChange={handleSetSubject}
        maxChar={80}
        capitalize="sentence"
        currentValue={subject}
      />

      <Body>
        <Section>
          <ChatInputBox
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

export default NewMailForm
