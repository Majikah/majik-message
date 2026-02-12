import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import {
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  HandPalmIcon,
  NotePencilIcon,
  PlusIcon,
  TrashIcon
} from '@phosphor-icons/react'
import ThreadMail from './ThreadMail'
import { MajikMessageMail, type MajikMessageThread } from '@majikah/majik-message'

import { useMajikah } from '@renderer/components/majikah-session-wrapper/use-majikah'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'
import { toast } from 'sonner'

import UserAuth from '@renderer/components/foundations/UserAuth'
import { MajikMessageIdentitySelector } from '@renderer/components/MajikMessageIdentitySelector'
import { SectionSubTitle, SectionTitleFrame } from '@renderer/globals/styled-components'
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

const RootContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem 50px;

  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.primaryBackground || '#ffffff'};
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const ThreadTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary || '#111827'};
  margin: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1; /* Max 2 lines before ellipsis */
  overflow: hidden;
  text-overflow: ellipsis;
`

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  justify-content: flex-end;
  margin: 10px 0px;
`

const PageInfo = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-weight: 500;
`

const PaginationButton = styled.button<{ $disabled?: boolean }>`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  padding: 6px;
  cursor: ${(props) => (props.$disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme, $disabled }) =>
    $disabled ? theme.colors.secondaryBackground : theme.colors.textSecondary};
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme, $disabled }) =>
      $disabled ? 'transparent' : theme.colors.textSecondary};
    border-color: ${({ theme, $disabled }) =>
      $disabled ? theme.colors.secondaryBackground : theme.colors.primary};
  }

  &:active {
    transform: ${(props) => (props.$disabled ? 'none' : 'scale(0.95)')};
  }
`

const ScrollArea = styled.div`
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  width: 100%;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 8px;
  }
`

const MailsList = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;

  max-height: calc(85vh - 180px);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 8px;
  }
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
`

const EmptyStateTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary || '#374151'};
  margin: 0 0 8px 0;
`

const EmptyStateMessage = styled.p`
  font-size: 14px;
  margin: 0;
`

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
`

const MailCount = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary || '#6b7280'};
  margin-bottom: 12px;
  text-align: center;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const ThreadStatus = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background-color: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: 6px;
  font-size: 0.875rem;
  white-space: nowrap;
`

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

  const isRefreshingRef = useRef(false)

  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})

  const [threadLabel, setThreadLabel] = useState<string | undefined>(thread.metadata.subject)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const mailRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const pendingReadBatchRef = useRef<Set<string>>(new Set())
  const markedAsReadRef = useRef<Set<string>>(new Set())
  const batchTimeoutRef = useRef<number | null>(null)

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

      if (!cancelled) {
        setDisplayNames(Object.fromEntries(entries))
      }
    }

    if (participantKeys.length > 0) {
      resolveNames()
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantKeys])

  // Scroll to bottom on initial mount and when new mails are added
  useEffect(() => {
    if (isInitialMount.current && fetchedMails.length > 0) {
      // Initial mount - scroll immediately
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      })
      isInitialMount.current = false
    } else if (fetchedMails.length > 0) {
      // New mails added - smooth scroll
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [fetchedMails.length])

  const handleReload = (): void => {
    refreshMails()
    onReload?.()
  }

  const handleChangeThreadLabel = (input: string | undefined): void => {
    if (!input?.trim()) {
      setThreadLabel(undefined)
      return
    }
    setThreadLabel(input)
  }

  const processRenameThread = async (): Promise<string> => {
    if (isDevEnvironment()) console.log('Renaming thread: ', threadLabel)

    if (!threadLabel?.trim()) {
      throw new Error('Please provide a valid thread subject or topic.')
    }

    const activeAccount = majik.currentIdentity
    if (!activeAccount) {
      throw new Error('No active account found')
    }

    if (!thread?.validate()) {
      throw new Error('Invalid thread')
    }

    const updatedThread = thread.updateMetadata({
      subject: threadLabel
    })

    const updateResponse = await majik.updateThreadMetadata(updatedThread)

    if (updateResponse !== null && updateResponse.success) {
      return `Thread updated successfully!`
    } else {
      return `Oh no... There's a problem while updating this thread.`
    }
  }

  const handleRenameThread = async (): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    if (!threadLabel?.trim()) {
      toast.error('Please provide a valid thread subject or topic.')
      return
    }

    if (!thread?.validate()) {
      toast.error('Invalid thread provided.')
      return
    }

    toast.promise(processRenameThread(), {
      loading: `Updating thread...`,
      success: (outputMessage) => {
        setTimeout(() => {}, 1000)

        return outputMessage
      },
      error: () => {
        return `Oh no... There's a problem while updating this thread.`
      }
    })
  }

  const processCloseThread = async (): Promise<string> => {
    if (isDevEnvironment()) console.log('Closing thread: ', thread.id)

    const activeAccount = majik.currentIdentity
    if (!activeAccount) {
      throw new Error('No active account found')
    }

    if (!thread?.validate()) {
      throw new Error('Invalid thread')
    }

    const closeResponse = await majik.markThreadAsClosed(thread, deleteOnClose)

    if (closeResponse !== null && closeResponse.success) {
      return closeResponse.message || `Thread closed successfully!`
    } else {
      return `Oh no... There's a problem while closing this thread.`
    }
  }

  const handleCloseThread = async (): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    if (!thread?.validate()) {
      toast.error('Invalid thread provided.')
      return
    }

    if (!thread?.canBeClosed()) {
      toast.error('This thread cannot be closed.')
      return
    }

    toast.promise(processCloseThread(), {
      loading: `Closing thread...`,
      success: (outputMessage) => {
        setTimeout(() => {}, 1000)
        onMarkClosed?.()
        return outputMessage
      },
      error: () => {
        return `Oh no... There's a problem while closing this thread.`
      }
    })
  }

  const handleDeleteThread = (): void => {
    onDelete?.(thread)
  }

  const handleCancelDeleteThread = (): void => {
    onRevokeDelete?.(thread)
  }

  const handleBatchMarkRead = useCallback(
    (mailIds: string[]) => {
      console.log('[handleBatchMarkRead] CALLED with:', mailIds)
      if (!mailIds.length) return

      if (isDevEnvironment()) {
        console.log('[ThreadViewer] Batch mark read:', mailIds)
      }

      // Optimistic update - update local state immediately
      setFetchedMails((prevMails) =>
        prevMails.map((mail) => {
          if (mailIds.includes(mail.id)) {
            // Clone and mark as read
            const updatedMail = mail.clone()
            updatedMail.markAsRead(majik.currentIdentity!.publicKey)
            return updatedMail
          }
          return mail
        })
      )

      // Then make the API call
      majik
        .markMailMessagesAsRead(thread.id, true, mailIds)
        .then(() => {
          if (isDevEnvironment()) {
            console.log('[ThreadViewer] Successfully marked as read:', mailIds)
          }
        })
        .catch((error) => {
          console.error('[ThreadViewer] Failed to mark as read:', error)
          toast.error('Failed to mark messages as read', {
            description: error?.message
          })
          // Revert optimistic update on error
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

    // Disconnect existing observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isDevEnvironment()) {
          console.log('[Observer] Entries detected:', entries.length)
        }

        entries.forEach((entry) => {
          const mailId = entry.target.getAttribute('data-mail-id')

          if (isDevEnvironment()) {
            console.log('[Observer] Entry:', {
              mailId,
              isIntersecting: entry.isIntersecting,
              intersectionRatio: entry.intersectionRatio
            })
          }

          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return
          if (!mailId) return

          // Already handled locally in this session
          if (markedAsReadRef.current.has(mailId)) return

          const mail = fetchedMails.find((m) => m.id === mailId)
          if (!mail) return

          // Don't mark own mails as read
          if (mail.sender === majik.currentIdentity!.publicKey) {
            if (isDevEnvironment()) {
              console.log('[Observer] Skipping own mail:', mailId)
            }
            return
          }

          // Check if already read by current user
          const isAlreadyRead = mail.hasUserRead?.(majik.currentIdentity!.publicKey)

          if (isDevEnvironment()) {
            console.log('[Observer] Mail check:', {
              mailId,
              isAlreadyRead,
              readBy: mail.readBy,
              currentUser: majik.currentIdentity!.publicKey.slice(0, 10) + '...'
            })
          }

          // Skip if already read
          if (isAlreadyRead) {
            if (isDevEnvironment()) {
              console.log('[Observer] Skipping already read:', mailId)
            }
            return
          }

          // Tab not focused → don't mark
          if (!document.hasFocus()) {
            if (isDevEnvironment()) {
              console.log('[Observer] Tab not focused, skipping:', mailId)
            }
            return
          }

          if (isDevEnvironment()) {
            console.log('[Observer] ✓ Adding to batch:', mailId)
          }

          markedAsReadRef.current.add(mailId)
          pendingReadBatchRef.current.add(mailId)

          // Debounced flush
          if (batchTimeoutRef.current) {
            window.clearTimeout(batchTimeoutRef.current)
          }

          batchTimeoutRef.current = window.setTimeout(() => {
            if (isDevEnvironment()) {
              console.log('[Observer] Flushing batch after timeout')
            }
            flushBatch()
          }, 500)
        })
      },
      {
        root: scrollAreaRef.current,
        threshold: 0.5
      }
    )

    // Re-observe all current mail elements
    if (isDevEnvironment()) {
      console.log('[Observer] Observing elements:', mailRefsMap.current.size)
    }

    mailRefsMap.current.forEach((el, mailId) => {
      observerRef.current?.observe(el)
      if (isDevEnvironment()) {
        console.log('[Observer] Observing element:', mailId)
      }
    })

    return () => {
      if (isDevEnvironment()) {
        console.log('[Observer] Cleaning up observer')
      }
      observerRef.current?.disconnect()
      if (batchTimeoutRef.current) {
        window.clearTimeout(batchTimeoutRef.current)
      }
    }
  }, [fetchedMails, majik?.currentIdentity, flushBatch])

  const isPreviousDisabled = page <= 1
  const isNextDisabled = !allowNextPage

  const mailsPerPage = 50 // or your API/page size

  const startMail = totalMails === 0 ? 0 : (page - 1) * mailsPerPage + 1
  const endMail = Math.min(page * mailsPerPage, totalMails)

  const isUserRestricted = useMemo(() => {
    return majik?.currentIdentity?.isRestricted() || false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, majik.user?.id, majik.getActiveAccount()?.id])

  if (!majikah?.isAuthenticated) {
    return <UserAuth />
  }

  if (!majik?.currentIdentity?.publicKey) {
    return (
      <RootContainer>
        <Header>
          <ThreadTitle>{thread?.metadata?.subject}</ThreadTitle>
        </Header>
        <LoadingState>Please select an active identity first</LoadingState>
        <MajikMessageIdentitySelector />
      </RootContainer>
    )
  }

  if (loading) {
    return (
      <RootContainer>
        <Header>
          <ThreadTitle data-private>{thread?.metadata?.subject}</ThreadTitle>
        </Header>
        <DynamicPlaceholder loading={true}>Loading messages...</DynamicPlaceholder>
      </RootContainer>
    )
  }

  return (
    <RootContainer>
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-message/docs/threads-documentation"
        startTour={() => launchTutorialThreadsMessages(tour)}
      />
      <Header>
        <SectionTitleFrame>
          <Row>
            <h2>Messages</h2>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 15 }}>
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
                  cancel: {
                    text: 'Cancel'
                  },
                  confirm: {
                    text: 'Create',
                    hide: true
                  }
                }}
              >
                <NewMailForm majik={majik} onSend={refreshMails} thread={thread} />
              </PopUpFormButton>

              <PopUpFormButton
                id="button-rename-thread"
                icon={NotePencilIcon}
                text="Rename Thread"
                disabled={isUserRestricted || thread.isClosed()}
                modal={{
                  title: 'Rename Thread',
                  description: 'Rename or set a label/topic for this thread'
                }}
                buttons={{
                  cancel: {
                    text: 'Cancel'
                  },
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

              <Controls>
                <StyledIconButton
                  id="button-refresh-thread-messages"
                  onClick={handleReload}
                  aria-label="Reload Messages"
                  icon={ArrowClockwiseIcon}
                  title="Reload Messages"
                  size={25}
                />
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
                    strict={true}
                    text="Mark Thread as Closed"
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

                {!thread.hasDeletionApproval(majik.currentIdentity!.publicKey) ? (
                  <ConfirmationButton
                    id="button-delete-thread-form"
                    onClick={handleDeleteThread}
                    aria-label="Delete Thread"
                    disabled={thread.hasDeletionApproval(majik.currentIdentity!.publicKey)}
                    icon={TrashIcon}
                    strict={true}
                    text="Delete Thread"
                    requiredText={majikah.user!.email}
                    alertTextTitle="Request Thread Deletion"
                    descriptionText="This will send a deletion request for this thread. The thread will only be permanently deleted once all participants have approved the request."
                  />
                ) : (
                  <ConfirmationButton
                    id="button-delete-thread-form"
                    onClick={handleCancelDeleteThread}
                    aria-label="Cancel Deletion"
                    disabled={!thread.hasDeletionApproval(majik.currentIdentity!.publicKey)}
                    icon={HandPalmIcon}
                    strict={true}
                    text="Cancel Deletion"
                    alertTextTitle="Revoke Deletion Request"
                    descriptionText="This will revoke your approval to delete this thread. The thread will remain active unless all other participants have also approved deletion."
                  />
                )}
              </Controls>
            </div>
          </Row>
        </SectionTitleFrame>
      </Header>
      <SectionSubTitle>
        <Row>
          <ThreadTitle data-private>{thread?.metadata?.subject}</ThreadTitle>
          <ThreadStatus>{thread.status.toUpperCase()}</ThreadStatus>
        </Row>
      </SectionSubTitle>

      <ScrollArea ref={scrollAreaRef} id="section-thread-messages">
        {fetchedMails.length === 0 ? (
          <EmptyState>
            <EmptyStateTitle>No messages</EmptyStateTitle>
            <EmptyStateMessage>This thread has no messages yet.</EmptyStateMessage>
          </EmptyState>
        ) : (
          <>
            <PaginationContainer>
              <PageInfo>
                {fetchedMails.length > 0
                  ? `${startMail}-${endMail} of ${totalMails}`
                  : 'No threads'}
              </PageInfo>
              <PaginationButton
                onClick={handlePreviousPage}
                $disabled={isPreviousDisabled}
                disabled={isPreviousDisabled}
                aria-label="Previous page"
              >
                <CaretLeftIcon size={16} />
              </PaginationButton>
              <PaginationButton
                onClick={handleNextPage}
                $disabled={isNextDisabled}
                disabled={isNextDisabled}
                aria-label="Next page"
              >
                <CaretRightIcon size={16} />
              </PaginationButton>
            </PaginationContainer>
            {fetchedMails.length > 1 && (
              <MailCount>
                {fetchedMails.length} {fetchedMails.length === 1 ? 'message' : 'messages'}
              </MailCount>
            )}
            <MailsList>
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
            </MailsList>
            <PaginationContainer>
              <PageInfo>
                {fetchedMails.length > 0
                  ? `${startMail}-${endMail} of ${totalMails}`
                  : 'No threads'}
              </PageInfo>
              <PaginationButton
                onClick={handlePreviousPage}
                $disabled={isPreviousDisabled}
                disabled={isPreviousDisabled}
                aria-label="Previous page"
              >
                <CaretLeftIcon size={16} />
              </PaginationButton>
              <PaginationButton
                onClick={handleNextPage}
                $disabled={isNextDisabled}
                disabled={isNextDisabled}
                aria-label="Next page"
              >
                <CaretRightIcon size={16} />
              </PaginationButton>
            </PaginationContainer>
          </>
        )}
        <div ref={bottomRef} />
      </ScrollArea>
    </RootContainer>
  )
}

export default ThreadViewer
