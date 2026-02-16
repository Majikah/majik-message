import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

import { MessageEnvelope, type MajikMessagePublicKey } from '@majikah/majik-message'
import type { ConversationSummary } from '../majikah-session-wrapper/api-types'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import moment from 'moment'
// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card = styled.div<{ $active: boolean; $unread: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 120ms ease,
    border-color 120ms ease;

  background: ${({ $active, theme }) =>
    $active ? theme.colors.secondaryBackground : 'transparent'};

  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }

  /* Unread left accent strip — same system as ThreadRow */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 10px;
    bottom: 10px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: ${({ $unread, theme }) => ($unread ? theme.colors.primary : 'transparent')};
    transition: background 150ms ease;
  }
`

// ─── Avatar stack ─────────────────────────────────────────────────────────────
const AvatarStack = styled.div`
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
`

const Avatar = styled.div<{ $hue: number; $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: hsl(${({ $hue }) => $hue}, 38%, 26%);
  border: 1.5px solid ${({ theme }) => theme.colors.primaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: ${({ $size }) => Math.round($size * 0.34)}px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  user-select: none;
  flex-shrink: 0;
`

const AvatarSingle = styled(Avatar)`
  position: static;
`

const AvatarA1 = styled(Avatar)`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
`

const AvatarA2 = styled(Avatar)`
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 1;
`

// ─── Body ─────────────────────────────────────────────────────────────────────
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
`

const Name = styled.span<{ $bold: boolean }>`
  font-size: 13px;
  font-weight: ${({ $bold }) => ($bold ? 700 : 500)};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
`

const Time = styled.span<{ $bold: boolean }>`
  font-family: ${FONT_MONO};
  font-size: 10px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
  font-weight: ${({ $bold }) => ($bold ? 600 : 400)};
  color: ${({ $bold, theme }) => ($bold ? theme.colors.textPrimary : theme.colors.textSecondary)};
`

const Preview = styled.div<{ $unread: boolean }>`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: ${({ $unread }) => ($unread ? 600 : 400)};
  opacity: ${({ $unread }) => ($unread ? 0.9 : 0.55)};
`

const PreviewSkeleton = styled.div`
  height: 11px;
  width: 55%;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  opacity: 0.6;
`

// ─── Footer ───────────────────────────────────────────────────────────────────
const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`

const MsgCount = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.06em;
  opacity: 0.4;
`

const UnreadBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 100px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
`

// ─── Props ────────────────────────────────────────────────────────────────────
interface CBaseConversationProps {
  majik: MajikMessageDatabase
  conversation: ConversationSummary
  isActive?: boolean
  onClick?: (conversation: ConversationSummary) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export const CBaseConversation: React.FC<CBaseConversationProps> = ({
  majik,
  conversation,
  isActive = false,
  onClick
}) => {
  const {
    conversation_id,
    participants,
    latest_message,
    latest_message_timestamp,
    total_messages,
    unread_count,
    has_unread
  } = conversation

  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null)
  const [decryptLoading, setDecryptLoading] = useState<boolean>(true)
  const [participantLabels, setParticipantLabels] = useState<string[]>([])

  // Ref-based mount guard — survives re-renders without cancelling in-flight promises
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // ── Decrypt preview ────────────────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDecryptLoading(true)
    setDecryptedMessage(null)

    if (!latest_message?.message) {
      setDecryptedMessage('')
      setDecryptLoading(false)
      return
    }

    let envelope: ReturnType<typeof MessageEnvelope.fromMatchedString>
    try {
      envelope = MessageEnvelope.fromMatchedString(latest_message.message)
    } catch {
      setDecryptedMessage(null)
      setDecryptLoading(false)
      return
    }

    if (!envelope) {
      setDecryptedMessage(null)
      setDecryptLoading(false)
      return
    }

    majik
      .decryptEnvelope(envelope, true)
      .then((plaintext) => {
        if (isMounted.current) {
          setDecryptedMessage(plaintext ?? '')
          setDecryptLoading(false)
        }
      })
      .catch(() => {
        if (isMounted.current) {
          setDecryptedMessage(null)
          setDecryptLoading(false)
        }
      })
  }, [majik, conversation_id, latest_message?.message])

  // ── Resolve participant labels ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const resolveParticipants = async (): Promise<void> => {
      try {
        const labels = await Promise.all(
          participants.map(async (pk: string) => {
            try {
              const contact = await majik.getContactByPublicKey(pk)
              return contact?.meta.label?.trim() ? contact.meta.label : shortenKey(pk)
            } catch {
              return shortenKey(pk)
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
  }, [majik, participants])

  // ── Avatar rendering ───────────────────────────────────────────────────────
  const renderAvatars = (): React.ReactNode => {
    if (participantLabels.length === 0) {
      return (
        <AvatarSingle $hue={0} $size={32}>
          ?
        </AvatarSingle>
      )
    }
    if (participantLabels.length === 1) {
      const n = participantLabels[0]
      return (
        <AvatarSingle $hue={getHue(n)} $size={32}>
          {getInitials(n)}
        </AvatarSingle>
      )
    }
    const n1 = participantLabels[0]
    const n2 = participantLabels[1]
    return (
      <AvatarStack>
        <AvatarA1 $hue={getHue(n1)} $size={24}>
          {getInitials(n1)}
        </AvatarA1>
        <AvatarA2 $hue={getHue(n2)} $size={20}>
          {getInitials(n2)}
        </AvatarA2>
      </AvatarStack>
    )
  }

  const displayName =
    participantLabels.length > 0
      ? participantLabels.join(', ')
      : participants.map((p) => shortenKey(p)).join(', ')

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card $active={isActive} $unread={has_unread} onClick={() => onClick?.(conversation)}>
      {renderAvatars()}

      <Body>
        <TopRow>
          <Name $bold={has_unread} data-private>
            {displayName}
          </Name>
          <Time $bold={has_unread}>{formatTimestamp(latest_message_timestamp)}</Time>
        </TopRow>

        {decryptLoading ? (
          <PreviewSkeleton />
        ) : (
          <Preview $unread={has_unread} data-private>
            {decryptedMessage?.trim() || 'No messages yet'}
          </Preview>
        )}

        <FooterRow>
          <MsgCount>{total_messages} msgs</MsgCount>
          {has_unread && unread_count > 0 && <UnreadBadge>{unread_count}</UnreadBadge>}
        </FooterRow>
      </Body>
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shortenKey(pk: MajikMessagePublicKey, chars = 5): string {
  const s = String(pk)
  return `${s.slice(0, chars)}…${s.slice(-4)}`
}

function formatTimestamp(ts: string): string {
  return moment(new Date(ts)).fromNow()
}

function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
