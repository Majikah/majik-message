import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import {
  NotePencilIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ArrowClockwiseIcon
} from '@phosphor-icons/react'
import ThreadRow from './ThreadRow'
import {
  MajikMessageThread,
  type MajikContact,
  type MajikMessageThreadID,
  type MajikMessageThreadSummary
} from '@majikah/majik-message'
import { SectionTitleFrame } from '@renderer/globals/styled-components'
import PopUpFormButton from '@renderer/components/foundations/PopUpFormButton'
import UserAuth from '@renderer/components/foundations/UserAuth'
import { useMajikah } from '@renderer/components/majikah-session-wrapper/use-majikah'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'
import { toast } from 'sonner'
import NewThreadForm from './NewThreadForm'
import { isDevEnvironment } from '@renderer/utils/utils'
import StyledIconButton from '@renderer/components/foundations/StyledIconButton'
import DynamicSlidingDialogue from '@renderer/components/functional/DynamicSlidingDialogue'
import ThreadViewer from './ThreadViewer'

const RootContainer = styled.div`
  width: 100%;
  margin: 0 auto;
  border-radius: 8px;
  padding: 8px;
  overflow: hidden;
  gap: 10px;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
const ThreadsList = styled.div`
  width: 100%;
`

const EmptyState = styled.div`
  padding: 60px 20px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
`

const EmptyStateTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0 0 8px 0;
`

const EmptyStateMessage = styled.p`
  font-size: 14px;
  margin: 0;
`

interface EmailThreadsProps {
  majik: MajikMessageDatabase
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void
  onPageChange?: (page: number) => void
  onToggleStar?: (threadId: MajikMessageThreadID) => void
  onToggleRead?: (threadId: MajikMessageThreadID) => void
  onThreadClick?: (threadId: MajikMessageThreadID) => void
}

const EmailThreads: React.FC<EmailThreadsProps> = ({
  majik,
  onPageChange,
  onToggleStar,
  onToggleRead,
  onThreadClick
}) => {
  const { majikah } = useMajikah()

  const [fetchedThreads, setFetchedThreads] = useState<MajikMessageThreadSummary[]>([])
  const [totalThreads, setTotalThreads] = useState<number>(0)

  const [recipients, setRecipients] = useState<MajikContact[]>(() => {
    const myAccount = majik.getActiveAccount()
    if (!myAccount) return []
    return [myAccount]
  })

  const [threadLabel, setThreadLabel] = useState<string | undefined>(undefined)

  const [selectedThread, setSelectedThread] = useState<MajikMessageThread | null>(null)

  const [loading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [allowNextPage, setAllowNextPage] = useState(false)

  const isRefreshingRef = useRef(false)

  const refreshThreads = useCallback(async () => {
    if (!majikah?.isAuthenticated) return

    if (isRefreshingRef.current) return
    isRefreshingRef.current = true

    try {
      setIsLoading(true)
      const fetchResponse = await majik.getThreads()
      const threads = fetchResponse.threads

      setFetchedThreads(threads)

      setTotalThreads(fetchResponse.total_threads)

      setAllowNextPage(fetchResponse.canNextPage)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to refresh threads', { description: error?.message })
      }
    } finally {
      isRefreshingRef.current = false
      setIsLoading(false)
    }
  }, [majik, majikah.isAuthenticated])

  useEffect(() => {
    refreshThreads()
  }, [refreshThreads])

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

  const processCreateThread = async (): Promise<string> => {
    if (isDevEnvironment()) console.log('Creating thread for: ', recipients)

    if (!recipients || recipients.length <= 1) {
      throw new Error('Assign recipients first.')
    }

    const activeAccount = majik.currentIdentity
    if (!activeAccount) {
      throw new Error('No active account found')
    }

    const currentUserPublicKey = activeAccount.publicKey

    const messageRecipients = (
      await Promise.all(
        recipients.filter((r) => r.isMajikahRegistered()).map(async (r) => r.getPublicKeyBase64())
      )
    ).filter((pk) => pk !== currentUserPublicKey)

    if (isDevEnvironment()) console.log('Recipients: ', messageRecipients)

    const createThreadResponse = await majik.createThread(messageRecipients, threadLabel)

    if (
      createThreadResponse !== null &&
      createThreadResponse.success &&
      createThreadResponse.message
    ) {
      refreshThreads()
      return `Thread created successfully! ${createThreadResponse.message}`
    } else {
      return `Oh no... There's a problem while creating the thread.`
    }
  }

  const handleCreateThread = async (): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    if (!recipients || recipients.length <= 1) {
      toast.error('Assign recipients first.')
      return
    }

    toast.promise(processCreateThread(), {
      loading: `Creating thread...`,
      success: (outputMessage) => {
        setTimeout(() => {}, 1000)

        return outputMessage
      },
      error: () => {
        return `Oh no... There's a problem while creating the thread.`
      }
    })
  }

  const handleThreadFormUpdate = (input: MajikContact[], subject?: string): void => {
    setRecipients(input)
    setThreadLabel(subject)
  }

  const processSelectThread = async (threadID: MajikMessageThreadID): Promise<string> => {
    if (isDevEnvironment()) console.log('Loading thread: ', threadID)

    if (!threadID.trim()) {
      throw new Error('Please select a valid thread.')
    }

    const activeAccount = majik.currentIdentity
    if (!activeAccount) {
      throw new Error('No active account found')
    }

    const fetchedThread = await majik.getThread(threadID)

    if (fetchedThread !== null && fetchedThread.thread) {
      const parsedThread = MajikMessageThread.fromJSON(fetchedThread.thread)
      setSelectedThread(parsedThread)
      return `Thread loaded successfully!`
    } else {
      return `Oh no... There's a problem while loading this thread.`
    }
  }

  const handleSelectThread = async (threadID: MajikMessageThreadID): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    if (!threadID.trim()) {
      toast.error('A valid thread ID is required.')
      return
    }

    toast.promise(processSelectThread(threadID), {
      loading: `Loading thread...`,
      success: (outputMessage) => {
        setTimeout(() => {
          onThreadClick?.(threadID)
        }, 1000)

        return outputMessage
      },
      error: () => {
        return `Oh no... There's a problem while loading this thread.`
      }
    })
  }

  const handleCloseThread = (): void => {
    setSelectedThread(null)
  }

  const processDeleteThread = async (thread: MajikMessageThread): Promise<string> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) {
      throw new Error('No active account found')
    }

    if (!thread?.validate()) {
      throw new Error('Invalid thread')
    }

    if (thread.hasDeletionApproval(activeAccount.publicKey)) {
      throw new Error("You've already requested to delete this thread.")
    }

    const deleteResponse = await majik.deleteThread(thread)

    if (deleteResponse !== null && deleteResponse.success) {
      return deleteResponse.message || `Your deletion request has been recorded successfully!`
    } else {
      return `Oh no... There's a problem while requesting to delete this thread.`
    }
  }

  const handleDeleteThread = async (thread: MajikMessageThread): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    if (!thread?.validate()) {
      toast.error('Invalid thread provided.')
      return
    }

    toast.promise(processDeleteThread(thread), {
      loading: `Requesting to delete this thread...`,
      success: (outputMessage) => {
        setTimeout(() => {
          refreshThreads()
        }, 1000)
        handleCloseThread()
        return outputMessage
      },
      error: () => {
        return `Oh no... There's a problem while requesting to delete this thread.`
      }
    })
  }

  const processCancelDeleteThread = async (thread: MajikMessageThread): Promise<string> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) {
      throw new Error('No active account found')
    }

    if (!thread?.validate()) {
      throw new Error('Invalid thread')
    }

    if (!thread.hasDeletionApproval(activeAccount.publicKey)) {
      throw new Error("You haven't requested to delete this thread yet.")
    }

    const deleteResponse = await majik.revokeDeleteThread(thread)

    if (deleteResponse !== null && deleteResponse.success) {
      return deleteResponse.message || `Your deletion request has been revoked successfully!`
    } else {
      return `Oh no... There's a problem while revoking your request to delete this thread.`
    }
  }

  const handleCancelDeleteThread = async (thread: MajikMessageThread): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    if (!thread?.validate()) {
      toast.error('Invalid thread provided.')
      return
    }

    toast.promise(processCancelDeleteThread(thread), {
      loading: `Revoking your request to delete this thread...`,
      success: (outputMessage) => {
        setTimeout(() => {
          refreshThreads()
        }, 1000)
        handleCloseThread()
        return outputMessage
      },
      error: () => {
        return `Oh no... There's a problem while revoking your request to delete this thread.`
      }
    })
  }

  const processDeleteThreadByID = async (threadID: MajikMessageThreadID): Promise<string> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) {
      throw new Error('No active account found')
    }

    if (!threadID?.trim()) {
      throw new Error('Invalid thread ID')
    }

    const deleteResponse = await majik.manageThreadDeletionByID(threadID)

    if (deleteResponse !== null && deleteResponse.success) {
      return deleteResponse.message || `Your deletion request has been recorded successfully!`
    } else {
      return `Oh no... There's a problem while requesting to delete this thread.`
    }
  }

  const handleDeleteThreadByID = async (threadID: MajikMessageThreadID): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    if (!threadID?.trim()) {
      toast.error('Invalid thread ID provided.')
      return
    }

    toast.promise(processDeleteThreadByID(threadID), {
      loading: `Requesting to delete this thread...`,
      success: (outputMessage) => {
        setTimeout(() => {
          refreshThreads()
        }, 1000)
        handleCloseThread()
        return outputMessage
      },
      error: () => {
        return `Oh no... There's a problem while requesting to delete this thread.`
      }
    })
  }

  const processCancelDeleteThreadByID = async (threadID: MajikMessageThreadID): Promise<string> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) {
      throw new Error('No active account found')
    }

    if (!threadID?.trim()) {
      throw new Error('Invalid thread ID')
    }
    const deleteResponse = await majik.manageThreadDeletionByID(threadID, true)

    if (deleteResponse !== null && deleteResponse.success) {
      return deleteResponse.message || `Your deletion request has been revoked successfully!`
    } else {
      return `Oh no... There's a problem while revoking your request to delete this thread.`
    }
  }

  const handleCancelDeleteThreadByID = async (threadID: MajikMessageThreadID): Promise<void> => {
    const activeAccount = majik.currentIdentity
    if (!activeAccount) return

    if (!threadID?.trim()) {
      toast.error('Invalid thread ID provided.')
      return
    }

    toast.promise(processCancelDeleteThreadByID(threadID), {
      loading: `Revoking your request to delete this thread...`,
      success: (outputMessage) => {
        setTimeout(() => {
          refreshThreads()
        }, 1000)
        handleCloseThread()
        return outputMessage
      },
      error: () => {
        return `Oh no... There's a problem while revoking your request to delete this thread.`
      }
    })
  }

  const isPreviousDisabled = page <= 1
  const isNextDisabled = !allowNextPage

  const mailsPerPage = 50 // or your API/page size

  const startThread = totalThreads === 0 ? 0 : (page - 1) * mailsPerPage + 1
  const endThread = Math.min(page * mailsPerPage, totalThreads)

  const isUserRestricted = useMemo(() => {
    return majik?.currentIdentity?.isRestricted() || false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, majik.user?.id, majik.getActiveAccount()?.id])

  if (!majikah?.isAuthenticated) {
    return <UserAuth />
  }

  return (
    <RootContainer>
      <Header>
        <SectionTitleFrame>
          <Row>
            <h2>Threads</h2>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 15 }}>
              <PopUpFormButton
                icon={NotePencilIcon}
                text="New Thread"
                disabled={isUserRestricted}
                modal={{
                  title: 'New Thread',
                  description: 'Create a new thread'
                }}
                buttons={{
                  cancel: {
                    text: 'Cancel'
                  },
                  confirm: {
                    text: 'Create',
                    onClick: handleCreateThread,
                    isDisabled: loading
                  }
                }}
              >
                <NewThreadForm majik={majik} onUpdate={handleThreadFormUpdate} />
              </PopUpFormButton>

              <Controls>
                <StyledIconButton
                  onClick={refreshThreads}
                  aria-label="Reload Threads"
                  icon={ArrowClockwiseIcon}
                  title="Reload Threads"
                  size={25}
                />
              </Controls>
            </div>
          </Row>
        </SectionTitleFrame>
      </Header>

      {fetchedThreads.length > 0 && (
        <PaginationContainer>
          <PageInfo>
            {totalThreads > 0 ? `${startThread}-${endThread} of ${totalThreads}` : 'No threads'}
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
      )}

      <ThreadsList>
        {fetchedThreads.length === 0 ? (
          <EmptyState>
            <EmptyStateTitle>No messages</EmptyStateTitle>
            <EmptyStateMessage>
              Your inbox is empty. New messages will appear here.
            </EmptyStateMessage>
          </EmptyState>
        ) : (
          fetchedThreads.map((thread) => (
            <ThreadRow
              key={thread.id}
              majik={majik}
              thread={thread}
              currentUserPublicKey={majik.currentIdentity!.publicKey}
              onToggleStar={onToggleStar}
              onToggleRead={onToggleRead}
              onClick={() => handleSelectThread(thread.id)}
              onDelete={handleDeleteThreadByID}
              onCancelDelete={handleCancelDeleteThreadByID}
            />
          ))
        )}
      </ThreadsList>
      {fetchedThreads.length > 0 && (
        <PaginationContainer>
          <PageInfo>
            {totalThreads > 0 ? `${startThread}-${endThread} of ${totalThreads}` : 'No threads'}
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
      )}

      <DynamicSlidingDialogue
        scrollable={false}
        isOpen={!!selectedThread?.validate()}
        modal={{
          title: 'View Messages',
          description: 'Read and reply to messages in this thread'
        }}
        buttons={{
          cancel: {
            text: 'Close',
            onClick: handleCloseThread
          },
          confirm: {
            text: 'Save',
            isDisabled: true,
            hide: true
          }
        }}
        onOpenChange={handleCloseThread}
      >
        {selectedThread && (
          <ThreadViewer
            majik={majik}
            thread={selectedThread}
            onDelete={handleDeleteThread}
            onRevokeDelete={handleCancelDeleteThread}
          />
        )}
      </DynamicSlidingDialogue>
    </RootContainer>
  )
}

export default EmailThreads
