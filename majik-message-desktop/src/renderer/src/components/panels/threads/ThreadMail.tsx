import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import {
  BracketsCurlyIcon,
  CaretDownIcon,
  CaretUpIcon,
  CopyIcon,
  TextAaIcon
} from '@phosphor-icons/react'
import moment from 'moment'
import { MessageEnvelope, type MajikMessageMail } from '@majikah/majik-message'
import type { MajikMessagePublicKey } from '@majikah/majik-message'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'
import { downloadBlob } from '@renderer/utils/utils'
import { toast } from 'sonner'
import StyledIconButton from '@renderer/components/foundations/StyledIconButton'

const RootContainer = styled.div<{ $isExpanded: boolean }>`
  width: 100%;
  background-color: ${({ theme }) => theme.colors.primaryBackground || '#ffffff'};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground || '#e5e7eb'};
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`

const CollapsedHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  gap: 12px;

  &:hover {
    background-color: ${({ theme }) => theme.colors.secondaryBackground || '#f9fafb'};
  }
`

const ExpandedHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground || '#e5e7eb'};
`

const CollapseButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.secondaryBackground || '#e5e7eb'};
    color: ${({ theme }) => theme.colors.textPrimary || '#111827'};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const SenderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
`

const SenderName = styled.div<{ $isUnread?: boolean }>`
  font-size: 14px;
  font-weight: ${(props) => (props.$isUnread ? '600' : '500')};
  color: ${({ theme }) => theme.colors.textPrimary || '#111827'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const MessagePreview = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Timestamp = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
  white-space: nowrap;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const SenderDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`

const SenderNameExpanded = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary || '#111827'};
`

const SenderEmail = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
`

const Recipients = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
  margin-top: 4px;
`

const MessageBody = styled.div`
  padding: 20px;
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textPrimary || '#111827'};
  white-space: pre-wrap;
  word-wrap: break-word;
`

const ActionBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground || '#e5e7eb'};
`

const MetadataSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
  background-color: ${({ theme }) => theme.colors.secondaryBackground || '#f9fafb'};
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground || '#e5e7eb'};
`

const MetadataRow = styled.div`
  display: flex;
  gap: 8px;
  font-size: 13px;
`

const MetadataLabel = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary || '#111827'};
  min-width: 80px;
`

const MetadataValue = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
`

const ReadStatus = styled.div<{ $isRead: boolean }>`
  font-size: 11px;
  color: ${({ theme, $isRead }) =>
    $isRead ? theme.colors.textSecondary : theme.colors.primaryBackground};
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 12px;
  background-color: ${({ theme, $isRead }) =>
    $isRead ? theme.colors.secondaryBackground : theme.colors.primary};
`

const UnreadBadge = styled.span`
  background-color: #3b82f6;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 8px;
`
interface ThreadMailProps {
  majik: MajikMessageDatabase
  mail: MajikMessageMail
  currentUserPublicKey: MajikMessagePublicKey
  isLatest: boolean
  isSingle: boolean
  displayNames?: Record<string, string>
  onToggleStar?: (mailId: string) => void
}

export const ThreadMail: React.FC<ThreadMailProps> = ({
  majik,
  mail,
  currentUserPublicKey,
  isLatest,
  isSingle,
  displayNames = {}
}) => {
  const [isExpanded, setIsExpanded] = useState(isLatest)
  //   const [isStarred, setIsStarred] = useState(false)

  const canCollapse = !isLatest && !isSingle

  const [text, setText] = useState<string>('')

  useEffect(() => {
    let mounted = true

    let envelope: MessageEnvelope

    try {
      envelope = MessageEnvelope.fromMatchedString(mail.message)
    } catch {
      return
    }

    if (!envelope) {
      return
    }

    majik
      .decryptEnvelope(envelope, true)
      .then((msg) => {
        if (mounted) setText(msg)
      })
      .catch(() => {
        if (mounted) setText('[Unable to decrypt message]')
      })

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mail.message])

  const handleToggleExpand = (): void => {
    if (canCollapse) {
      setIsExpanded(!isExpanded)
    }
  }

  //   const handleStarClick = (e: React.MouseEvent): void => {
  //     e.stopPropagation()
  //     setIsStarred(!isStarred)
  //     onToggleStar?.(mail.id)
  //   }

  const handleCopy = useCallback(() => {
    if (!mail.message?.trim()) {
      toast.error('Failed to copy to clipboard', {
        description: 'No text to copy.',
        id: `toast-error-copy`
      })
      return
    }
    try {
      navigator.clipboard.writeText(mail.message)
      toast.success('Copied to clipboard', {
        description: mail.message.length > 200 ? mail.message.slice(0, 200) + '…' : mail.message,
        id: `toast-success-copy-${mail.message}`
      })
    } catch (e) {
      // fallback: show in prompt
      toast.error('Failed to copy to clipboard', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-copy-${mail?.message}`
      })
    }
  }, [mail.message])

  const handleDownloadTxt = async (): Promise<void> => {
    const blob = new Blob([mail.message], {
      type: 'application/octet-stream'
    })

    const sender = await majik.getContactByPublicKey(mail.sender)

    downloadBlob(
      blob,
      'txt',
      `Mail Message from ${sender?.meta?.label ?? mail.sender}_${mail.id}_${mail.timestamp.toLocaleDateString()}`
    )
  }

  const handleDownloadJson = async (): Promise<void> => {
    const messageJSON = {
      original: text,
      encrypted: mail.message
    }

    const jsonString = JSON.stringify(messageJSON)

    const blob = new Blob([jsonString], {
      type: 'application/json;charset=utf-8'
    })
    const sender = await majik.getContactByPublicKey(mail.sender)

    downloadBlob(
      blob,
      'json',
      `Mail Message from ${sender?.meta?.label ?? mail.sender}_${mail.id}_${mail.timestamp.toLocaleDateString()}`
    )
  }

  const senderKey = mail.sender
  const senderName = displayNames[senderKey] || senderKey
  const isOwn = mail.isSender(currentUserPublicKey)
  const hasUserRead = mail.hasUserRead(currentUserPublicKey)

  const recipientNames = mail.recipients.map((key) => displayNames[key] || key).join(', ')

  const timestamp = moment(mail.timestamp)
  const relativeTime = timestamp.fromNow()
  const fullTime = timestamp.format('MMM D, YYYY [at] h:mm A')

  const subject = mail.metadata?.subject || '(No Subject)'
  const priority = mail.metadata?.priority
  const attachments = mail.metadata?.attachments || []

  if (!isExpanded) {
    return (
      <RootContainer $isExpanded={false}>
        <CollapsedHeader onClick={handleToggleExpand}>
          <CollapseButton as="div" style={{ cursor: canCollapse ? 'pointer' : 'default' }}>
            <CaretDownIcon size={16} />
          </CollapseButton>

          {/* <StarButton
            $isStarred={isStarred}
            onClick={handleStarClick}
            aria-label={isStarred ? 'Unstar' : 'Star'}
          >
            <StarIcon size={16} weight={isStarred ? 'fill' : 'regular'} />
          </StarButton> */}

          <SenderInfo>
            <SenderName $isUnread={!hasUserRead && !isOwn} data-private>
              {senderName}
              {!hasUserRead && !isOwn && <UnreadBadge>New</UnreadBadge>}
            </SenderName>
            <MessagePreview data-private>{text}</MessagePreview>
          </SenderInfo>

          <Timestamp>{relativeTime}</Timestamp>
        </CollapsedHeader>
      </RootContainer>
    )
  }

  return (
    <RootContainer $isExpanded={true}>
      <ExpandedHeader>
        <HeaderLeft>
          <CollapseButton
            onClick={handleToggleExpand}
            disabled={!canCollapse}
            aria-label="Collapse message"
          >
            <CaretUpIcon size={16} />
          </CollapseButton>

          {/* <StarButton
            $isStarred={isStarred}
            onClick={handleStarClick}
            aria-label={isStarred ? 'Unstar' : 'Star'}
          >
            <StarIcon size={18} weight={isStarred ? 'fill' : 'regular'} />
          </StarButton> */}

          <SenderDetails>
            <SenderNameExpanded data-private>{senderName}</SenderNameExpanded>
            <SenderEmail data-private>{senderKey}</SenderEmail>
            {recipientNames && <Recipients data-private>to {recipientNames}</Recipients>}
          </SenderDetails>
        </HeaderLeft>

        <HeaderRight>
          <Timestamp title={fullTime} data-private>
            {relativeTime}
          </Timestamp>
          {!isOwn && (
            <ReadStatus $isRead={hasUserRead}>{hasUserRead ? 'Read' : 'Unread'}</ReadStatus>
          )}
        </HeaderRight>
      </ExpandedHeader>

      {(subject || priority || attachments.length > 0) && (
        <MetadataSection>
          {subject && (
            <MetadataRow>
              <MetadataLabel>Subject:</MetadataLabel>
              <MetadataValue data-private>{subject}</MetadataValue>
            </MetadataRow>
          )}
          {priority && (
            <MetadataRow>
              <MetadataLabel>Priority:</MetadataLabel>
              <MetadataValue style={{ textTransform: 'capitalize' }}>{priority}</MetadataValue>
            </MetadataRow>
          )}
          {attachments.length > 0 && (
            <MetadataRow>
              <MetadataLabel>Attachments:</MetadataLabel>
              <MetadataValue data-private>{attachments.join(', ')}</MetadataValue>
            </MetadataRow>
          )}
        </MetadataSection>
      )}

      <MessageBody>{text}</MessageBody>

      <ActionBar>
        <StyledIconButton
          onClick={handleCopy}
          aria-label="Copy"
          icon={CopyIcon}
          title="Copy encrypted message to Clipboard"
          size={25}
        />

        <StyledIconButton
          onClick={handleDownloadTxt}
          aria-label="Copy"
          icon={TextAaIcon}
          title="Download encrypted message as .txt"
          size={25}
        />

        <StyledIconButton
          onClick={handleDownloadJson}
          aria-label="Copy"
          icon={BracketsCurlyIcon}
          title="Download encrypted message as .json"
          size={25}
        />
      </ActionBar>
    </RootContainer>
  )
}

export default ThreadMail
