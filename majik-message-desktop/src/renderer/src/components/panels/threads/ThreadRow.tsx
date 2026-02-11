import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import {
  CheckCircleIcon,
  // EnvelopeIcon,
  // EnvelopeOpenIcon,
  HandPalmIcon,
  StarIcon,
  TrashIcon,
  WarningCircleIcon
} from '@phosphor-icons/react'
import moment from 'moment'

import {
  MessageEnvelope,
  ThreadStatus,
  type MajikMessagePublicKey,
  type MajikMessageThreadID,
  type MajikMessageThreadSummary
} from '@majikah/majik-message'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'
import StyledIconButton from '@renderer/components/foundations/StyledIconButton'
import theme from '@renderer/globals/theme'

const RootContainer = styled.div<{ $isUnread: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid transparent;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme, $isUnread }) =>
    $isUnread ? theme.colors.secondaryBackground : 'transparent'};
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
  border-radius: 8px;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};

    .action-buttons {
      opacity: 1;
      visibility: visible;
    }
  }
`

const StarButton = styled.button<{ $isStarred: boolean }>`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: ${(props) => (props.$isStarred ? '#fbbf24' : '#9ca3af')};
  transition: color 0.2s ease;

  &:hover {
    color: ${(props) => (props.$isStarred ? '#f59e0b' : '#6b7280')};
  }
`

const ParticipantsSection = styled.div<{ $hasUnread: boolean }>`
  min-width: 200px;
  max-width: 200px;
  font-weight: ${(props) => (props.$hasUnread ? '600' : '400')};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 16px;
`

const ContentSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin-right: 16px;
`

const SubjectLine = styled.div<{ $isUnread: boolean }>`
  display: flex;
  flex-direction: row;
  gap: 15px;

  font-size: 14px;
  font-weight: ${(props) => (props.$isUnread ? '600' : '400')};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${RootContainer}:hover & {
    color: ${({ theme }) => theme.colors.primary};
  }
`

const MessagePreview = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${RootContainer}:hover & {
    color: ${({ theme }) => theme.colors.textPrimary};
    opacity: 1;
  }
`

const MetaSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 16px;
`

const UnreadBadge = styled.span`
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  min-width: 20px;
  text-align: center;
`

const Timestamp = styled.div<{ $isUnread: boolean }>`
  font-size: 12px;
  color: ${({ theme, $isUnread }) =>
    $isUnread ? theme.colors.textPrimary : theme.colors.textSecondary};
  font-weight: ${(props) => (props.$isUnread ? '600' : '400')};
  min-width: 80px;
  text-align: right;
  margin-right: 15px;
`

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
`

interface ThreadRowProps {
  majik: MajikMessageDatabase
  thread: MajikMessageThreadSummary
  currentUserPublicKey: MajikMessagePublicKey
  onToggleStar?: (threadId: MajikMessageThreadID) => void
  onDelete?: (threadId: MajikMessageThreadID) => void
  onCancelDelete?: (threadId: MajikMessageThreadID) => void
  onToggleRead?: (threadId: MajikMessageThreadID) => void
  onClick?: (threadId: MajikMessageThreadID) => void
}

const ThreadRow: React.FC<ThreadRowProps> = ({
  majik,
  thread,
  currentUserPublicKey,
  onToggleStar,
  onDelete,
  onCancelDelete,
  onClick
}) => {
  const [isStarred, setIsStarred] = useState(thread.starred)
  const [participantLabels, setParticipantLabels] = React.useState<string[]>([])
  const [isHovered, setIsHovered] = useState(false)

  const [text, setText] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    const resolveParticipants = async (): Promise<void> => {
      try {
        // Filter out current user from participants
        const otherParticipants = thread.participants.filter((p) => p !== currentUserPublicKey)
        const labels = await Promise.all(
          otherParticipants.map(async (pk) => {
            try {
              const contact = await majik.getContactByPublicKey(pk)
              return contact?.meta.label?.trim() ? contact.meta.label : shortenPublicKey(pk)
            } catch {
              return shortenPublicKey(pk)
            }
          })
        )

        if (!cancelled) {
          setParticipantLabels(labels)
        }
      } catch (err) {
        console.error('Failed to resolve participant labels', err)
      }
    }

    resolveParticipants()

    return () => {
      cancelled = true
    }
  }, [majik, thread.participants, currentUserPublicKey])

  useEffect(() => {
    let mounted = true

    let envelope: MessageEnvelope

    if (!thread.latest_message?.message) return

    try {
      envelope = MessageEnvelope.fromMatchedString(thread.latest_message?.message)
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
  }, [thread.latest_message?.message])

  const handleStarClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setIsStarred(!isStarred)
    onToggleStar?.(thread.id)
  }

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onDelete?.(thread.id)
  }

  const handleCancelDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onCancelDelete?.(thread.id)
  }

  // const handleToggleReadClick = (e: React.MouseEvent): void => {
  //   e.stopPropagation()
  //   onToggleRead?.(thread.id)
  // }

  const handleRowClick = (): void => {
    onClick?.(thread.id)
  }

  // Format participants display
  const participantsDisplay =
    participantLabels.length > 0 ? participantLabels.join(', ') : 'No participants'

  // Get subject from metadata or use a default
  const subject = thread.latest_message?.id
    ? thread.subject || thread?.latest_message?.metadata?.subject || '(No Subject)'
    : 'No messages available yet'

  // Format timestamp
  const relativeTime = moment(thread.latest_message_timestamp).fromNow()

  return (
    <RootContainer
      $isUnread={thread.has_unread}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <StarButton
        $isStarred={isStarred}
        onClick={handleStarClick}
        aria-label={isStarred ? 'Unstar thread' : 'Star thread'}
      >
        <StarIcon size={20} weight={isStarred ? 'fill' : 'regular'} />
      </StarButton>

      <ParticipantsSection $hasUnread={thread.has_unread}>
        {participantsDisplay}
      </ParticipantsSection>

      <ContentSection>
        <SubjectLine $isUnread={thread.has_unread}>
          {subject}{' '}
          {thread.status === ThreadStatus.PENDING_DELETION && (
            <WarningCircleIcon size={18} color={theme.colors.error}>
              <title>Pending Deletion</title>
            </WarningCircleIcon>
          )}
          {thread.status === ThreadStatus.CLOSED && (
            <CheckCircleIcon size={18} color={theme.colors.brand.green}>
              <title>Closed</title>
            </CheckCircleIcon>
          )}
        </SubjectLine>
        <MessagePreview>{isHovered ? text : thread.latest_message?.message}</MessagePreview>
      </ContentSection>

      <MetaSection>
        {thread.has_unread && thread.unread_count > 0 && (
          <UnreadBadge>{thread.unread_count}</UnreadBadge>
        )}
      </MetaSection>

      <Timestamp $isUnread={thread.has_unread}>{relativeTime}</Timestamp>

      <ActionButtons className="action-buttons">
        {/* <StyledIconButton
          onClick={handleToggleReadClick}
          aria-label={thread.has_unread ? 'Mark as read' : 'Mark as unread'}
          icon={thread.has_unread ? EnvelopeOpenIcon : EnvelopeIcon}
          title={thread.has_unread ? 'Mark as read' : 'Mark as unread'}
          size={20}
        /> */}
        {thread.deletion_requested ? (
          <StyledIconButton
            onClick={handleCancelDeleteClick}
            aria-label="Revoke Deletion Request"
            icon={HandPalmIcon}
            title="Revoke Deletion Request"
            size={20}
          />
        ) : (
          <StyledIconButton
            onClick={handleDeleteClick}
            aria-label="Delete Thread"
            icon={TrashIcon}
            title="Delete Thread"
            size={20}
          />
        )}
      </ActionButtons>
    </RootContainer>
  )
}

export default ThreadRow

/* --------------------------------
 * Helpers
 * -------------------------------- */

function shortenPublicKey(pk: MajikMessagePublicKey, chars = 6): string {
  const str = String(pk)
  return `${str.slice(0, chars)}…${str.slice(-chars)}`
}
