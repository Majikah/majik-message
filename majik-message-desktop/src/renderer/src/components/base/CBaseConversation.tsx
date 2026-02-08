import React, { useEffect } from 'react'
import styled from 'styled-components'

import { MessageEnvelope, type MajikMessagePublicKey } from '@majikah/majik-message'
import type { ConversationSummary } from '../majikah-session-wrapper/api-types'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import moment from 'moment'

/* --------------------------------
 * Styled Components
 * -------------------------------- */

const Card = styled.div<{
  $active: boolean
  $unread: boolean
}>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;

  padding: 12px 14px;
  border-radius: 12px;

  cursor: pointer;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;

  background: ${({ $active, theme }) =>
    $active ? theme.colors.semitransparent : 'rgba(255,255,255,0.04)'};

  box-shadow: ${({ $unread, theme }) =>
    $unread ? `0 0 0 1px ${theme.colors.secondaryBackground}` : 'none'};

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`

const Participants = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const Participant = styled.span`
  font-size: 12px;
  opacity: 0.85;
  padding: 2px 6px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
`

const Timestamp = styled.span`
  font-size: 11px;
  opacity: 0.6;
  white-space: nowrap;
`

const MessagePreview = styled.div<{ $unread: boolean }>`
  font-size: 14px;
  line-height: 1.4;
  opacity: ${({ $unread }) => ($unread ? 1 : 0.75)};
  font-weight: ${({ $unread }) => ($unread ? 600 : 400)};

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const Count = styled.span`
  font-size: 11px;
  opacity: 0.6;
`

const UnreadBadge = styled.span`
  min-width: 20px;
  height: 20px;
  padding: 0 6px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 11px;
  font-weight: 600;

  border-radius: 10px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryBackground};
`

const ReadIndicator = styled.div<{ $unread: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;

  background: ${({ $unread, theme }) => ($unread ? theme.colors.primary : 'transparent')};
`

const TextPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
  padding: 10px 25px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`

/* --------------------------------
 * Props
 * -------------------------------- */

interface CBaseConversationProps {
  majik: MajikMessageDatabase
  conversation: ConversationSummary
  isActive?: boolean
  onClick?: (conversation: ConversationSummary) => void
}

/* --------------------------------
 * Component
 * -------------------------------- */

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

  const [decryptedMessage, setDecryptedMessage] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [participantLabels, setParticipantLabels] = React.useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const decrypt = async (): Promise<void> => {
      try {
        if (!latest_message?.message) {
          setDecryptedMessage('')
          return
        }

        const envelope = MessageEnvelope.fromMatchedString(latest_message.message)

        if (!envelope) {
          setDecryptedMessage(null)
          return
        }

        const plaintext = await majik.decryptEnvelope(envelope, true)

        if (!cancelled) {
          setDecryptedMessage(plaintext ?? '')
        }
      } catch (err) {
        console.error('Decryption failed', err)
        if (!cancelled) {
          setDecryptedMessage(null)
        }
      } finally {
        setLoading(false)
      }
    }

    decrypt()

    return () => {
      cancelled = true
    }
  }, [majik, conversation_id, latest_message?.message])

  useEffect(() => {
    let cancelled = false

    const resolveParticipants = async (): Promise<void> => {
      try {
        const labels = await Promise.all(
          participants.map(async (pk) => {
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
  }, [majik, participants])

  return (
    <Card $active={isActive} $unread={has_unread} onClick={() => onClick?.(conversation)}>
      <Header>
        <Participants>
          {participantLabels.map((label, idx) => (
            <Participant key={idx} data-private>
              {label}
            </Participant>
          ))}
        </Participants>

        <Timestamp>{formatTimestamp(latest_message_timestamp)}</Timestamp>
      </Header>
      {decryptedMessage?.trim() ? (
        <MessagePreview $unread={has_unread} data-private>
          {decryptedMessage ?? 'No messages yet'}
        </MessagePreview>
      ) : (
        <TextPlaceholder>{loading ? 'Loading...' : 'Invalid Message'}</TextPlaceholder>
      )}

      <Footer>
        <Meta>
          <Count>{total_messages} msgs</Count>
          {has_unread && <UnreadBadge>{unread_count}</UnreadBadge>}
        </Meta>

        <ReadIndicator $unread={has_unread} />
      </Footer>
    </Card>
  )
}

/* --------------------------------
 * Helpers
 * -------------------------------- */

function shortenPublicKey(pk: MajikMessagePublicKey, chars = 6): string {
  const str = String(pk)
  return `${str.slice(0, chars)}…${str.slice(-chars)}`
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts)
  return moment(date).fromNow()
}
