import React, { useMemo, useState } from 'react'
import styled from 'styled-components'

import type { MajikMessageDatabase } from '../../majik-context-wrapper/majik-message-database'
import type { MajikContact } from '@majikah/majik-message'
import { MajikContactListSelector } from '../../MajikContactListSelector'
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

interface NewThreadFormProps {
  majik: MajikMessageDatabase
  onUpdate?: (participants: MajikContact[], subject?: string) => void
}

/* ---------------------------------------------
 * Component
 * ------------------------------------------- */
const NewThreadForm: React.FC<NewThreadFormProps> = ({ majik, onUpdate }) => {
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

  const [threadLabel, setThreadLabel] = useState<string | undefined>(undefined)

  const handleRecipientsUpdate = (updated: MajikContact[]): void => {
    if (updated.length === 0) {
      if (!myAccount) {
        setRecipients([])
        onUpdate?.([])
        return
      } else {
        setRecipients([myAccount])
        onUpdate?.([myAccount])
        return
      }
    }
    setRecipients(updated)
    onUpdate?.(updated, threadLabel)
  }

  const handleRecipientsClear = (): void => {
    if (!myAccount) {
      setRecipients([])
      onUpdate?.([], threadLabel)
    } else {
      setRecipients([myAccount])
      onUpdate?.([myAccount], threadLabel)
    }
  }

  const handleChangeThreadLabel = (input: string | undefined): void => {
    if (!input?.trim()) {
      setThreadLabel(undefined)
      return
    }
    setThreadLabel(input)
    onUpdate?.(recipients, input)
  }

  const contacts = useMemo(() => {
    if (!majik) return []

    return majik.listContacts(false, true)
  }, [majik])

  return (
    <Root>
      <MajikContactListSelector
        id="thread-participants"
        contacts={contacts}
        value={recipients}
        onUpdate={handleRecipientsUpdate}
        onClearAll={handleRecipientsClear}
        allowEmpty={false}
      />
      <CustomInputField
        label="Topic or Label"
        regex="letters"
        maxChar={150}
        capitalize="first"
        sensitive
        currentValue={threadLabel || ''}
        onChange={handleChangeThreadLabel}
      />
    </Root>
  )
}

export default NewThreadForm
