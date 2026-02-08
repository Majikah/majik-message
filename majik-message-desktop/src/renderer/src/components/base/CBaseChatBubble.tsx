import React, { useEffect, useMemo, useState } from 'react'
import styled, { css } from 'styled-components'
import { MajikMessageChat, MessageEnvelope } from '@majikah/majik-message'

import DeleteButton from '../foundations/DeleteButton'
import StyledIconButton from '../foundations/StyledIconButton'
import { DownloadIcon, LinkIcon } from '@phosphor-icons/react'

import moment from 'moment'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import { toast } from 'sonner'
import { downloadBlob } from '@renderer/utils/utils'

// Styled components

const RootContainer = styled.div<{ $isOwn: boolean }>`
  display: flex;
  width: 100%;
  justify-content: ${({ $isOwn }) => ($isOwn ? 'flex-end' : 'flex-start')};
`
const MessageColumn = styled.div<{ $isOwn: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 5px;

  width: fit-content;
  max-width: 100%;
  align-items: ${({ $isOwn }) => ($isOwn ? 'flex-end' : 'flex-start')};
`

const MessageRow = styled.div<{ $isOwn: boolean }>`
  display: flex;
  flex-direction: ${({ $isOwn }) => ($isOwn ? 'row' : 'row-reverse')};
  gap: 5px;

  width: fit-content;
  max-width: 100%;
  align-items: ${({ $isOwn }) => ($isOwn ? 'flex-end' : 'flex-start')};
`

const ActionButtonRow = styled.div<{ $enableHover?: boolean }>`
  display: flex;
  flex-direction: row;
  gap: 3px;
  align-items: center;
  justify-content: flex-end;

  width: 0px;
  opacity: 0;

  ${({ $enableHover }) =>
    $enableHover &&
    css`
      @media (hover: hover) and (pointer: fine) {
        ${MessageColumn}:hover & {
          width: fit-content;
          opacity: 1;
          padding: 5px;
          margin: 3px;
        }
      }
    `}
`

const Bubble = styled.div<{ $isOwn: boolean }>`
  padding: 15px 18px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.4;

  white-space: pre-wrap;
  word-break: break-word;

  /* ✅ same behavior as reference */
  max-width: min(680px, 72vw);
  width: fit-content;

  background: ${({ $isOwn, theme }) =>
    $isOwn ? theme.gradients.strong : theme.gradients.secondary};

  color: #272525;

  border-bottom-right-radius: ${({ $isOwn }) => ($isOwn ? '4px' : '18px')};
  border-bottom-left-radius: ${({ $isOwn }) => ($isOwn ? '18px' : '4px')};

  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`

const Meta = styled.div<{ $isOwn: boolean }>`
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.6;
  text-align: ${({ $isOwn }) => ($isOwn ? 'right' : 'left')};
  color: ${({ theme }) => theme.colors.textSecondary};
`

interface CBaseChatBubbleProps {
  majik: MajikMessageDatabase
  message: MajikMessageChat
  isOwn: boolean
  now: number
  onEdit?: (data: MajikMessageChat) => void
  onDelete?: (data: MajikMessageChat) => void
  canEdit?: boolean
  canDelete?: boolean
  canShare?: boolean
  canDownload?: boolean
}

const CBaseChatBubble: React.FC<CBaseChatBubbleProps> = ({
  majik,
  message,
  isOwn,
  now,
  onDelete,
  onEdit,
  canShare = true,
  canDownload = true,
  canEdit = true,
  canDelete = false
}) => {
  const [text, setText] = useState<string>('')

  useEffect(() => {
    let mounted = true

    let envelope: MessageEnvelope

    try {
      envelope = MessageEnvelope.fromMatchedString(message.getCompressedMessage())
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
  }, [message])

  const time = useMemo(() => {
    const date = new Date(message.getTimestamp())
    return moment(date).fromNow()
  }, [message])

  const expiresAt = message.getExpiresAt()

  const remaining = useMemo(() => {
    if (!expiresAt) return null
    return Math.max(0, new Date(expiresAt).getTime() - now)
  }, [expiresAt, now])

  const expiryLabel = useMemo(() => {
    if (remaining === null) return null
    if (remaining <= 0) return 'Expired'

    const dur = moment.duration(remaining)

    if (dur.asHours() >= 1) return `Expires in ${Math.ceil(dur.asHours())}h`
    if (dur.asMinutes() >= 1) return `Expires in ${Math.ceil(dur.asMinutes())}m`
    return `Expires in ${Math.ceil(dur.asSeconds())}s`
  }, [remaining])

  const handleShare = async (): Promise<void> => {
    if (!canShare) return
    const rawMessage = message.getCompressedMessage()
    if (!rawMessage) {
      toast.error('Failed to copy to clipboard', {
        description: 'There seems to be a problem with this message.',
        id: `toast-error-share-${message.getID()}`
      })
      return
    }
    try {
      await navigator.clipboard.writeText(rawMessage)
      toast.success('Encrypted message copied to clipboard', {
        description: rawMessage,
        id: `toast-success-share-${message.getID()}`
      })

      // Native Notification
      window.electron.notify('Copied to clipboard', rawMessage)
    } catch (err) {
      // fallback: show in prompt
      toast.error('Failed to copy to clipboard', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: `toast-error-share-${message.getID()}`
      })
    }
  }

  const handleDownloadTxt = (): void => {
    if (!canDownload) return
    const rawMessage = message.getCompressedMessage()
    const blob = new Blob([rawMessage], {
      type: 'application/octet-stream'
    })
    downloadBlob(blob, 'txt', message.getRedisKey() || 'Majik Message')
    // Native Notification
    window.electron.notify(
      'Message Downloaded',
      message.getRedisKey() || 'This message has been saved as a TXT file.'
    )
  }

  return (
    <RootContainer $isOwn={isOwn}>
      <MessageColumn $isOwn={isOwn}>
        <MessageRow $isOwn={isOwn}>
          <ActionButtonRow
            $enableHover={(!!onDelete && canDelete) || (!!onEdit && canEdit) || canShare}
          >
            {canShare ? (
              <StyledIconButton icon={LinkIcon} title="Share" onClick={handleShare} size={24} />
            ) : null}

            {canDownload ? (
              <StyledIconButton
                icon={DownloadIcon}
                title="Download"
                onClick={handleDownloadTxt}
                size={24}
              />
            ) : null}

            {!!onDelete && onDelete !== undefined && !!canDelete && isOwn ? (
              <DeleteButton title="contact" onClick={() => onDelete?.(message)} />
            ) : null}
          </ActionButtonRow>
          <Bubble $isOwn={isOwn} data-private>
            {text}
          </Bubble>
        </MessageRow>

        <Meta $isOwn={isOwn}>
          {time} {expiryLabel && ` • ${expiryLabel}`}
        </Meta>
      </MessageColumn>
    </RootContainer>
  )
}

export default CBaseChatBubble
