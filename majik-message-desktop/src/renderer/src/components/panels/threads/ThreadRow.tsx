'use client'
import React, { useEffect, useState } from 'react'
import styled, { css } from 'styled-components'
import { StarIcon, WarningCircleIcon, CheckCircleIcon } from '@phosphor-icons/react'
import moment from 'moment'

import {
  MessageEnvelope,
  ThreadStatus,
  type MajikMessagePublicKey,
  type MajikMessageThreadID,
  type MajikMessageThreadSummary
} from '@majikah/majik-message'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'

// ─── Design tokens (local, not in theme) ────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── Root row ────────────────────────────────────────────────────────────────
/**
 * Key changes vs original:
 * - Left accent strip (::before) replaces full-row background for unread state
 * - Hover shows a surface fill + primary border instead of just border color
 * - Removed hardcoded border-bottom in favor of transparent + hover border
 */
const RootContainer = styled.li<{ $isUnread: boolean }>`
  position: relative;
  list-style: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px 11px 18px;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease;

  /* ── Unread left-strip indicator ── */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: ${({ $isUnread, theme }) => ($isUnread ? theme.colors.primary : 'transparent')};
    transition: background 150ms ease;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-color: ${({ theme }) => theme.colors.secondaryBackground};

    .tr-actions {
      opacity: 1;
      pointer-events: auto;
    }
  }
`

// ─── Avatar ──────────────────────────────────────────────────────────────────
/**
 * Generates a deterministic hue from the participant's display string.
 * Uses theme.colors.secondaryBackground as the base so it always blends.
 */
const Avatar = styled.div<{ $hue: number }>`
  width: 30px;
  height: 30px;
  min-width: 30px;
  border-radius: 50%;
  background: hsl(${({ $hue }) => $hue}, 38%, 26%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.72);
  user-select: none;
  flex-shrink: 0;
`

// ─── Star button ─────────────────────────────────────────────────────────────
const StarBtn = styled.button<{ $isStarred: boolean }>`
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ $isStarred }) => ($isStarred ? '#f59e0b' : 'rgba(255, 255, 255, 0.18)')};
  transition: color 150ms ease;

  &:hover {
    color: ${({ $isStarred }) => ($isStarred ? '#f59e0b' : 'rgba(255,255,255,0.5)')};
  }
`

// ─── Body (middle flex column) ───────────────────────────────────────────────
const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`

const TopRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
`

const Participants = styled.span<{ $bold: boolean }>`
  font-size: 13px;
  font-weight: ${({ $bold }) => ($bold ? 700 : 500)};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  flex-shrink: 0;
`

const Subject = styled.span<{ $bold: boolean }>`
  font-size: 12px;
  font-weight: ${({ $bold }) => ($bold ? 600 : 400)};
  color: ${({ theme, $bold }) => ($bold ? theme.colors.textPrimary : theme.colors.textSecondary)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
`

const Preview = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.6;
  transition: opacity 150ms ease;

  ${RootContainer}:hover & {
    opacity: 1;
  }
`

// ─── Right meta column ────────────────────────────────────────────────────────
const Meta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  flex-shrink: 0;
  min-width: 56px;
`

const Timestamp = styled.span<{ $bold: boolean }>`
  font-family: ${FONT_MONO};
  font-size: 10px;
  letter-spacing: 0.04em;
  color: ${({ theme, $bold }) => ($bold ? theme.colors.textPrimary : theme.colors.textSecondary)};
  font-weight: ${({ $bold }) => ($bold ? 600 : 400)};
`

// ─── Status pills ─────────────────────────────────────────────────────────────
/**
 * Replaces the raw icon-only status indicators.
 * Icon is still used inside the pill for recognisability.
 */
const pillBase = css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px 2px 5px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  line-height: 1.6;
`

const UnreadPill = styled.span`
  ${pillBase}
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
`

const WarningPill = styled.span`
  ${pillBase}
  background: rgba(245, 158, 11, 0.13);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
`

const ClosedPill = styled.span`
  ${pillBase}
  background: rgba(16, 185, 129, 0.12);
  color: ${({ theme }) => theme.colors.brand?.green ?? '#10b981'};
  border: 1px solid rgba(16, 185, 129, 0.2);
`

// ─── Hover action buttons ─────────────────────────────────────────────────────
const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0;
  pointer-events: none;
  flex-shrink: 0;
  transition: opacity 150ms ease;
`

// ─── Props ────────────────────────────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────────────────
const ThreadRow: React.FC<ThreadRowProps> = ({
  majik,
  thread,
  currentUserPublicKey,
  onToggleStar,
  onClick
}) => {
  const [isStarred, setIsStarred] = useState(thread.starred)
  const [participantLabels, setParticipantLabels] = useState<string[]>([])
  const [isHovered, setIsHovered] = useState(false)
  const [text, setText] = useState<string>('')

  // ── Resolve participant display names ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const resolveParticipants = async (): Promise<void> => {
      try {
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
        if (!cancelled) setParticipantLabels(labels)
      } catch (err) {
        console.error('Failed to resolve participant labels', err)
      }
    }

    resolveParticipants()
    return () => {
      cancelled = true
    }
  }, [majik, thread.participants, currentUserPublicKey])

  // ── Decrypt latest message preview ────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    if (!thread.latest_message?.message) return

    let envelope: MessageEnvelope
    try {
      envelope = MessageEnvelope.fromMatchedString(thread.latest_message.message)
    } catch {
      return
    }
    if (!envelope) return

    majik
      .decryptEnvelope(envelope)
      .then((msg) => {
        if (mounted) setText(msg)
      })
      .catch(() => {
        if (mounted) setText('[Unable to decrypt]')
      })

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.latest_message?.message])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStarClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setIsStarred(!isStarred)
    onToggleStar?.(thread.id)
  }

  const handleRowClick = (): void => onClick?.(thread.id)

  // ── Derived display values ─────────────────────────────────────────────────
  const participantsDisplay =
    participantLabels.length > 0 ? participantLabels.join(', ') : 'No participants'

  const subject = thread.subject || thread?.latest_message?.metadata?.subject || '(No Subject)'

  const relativeTime = moment(thread.latest_message_timestamp).fromNow()

  const previewText = thread.latest_message?.id?.trim()
    ? isHovered
      ? text
      : thread.latest_message.message
    : 'No messages yet'

  const avatarHue = getHue(participantsDisplay)
  const initials = getInitials(participantLabels[0] ?? participantsDisplay)

  const isPendingDeletion = thread.status === ThreadStatus.PENDING_DELETION
  const isClosed = thread.status === ThreadStatus.CLOSED

  return (
    <RootContainer
      $isUnread={thread.has_unread}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Star */}
      <StarBtn
        $isStarred={isStarred}
        onClick={handleStarClick}
        aria-label={isStarred ? 'Unstar thread' : 'Star thread'}
      >
        <StarIcon size={14} weight={isStarred ? 'fill' : 'regular'} />
      </StarBtn>

      {/* Avatar */}
      <Avatar $hue={avatarHue}>{initials}</Avatar>

      {/* Main content */}
      <Body>
        <TopRow>
          <Participants $bold={thread.has_unread} data-private>
            {participantsDisplay}
          </Participants>

          <Subject $bold={thread.has_unread} data-private>
            {subject}
            {isPendingDeletion && (
              <WarningPill>
                <WarningCircleIcon size={10} />
                Deleting
              </WarningPill>
            )}
            {isClosed && (
              <ClosedPill>
                <CheckCircleIcon size={10} />
                Closed
              </ClosedPill>
            )}
          </Subject>
        </TopRow>

        <Preview data-private>{previewText}</Preview>
      </Body>

      {/* Right meta */}
      <Meta>
        {thread.total_messages > 0 && (
          <Timestamp $bold={thread.has_unread}>{relativeTime}</Timestamp>
        )}
        {thread.has_unread && thread.unread_count > 0 && (
          <UnreadPill>{thread.unread_count}</UnreadPill>
        )}
      </Meta>

      {/* Hover actions — re-enable commented handlers as needed */}
      <Actions className="tr-actions">{/* Slots ready for delete / mark-read buttons */}</Actions>
    </RootContainer>
  )
}

export default ThreadRow

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenPublicKey(pk: MajikMessagePublicKey, chars = 6): string {
  const str = String(pk)
  return `${str.slice(0, chars)}…${str.slice(-chars)}`
}

/** Deterministic hue 0–359 from any string */
function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

/** First two initials from a display name, or first 2 chars of a key */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
