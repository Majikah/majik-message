import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import {
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  HandPalmIcon,
  NotePencilIcon,
  PlusIcon,
  TrashIcon,
  EnvelopeIcon,
  LockSimpleIcon
} from '@phosphor-icons/react'
import ThreadMail from './ThreadMail'
import { MajikMessageMail, type MajikMessageThread, ThreadStatus } from '@majikah/majik-message'

import { useMajikah } from '@renderer/components/majikah-session-wrapper/use-majikah'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'
import { toast } from 'sonner'

import UserAuth from '@renderer/components/foundations/UserAuth'
import { MajikMessageIdentitySelector } from '@renderer/components/MajikMessageIdentitySelector'
import StyledIconButton from '@renderer/components/foundations/StyledIconButton'
import PopUpFormButton from '@renderer/components/foundations/PopUpFormButton'
import NewMailForm from './NewMailForm'
import CustomInputField from '@renderer/components/foundations/CustomInputField'
import { isDevEnvironment } from '@renderer/utils/utils'
import ConfirmationButton from '@renderer/components/foundations/ConfirmationButton'
import GuideHelper from '@renderer/components/functional/GuideHelper'
import { launchTutorialThreadsMessages } from '@renderer/lib/shepherd-js/tutorials/tutorial-threads'
import { useShepherd } from '@renderer/lib/shepherd-js/use-shepherd'
import DynamicPlaceholder from '@renderer/components/foundations/DynamicPlaceholder'
import CustomToggleSwitch from '@renderer/components/foundations/CustomToggleSwitch'

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── Pill base ────────────────────────────────────────────────────────────────
const pillBase = css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  line-height: 1.6;
`

// ─── Root ─────────────────────────────────────────────────────────────────────
/**
 * Removed the 50px horizontal padding from the original — it was too
 * generous for a panel that lives inside a sliding dialogue. Content
 * breathes via internal padding on each zone instead.
 */
const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.primaryBackground};
`

// ─── Header zone ─────────────────────────────────────────────────────────────
/**
 * Two sub-rows:
 *   1. Title row  — thread subject + status pill
 *   2. Toolbar    — action buttons + pagination
 * Both sit above the scroll area and never scroll.
 */
const HeaderZone = styled.div`
  flex-shrink: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
`

const TitleLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
`

const ThreadTitle = styled.h2`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  letter-spacing: -0.02em;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ParticipantChips = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
`

/**
 * Monospaced key chip — gives immediate "this is a cryptographic identifier"
 * signal without needing any label.
 */
const KeyChip = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  white-space: nowrap;
`

// Status pills — one variant per thread status
const StatusPill = styled.span<{
  $status: 'active' | 'closed' | 'pending_deletion' | 'default'
}>`
  ${pillBase}
  ${({ theme, $status }) => {
    switch ($status) {
      case 'closed':
        return css`
          background: rgba(16, 185, 129, 0.12);
          color: ${theme.colors.brand?.green ?? '#10b981'};
          border: 1px solid rgba(16, 185, 129, 0.22);
        `
      case 'pending_deletion':
        return css`
          background: rgba(245, 158, 11, 0.13);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        `
      case 'active':
        return css`
          background: ${theme.colors.secondaryBackground};
          color: ${theme.colors.textSecondary};
          border: 1px solid transparent;
        `
      default:
        return css`
          background: ${theme.colors.secondaryBackground};
          color: ${theme.colors.textSecondary};
          border: 1px solid transparent;
        `
    }
  }}
`

// ─── Toolbar ──────────────────────────────────────────────────────────────────
const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-wrap: wrap;
`

const ToolbarDivider = styled.div`
  width: 1px;
  height: 18px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  margin: 0 2px;
  flex-shrink: 0;
`

const ToolbarSpacer = styled.div`
  flex: 1;
`

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const PageLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.04em;
`

const PageBtn = styled.button<{ $disabled: boolean }>`
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  border-radius: 5px;
  color: ${({ theme, $disabled }) =>
    $disabled ? theme.colors.secondaryBackground : theme.colors.textSecondary};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  transition: all 150ms ease;

  &:hover {
    background: ${({ theme, $disabled }) =>
      $disabled ? 'transparent' : theme.colors.secondaryBackground};
    color: ${({ theme, $disabled }) =>
      $disabled ? theme.colors.secondaryBackground : theme.colors.textPrimary};
  }

  &:active {
    transform: ${({ $disabled }) => ($disabled ? 'none' : 'scale(0.92)')};
  }
`

// ─── Scroll area ──────────────────────────────────────────────────────────────
/**
 * Single scrolling region — no nested MailsList with its own overflow.
 * The double-scroll issue from the original is resolved by letting this
 * single container own all vertical overflow.
 */
const ScrollArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.secondaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`

// ─── Mail count label ─────────────────────────────────────────────────────────
const MailCountLabel = styled.div`
  text-align: center;
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.5;
  padding: 2px 0 6px;
`

// ─── Empty / loading states ───────────────────────────────────────────────────
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  text-align: center;
  flex: 1;
`

const EmptyIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 4px;
`

const EmptyTitle = styled.p`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`

const EmptyMessage = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  max-width: 220px;
  line-height: 1.5;
`

const LoadingWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px 20px;
`

// ─── Identity selector fallback ───────────────────────────────────────────────
const IdentityPrompt = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 13px;
  flex: 1;
`

// ─── Props ────────────────────────────────────────────────────────────────────
interface ThreadViewerProps {
  majik: MajikMessageDatabase
  thread: MajikMessageThread
  onPageChange?: (page: number) => void
  onReload?: () => void
  onToggleStar?: (mailId: string) => void
  onDelete?: (thread: MajikMessageThread) => void
  onRevokeDelete?: (thread: MajikMessageThread) => void
  onMarkClosed?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ThreadViewer: React.FC<ThreadViewerProps> = ({
  majik,
  thread,
  onPageChange,
  onReload,
  onToggleStar,
  onDelete,
  onRevokeDelete,
  onMarkClosed
}) => {
  const { majikah } = useMajikah()
  const tour = useShepherd()
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const isInitialMount = useRef<boolean>(true)

  const [fetchedMails, setFetchedMails] = useState<MajikMessageMail[]>([])
  const [totalMails, setTotalMails] = useState<number>(0)
  const [loading, setIsLoading] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [allowNextPage, setAllowNextPage] = useState<boolean>(false)
  const [deleteOnClose, setDeleteOnClose] = useState<boolean>(false)
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})
  const [threadLabel, setThreadLabel] = useState<string | undefined>(thread.metadata.subject)

  const isRefreshingRef = useRef(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const mailRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const pendingReadBatchRef = useRef<Set<string>>(new Set())
  const markedAsReadRef = useRef<Set<string>>(new Set())
  const batchTimeoutRef = useRef<number | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────
  const refreshMails = useCallback(async () => {
    if (!majikah?.isAuthenticated) return
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true

    try {
      setIsLoading(true)
      const fetchResponse = await majik.getThreadMessages(thread.id)
      const mails = fetchResponse.messages
        .map((m) => MajikMessageMail.fromJSON(m))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      setTotalMails(fetchResponse.total_messages)
      setFetchedMails(mails)
      setAllowNextPage(fetchResponse.canNextPage)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to refresh mails', { description: error?.message })
      }
    } finally {
      isRefreshingRef.current = false
      setIsLoading(false)
    }
  }, [majik, majikah.isAuthenticated, thread.id])

  useEffect(() => {
    refreshMails()
  }, [refreshMails])

  // ── Resolve display names ──────────────────────────────────────────────────
  const participantKeys = useMemo(
    () => [...new Set(thread.participants)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thread.id]
  )

  useEffect(() => {
    let cancelled = false
    const resolveNames = async (): Promise<void> => {
      const entries = await Promise.all(
        participantKeys.map(async (key) => {
          try {
            const contact = await majik.getContactByPublicKey(key)
            return [key, contact?.meta?.label || key.slice(0, 6) + '…' + key.slice(-4)] as const
          } catch {
            return [key, key.slice(0, 6) + '…' + key.slice(-4)] as const
          }
        })
      )
      if (!cancelled) setDisplayNames(Object.fromEntries(entries))
    }
    if (participantKeys.length > 0) resolveNames()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantKeys])

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isInitialMount.current && fetchedMails.length > 0) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      })
      isInitialMount.current = false
    } else if (fetchedMails.length > 0) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [fetchedMails.length])

  // ── Intersection observer (batch mark-read) ────────────────────────────────
  const handleBatchMarkRead = useCallback(
    (mailIds: string[]) => {
      if (!mailIds.length) return
      if (isDevEnvironment()) console.log('[ThreadViewer] Batch mark read:', mailIds)

      setFetchedMails((prevMails) =>
        prevMails.map((mail) => {
          if (mailIds.includes(mail.id)) {
            const updatedMail = mail.clone()
            updatedMail.markAsRead(majik.currentIdentity!.publicKey)
            return updatedMail
          }
          return mail
        })
      )

      majik.markMailMessagesAsRead(thread.id, true, mailIds).catch((error) => {
        console.error('[ThreadViewer] Failed to mark as read:', error)
        toast.error('Failed to mark messages as read', { description: error?.message })
        refreshMails()
      })
    },
    [majik, thread.id, refreshMails]
  )

  const flushBatch = useCallback(() => {
    if (pendingReadBatchRef.current.size === 0) return
    const ids = Array.from(pendingReadBatchRef.current)
    pendingReadBatchRef.current.clear()
    handleBatchMarkRead(ids)
  }, [handleBatchMarkRead])

  useEffect(() => {
    if (!majik?.currentIdentity?.publicKey) return
    if (fetchedMails.length === 0) return

    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const mailId = entry.target.getAttribute('data-mail-id')
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return
          if (!mailId) return
          if (markedAsReadRef.current.has(mailId)) return

          const mail = fetchedMails.find((m) => m.id === mailId)
          if (!mail) return
          if (mail.sender === majik.currentIdentity!.publicKey) return
          if (mail.hasUserRead?.(majik.currentIdentity!.publicKey)) return
          if (!document.hasFocus()) return

          markedAsReadRef.current.add(mailId)
          pendingReadBatchRef.current.add(mailId)

          if (batchTimeoutRef.current) window.clearTimeout(batchTimeoutRef.current)
          batchTimeoutRef.current = window.setTimeout(flushBatch, 500)
        })
      },
      { root: scrollAreaRef.current, threshold: 0.5 }
    )

    mailRefsMap.current.forEach((el) => observerRef.current?.observe(el))

    return () => {
      observerRef.current?.disconnect()
      if (batchTimeoutRef.current) window.clearTimeout(batchTimeoutRef.current)
    }
  }, [fetchedMails, majik?.currentIdentity, flushBatch])

  // ── Pagination ─────────────────────────────────────────────────────────────
  const handlePreviousPage = (): void => {
    if (page > 1) {
      const newPage = page - 1
      setPage(newPage)
      onPageChange?.(newPage)
    }
  }

  const handleNextPage = (): void => {
    if (!allowNextPage) return
    const newPage = page + 1
    setPage(newPage)
    onPageChange?.(newPage)
  }

  // ── Thread actions ─────────────────────────────────────────────────────────
  const handleReload = (): void => {
    refreshMails()
    onReload?.()
  }

  const handleChangeThreadLabel = (input: string | undefined): void => {
    setThreadLabel(input?.trim() ? input : undefined)
  }

  const processRenameThread = async (): Promise<string> => {
    if (!threadLabel?.trim()) throw new Error('Please provide a valid thread subject or topic.')
    if (!majik.currentIdentity) throw new Error('No active account found')
    if (!thread?.validate()) throw new Error('Invalid thread')

    const updatedThread = thread.updateMetadata({ subject: threadLabel })
    const updateResponse = await majik.updateThreadMetadata(updatedThread)
    return updateResponse?.success
      ? 'Thread updated successfully!'
      : "Oh no... There's a problem while updating this thread."
  }

  const handleRenameThread = async (): Promise<void> => {
    if (!majik.currentIdentity) return
    if (!threadLabel?.trim()) {
      toast.error('Please provide a valid thread subject or topic.')
      return
    }
    if (!thread?.validate()) {
      toast.error('Invalid thread provided.')
      return
    }

    toast.promise(processRenameThread(), {
      loading: 'Updating thread...',
      success: (msg) => msg,
      error: () => "Oh no... There's a problem while updating this thread."
    })
  }

  const processCloseThread = async (): Promise<string> => {
    if (!majik.currentIdentity) throw new Error('No active account found')
    if (!thread?.validate()) throw new Error('Invalid thread')
    const closeResponse = await majik.markThreadAsClosed(thread, deleteOnClose)
    return closeResponse?.success
      ? closeResponse.message || 'Thread closed successfully!'
      : "Oh no... There's a problem while closing this thread."
  }

  const handleCloseThread = async (): Promise<void> => {
    if (!majik.currentIdentity) return
    if (!thread?.validate()) {
      toast.error('Invalid thread provided.')
      return
    }
    if (!thread?.canBeClosed()) {
      toast.error('This thread cannot be closed.')
      return
    }

    toast.promise(processCloseThread(), {
      loading: 'Closing thread...',
      success: (msg) => {
        onMarkClosed?.()
        return msg
      },
      error: () => "Oh no... There's a problem while closing this thread."
    })
  }

  const handleDeleteThread = (): void => onDelete?.(thread)
  const handleCancelDeleteThread = (): void => onRevokeDelete?.(thread)

  // ── Derived ────────────────────────────────────────────────────────────────
  const isPreviousDisabled = page <= 1
  const isNextDisabled = !allowNextPage
  const mailsPerPage = 50
  const startMail = totalMails === 0 ? 0 : (page - 1) * mailsPerPage + 1
  const endMail = Math.min(page * mailsPerPage, totalMails)

  const isUserRestricted = useMemo(
    () => majik?.currentIdentity?.isRestricted() || false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik, majik.user?.id, majik.getActiveAccount()?.id]
  )

  const statusVariant = (): 'active' | 'closed' | 'pending_deletion' | 'default' => {
    if (thread.status === ThreadStatus.CLOSED) return 'closed'
    if (thread.status === ThreadStatus.PENDING_DELETION) return 'pending_deletion'
    if (thread.status === ThreadStatus.ONGOING) return 'active'
    return 'default'
  }

  // Truncated key chips for participants — max 3 shown, rest summarised
  const participantChips = useMemo(() => {
    const keys = [...new Set(thread.participants)]
    const MAX = 3
    const shown = keys.slice(0, MAX)
    const rest = keys.length - MAX
    return { shown, rest }
  }, [thread.participants])

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!majikah?.isAuthenticated) return <UserAuth />

  if (!majik?.currentIdentity?.publicKey) {
    return (
      <Root>
        <HeaderZone>
          <TitleRow>
            <TitleLeft>
              <ThreadTitle data-private>{thread?.metadata?.subject}</ThreadTitle>
            </TitleLeft>
          </TitleRow>
        </HeaderZone>
        <IdentityPrompt>
          <LockSimpleIcon size={24} />
          Please select an active identity to view messages
          <MajikMessageIdentitySelector />
        </IdentityPrompt>
      </Root>
    )
  }

  if (loading) {
    return (
      <Root>
        <HeaderZone>
          <TitleRow>
            <TitleLeft>
              <ThreadTitle data-private>{thread?.metadata?.subject}</ThreadTitle>
            </TitleLeft>
          </TitleRow>
        </HeaderZone>
        <LoadingWrap>
          <DynamicPlaceholder loading>Loading messages…</DynamicPlaceholder>
        </LoadingWrap>
      </Root>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <Root>
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-message/docs/threads-documentation"
        startTour={() => launchTutorialThreadsMessages(tour)}
      />

      {/* ── Header: title + participant chips + status ── */}
      <HeaderZone>
        <TitleRow>
          <TitleLeft>
            <ThreadTitle data-private>{thread?.metadata?.subject || '(No Subject)'}</ThreadTitle>
            <ParticipantChips>
              {participantChips.shown.map((key) => (
                <KeyChip key={key} data-private>
                  {displayNames[key] || key.slice(0, 5) + '…' + key.slice(-4)}
                </KeyChip>
              ))}
              {participantChips.rest > 0 && <KeyChip>+{participantChips.rest} more</KeyChip>}
            </ParticipantChips>
          </TitleLeft>

          <StatusPill $status={statusVariant()}>{thread.status.replace('_', ' ')}</StatusPill>
        </TitleRow>

        {/* ── Toolbar: actions + pagination ── */}
        <Toolbar>
          {/* New message */}
          <PopUpFormButton
            id="button-new-thread-message"
            icon={PlusIcon}
            text="New Message"
            disabled={isUserRestricted || thread.isClosed()}
            modal={{
              title: 'New Message',
              description: 'Create a new mail message for this thread'
            }}
            buttons={{
              cancel: { text: 'Cancel' },
              confirm: { text: 'Create', hide: true }
            }}
          >
            <NewMailForm majikah={majikah} majik={majik} onSend={refreshMails} thread={thread} />
          </PopUpFormButton>

          {/* Rename thread */}
          <PopUpFormButton
            id="button-rename-thread"
            icon={NotePencilIcon}
            text="Rename"
            disabled={isUserRestricted || thread.isClosed()}
            modal={{
              title: 'Rename Thread',
              description: 'Rename or set a label/topic for this thread'
            }}
            buttons={{
              cancel: { text: 'Cancel' },
              confirm: {
                text: 'Apply Changes',
                onClick: handleRenameThread,
                isDisabled: !threadLabel?.trim()
              }
            }}
          >
            <CustomInputField
              label="Topic or Label"
              regex="letters"
              maxChar={150}
              capitalize="first"
              sensitive
              currentValue={threadLabel || ''}
              onChange={handleChangeThreadLabel}
            />
          </PopUpFormButton>

          <ToolbarDivider />

          {/* Reload */}
          <StyledIconButton
            id="button-refresh-thread-messages"
            onClick={handleReload}
            aria-label="Reload Messages"
            icon={ArrowClockwiseIcon}
            title="Reload Messages"
            size={22}
          />

          {/* Close thread */}
          {fetchedMails.length > 0 && (
            <ConfirmationButton
              id="button-close-thread"
              onClick={handleCloseThread}
              aria-label="Mark Thread as Closed"
              disabled={
                !thread.isOwner(majik.currentIdentity!.id) ||
                thread.isClosed() ||
                fetchedMails.length <= 0
              }
              icon={CheckIcon}
              strict
              text="Close Thread"
              requiredText={majikah.user!.email}
              alertTextTitle="Mark Thread as Closed"
              descriptionText="No new messages can be added and the thread cannot be changed, but it will still be visible. It can still be requested for deletion later."
            >
              <CustomToggleSwitch
                label="Delete Thread"
                helper="When enabled, closing the thread will permanently delete it. All participants will receive an email with a download link to the complete message history."
                currentToggle={deleteOnClose}
                onToggle={setDeleteOnClose}
              />
            </ConfirmationButton>
          )}

          {/* Delete / cancel delete */}
          {!thread.hasDeletionApproval(majik.currentIdentity!.publicKey) ? (
            <ConfirmationButton
              id="button-delete-thread-form"
              onClick={handleDeleteThread}
              aria-label="Delete Thread"
              disabled={thread.hasDeletionApproval(majik.currentIdentity!.publicKey)}
              icon={TrashIcon}
              strict
              text="Delete"
              requiredText={majikah.user!.email}
              alertTextTitle="Request Thread Deletion"
              descriptionText="This will send a deletion request for this thread. The thread will only be permanently deleted once all participants have approved the request."
            />
          ) : (
            <ConfirmationButton
              id="button-cancel-delete-thread-form"
              onClick={handleCancelDeleteThread}
              aria-label="Cancel Deletion"
              disabled={!thread.hasDeletionApproval(majik.currentIdentity!.publicKey)}
              icon={HandPalmIcon}
              strict
              text="Cancel Deletion"
              alertTextTitle="Revoke Deletion Request"
              descriptionText="This will revoke your approval to delete this thread. The thread will remain active unless all other participants have also approved deletion."
            />
          )}

          <ToolbarSpacer />

          {/* Pagination — right-aligned */}
          {totalMails > 0 && (
            <Pagination>
              <PageLabel>
                {totalMails > 0 ? `${startMail}–${endMail} of ${totalMails}` : '—'}
              </PageLabel>
              <PageBtn
                onClick={handlePreviousPage}
                $disabled={isPreviousDisabled}
                disabled={isPreviousDisabled}
                aria-label="Previous page"
              >
                <CaretLeftIcon size={13} />
              </PageBtn>
              <PageBtn
                onClick={handleNextPage}
                $disabled={isNextDisabled}
                disabled={isNextDisabled}
                aria-label="Next page"
              >
                <CaretRightIcon size={13} />
              </PageBtn>
            </Pagination>
          )}
        </Toolbar>
      </HeaderZone>

      {/* ── Scroll area + mail list ── */}
      <ScrollArea ref={scrollAreaRef} id="section-thread-messages">
        {fetchedMails.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <EnvelopeIcon size={20} />
            </EmptyIcon>
            <EmptyTitle>No messages yet</EmptyTitle>
            <EmptyMessage>This thread has no messages. Send the first one above.</EmptyMessage>
          </EmptyState>
        ) : (
          <>
            {fetchedMails.length > 1 && (
              <MailCountLabel>
                {fetchedMails.length} {fetchedMails.length === 1 ? 'message' : 'messages'}
              </MailCountLabel>
            )}

            {fetchedMails.map((mail, index) => {
              const isLatest = index === fetchedMails.length - 1
              const isSingle = fetchedMails.length === 1

              return (
                <div
                  key={mail.id}
                  data-mail-id={mail.id}
                  ref={(el) => {
                    if (!el) {
                      const existing = mailRefsMap.current.get(mail.id)
                      if (existing) {
                        observerRef.current?.unobserve(existing)
                        mailRefsMap.current.delete(mail.id)
                      }
                      return
                    }
                    mailRefsMap.current.set(mail.id, el)
                    observerRef.current?.observe(el)
                  }}
                >
                  <ThreadMail
                    majik={majik}
                    mail={mail}
                    currentUserPublicKey={majik.currentIdentity!.publicKey}
                    isLatest={isLatest}
                    isSingle={isSingle}
                    onToggleStar={onToggleStar}
                    displayNames={displayNames}
                  />
                </div>
              )
            })}
          </>
        )}
        <div ref={bottomRef} />
      </ScrollArea>
    </Root>
  )
}

export default ThreadViewer
