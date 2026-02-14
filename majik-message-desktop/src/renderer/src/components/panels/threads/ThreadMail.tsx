'use client'
import React, { useCallback, useEffect, useState } from 'react'
import styled, { css } from 'styled-components'
import { BracketsCurlyIcon, CaretDownIcon, CopyIcon, TextAaIcon } from '@phosphor-icons/react'
import moment from 'moment'
import { MessageEnvelope, type MajikMessageMail } from '@majikah/majik-message'
import type { MajikMessagePublicKey } from '@majikah/majik-message'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'
import { downloadBlob } from '@renderer/utils/utils'
import { toast } from 'sonner'
import StyledIconButton from '@renderer/components/foundations/StyledIconButton'

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── Pill shared base ─────────────────────────────────────────────────────────
const pillBase = css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  line-height: 1.6;
`

// ─── Root card ────────────────────────────────────────────────────────────────
/**
 * Single border radius, no margin — spacing handled by the parent list gap.
 * Border tints with primary when unread to subtly draw the eye.
 * $isUnread is passed through for the border color only.
 */
const Card = styled.div<{ $isUnread: boolean }>`
  width: 100%;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid
    ${({ theme, $isUnread }) =>
      $isUnread
        ? `${theme.colors.primary}40` /* ~25% opacity tint */
        : theme.colors.secondaryBackground};
  border-radius: 10px;
  overflow: hidden;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;

  &:hover {
    border-color: ${({ theme, $isUnread }) =>
      $isUnread ? `${theme.colors.primary}70` : theme.colors.secondaryBackground};
  }
`

// ─── Shared header row (collapsed + expanded share this shell) ────────────────
const HeaderRow = styled.div<{ $clickable: boolean }>`
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  transition: background 150ms ease;
  user-select: none;
  overflow: hidden;

  &:hover {
    background: ${({ theme, $clickable }) =>
      $clickable ? theme.colors.secondaryBackground : 'transparent'};
    box-shadow: 0 3px 16px rgba(0, 0, 0, 0.2);
  }
`

// ─── Avatar ───────────────────────────────────────────────────────────────────
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

// ─── Caret toggle ────────────────────────────────────────────────────────────
/**
 * Single element — rotates 180° when expanded rather than swapping icons.
 * Disabled state shown via opacity, not cursor change, since the latest
 * message is always expanded and non-collapsible.
 */
const Caret = styled.div<{ $isExpanded: boolean; $disabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  transform: rotate(${({ $isExpanded }) => ($isExpanded ? '180deg' : '0deg')});
  transition: transform 200ms ease;
  opacity: ${({ $disabled }) => ($disabled ? 0.3 : 1)};
`

// ─── Header body (sender + preview / recipients) ──────────────────────────────
const HeaderBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const SenderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
`

const SenderName = styled.span<{ $bold: boolean }>`
  font-size: 13px;
  font-weight: ${({ $bold }) => ($bold ? 700 : 500)};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

/**
 * Public key shown as a monospaced chip — visually quieter than the
 * full key but still lets privacy-conscious users spot-check sender identity.
 */
const KeyChip = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
`

const RecipientsLine = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.7;
`

const Preview = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.65;
`

// ─── Header right (timestamp + read pill) ─────────────────────────────────────
const HeaderRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  flex-shrink: 0;
`

const Timestamp = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.04em;
  white-space: nowrap;
`

// Read pill: muted when read, primary-tinted when unread
const ReadPill = styled.span<{ $isRead: boolean }>`
  ${pillBase}
  ${({ theme, $isRead }) =>
    $isRead
      ? css`
          background: ${theme.colors.secondaryBackground};
          color: ${theme.colors.textSecondary};
          border: 1px solid transparent;
        `
      : css`
          background: ${theme.colors.primary};
          color: #fff;
        `}
`

// ─── Metadata band ────────────────────────────────────────────────────────────
/**
 * Sits between the header and body when subject/priority/attachments exist.
 * Uses secondaryBackground to visually separate it from the message body.
 */
const MetaBand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 9px 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-top: 1px solid rgba(255, 255, 255, 0.04);
`

const MetaRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`

const MetaLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  min-width: 72px;
  flex-shrink: 0;
`

const MetaValue = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
`

// ─── Message body ─────────────────────────────────────────────────────────────
const Body = styled.div`
  padding: 16px;
  font-size: 13px;
  line-height: 1.75;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: pre-wrap;
  word-wrap: break-word;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`

// ─── Action bar ───────────────────────────────────────────────────────────────
/**
 * Subtle tinted background so the actions feel like a footer,
 * not just floating buttons on the card.
 */
const ActionBar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.secondaryBackground}33;
`

// ─── Props ────────────────────────────────────────────────────────────────────
interface ThreadMailProps {
  majik: MajikMessageDatabase
  mail: MajikMessageMail
  currentUserPublicKey: MajikMessagePublicKey
  isLatest: boolean
  isSingle: boolean
  displayNames?: Record<string, string>
  onToggleStar?: (mailId: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ThreadMail: React.FC<ThreadMailProps> = ({
  majik,
  mail,
  currentUserPublicKey,
  isLatest,
  isSingle,
  displayNames = {}
}) => {
  const [isExpanded, setIsExpanded] = useState(isLatest)
  const [text, setText] = useState<string>('')

  // The latest message or a single message can't be collapsed
  const canCollapse = !isLatest && !isSingle

  // ── Decrypt ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    let envelope: MessageEnvelope

    try {
      envelope = MessageEnvelope.fromMatchedString(mail.message)
    } catch {
      return
    }
    if (!envelope) return

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

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleExpand = (): void => {
    if (canCollapse) setIsExpanded((prev) => !prev)
  }

  const handleCopy = useCallback(() => {
    if (!mail.message?.trim()) {
      toast.error('Failed to copy to clipboard', {
        description: 'No text to copy.',
        id: 'toast-error-copy'
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
      toast.error('Failed to copy to clipboard', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-copy-${mail?.message}`
      })
    }
  }, [mail.message])

  const handleDownloadTxt = async (): Promise<void> => {
    const blob = new Blob([mail.message], { type: 'application/octet-stream' })
    const sender = await majik.getContactByPublicKey(mail.sender)
    downloadBlob(
      blob,
      'txt',
      `Mail Message from ${sender?.meta?.label ?? mail.sender}_${mail.id}_${mail.timestamp.toLocaleDateString()}`
    )
  }

  const handleDownloadJson = async (): Promise<void> => {
    const blob = new Blob([JSON.stringify({ original: text, encrypted: mail.message })], {
      type: 'application/json;charset=utf-8'
    })
    const sender = await majik.getContactByPublicKey(mail.sender)
    downloadBlob(
      blob,
      'json',
      `Mail Message from ${sender?.meta?.label ?? mail.sender}_${mail.id}_${mail.timestamp.toLocaleDateString()}`
    )
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const senderKey = mail.sender
  const senderName = displayNames[senderKey] || senderKey
  const isOwn = mail.isSender(currentUserPublicKey)
  const hasUserRead = mail.hasUserRead(currentUserPublicKey)
  const isUnread = !hasUserRead && !isOwn

  const recipientNames = mail.recipients.map((key) => displayNames[key] || key).join(', ')

  const timestamp = moment(mail.timestamp)
  const relativeTime = timestamp.fromNow()
  const fullTime = timestamp.format('MMM D, YYYY [at] h:mm A')

  const subject = mail.metadata?.subject || '(No Subject)'
  const priority = mail.metadata?.priority
  const attachments = mail.metadata?.attachments || []

  const avatarHue = getHue(senderName)
  const initials = getInitials(senderName)
  const shortKey = shortenKey(senderKey)

  const hasMetadata = subject || priority || attachments.length > 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card $isUnread={isUnread}>
      {/* ── Header (shared layout, caret rotates) ── */}
      <HeaderRow $clickable={canCollapse} onClick={handleToggleExpand}>
        <Caret $isExpanded={isExpanded} $disabled={!canCollapse}>
          <CaretDownIcon size={14} />
        </Caret>

        <Avatar $hue={avatarHue}>{initials}</Avatar>

        <HeaderBody>
          <SenderRow>
            <SenderName $bold={isUnread} data-private>
              {senderName}
            </SenderName>
            {/* Show key chip only when expanded — collapsed already tight on space */}
            {isExpanded && <KeyChip data-private>{shortKey}</KeyChip>}
            {isUnread && !isExpanded && <ReadPill $isRead={false}>New</ReadPill>}
          </SenderRow>

          {isExpanded ? (
            // Expanded: show recipients line
            recipientNames && <RecipientsLine data-private>to {recipientNames}</RecipientsLine>
          ) : (
            // Collapsed: show message preview
            <Preview data-private>{text}</Preview>
          )}
        </HeaderBody>

        <HeaderRight>
          <Timestamp title={fullTime}>{relativeTime}</Timestamp>
          {/* Read pill only when expanded — keeps collapsed rows minimal */}
          {isExpanded && !isOwn && (
            <ReadPill $isRead={hasUserRead}>{hasUserRead ? 'Read' : 'Unread'}</ReadPill>
          )}
        </HeaderRight>
      </HeaderRow>

      {/* ── Metadata band (subject / priority / attachments) ── */}
      {isExpanded && hasMetadata && (
        <MetaBand>
          {subject && (
            <MetaRow>
              <MetaLabel>Subject</MetaLabel>
              <MetaValue data-private>{subject}</MetaValue>
            </MetaRow>
          )}
          {priority && (
            <MetaRow>
              <MetaLabel>Priority</MetaLabel>
              <MetaValue style={{ textTransform: 'capitalize' }}>{priority}</MetaValue>
            </MetaRow>
          )}
          {attachments.length > 0 && (
            <MetaRow>
              <MetaLabel>Attachments</MetaLabel>
              <MetaValue data-private>{attachments.join(', ')}</MetaValue>
            </MetaRow>
          )}
        </MetaBand>
      )}

      {/* ── Message body ── */}
      {isExpanded && <Body>{text}</Body>}

      {/* ── Action bar ── */}
      {isExpanded && (
        <ActionBar>
          <StyledIconButton
            onClick={handleCopy}
            aria-label="Copy encrypted message"
            icon={CopyIcon}
            title="Copy encrypted message to clipboard"
            size={22}
          />
          <StyledIconButton
            onClick={handleDownloadTxt}
            aria-label="Download as .txt"
            icon={TextAaIcon}
            title="Download encrypted message as .txt"
            size={22}
          />
          <StyledIconButton
            onClick={handleDownloadJson}
            aria-label="Download as .json"
            icon={BracketsCurlyIcon}
            title="Download encrypted message as .json"
            size={22}
          />
        </ActionBar>
      )}
    </Card>
  )
}

export default ThreadMail

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function shortenKey(key: string, chars = 4): string {
  const s = String(key)
  return `${s.slice(0, chars)}…${s.slice(-chars)}`
}
