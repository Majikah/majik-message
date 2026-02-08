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

const RootContainer = styled.div`
  width: 100%;
  margin: 0 auto;
  border-radius: 8px;
  padding: 8px;
  overflow: hidden;
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
`

const PageInfo = styled.span`
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
`

const PaginationButton = styled.button<{ $disabled?: boolean }>`
  background: none;
  border: 1px solid ${(props) => (props.$disabled ? '#e5e7eb' : '#d1d5db')};
  padding: 6px;
  cursor: ${(props) => (props.$disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => (props.$disabled ? '#d1d5db' : '#374151')};
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${(props) => (props.$disabled ? 'transparent' : '#f3f4f6')};
    border-color: ${(props) => (props.$disabled ? '#e5e7eb' : '#9ca3af')};
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
  onDelete?: (threadId: MajikMessageThreadID) => void
  onToggleRead?: (threadId: MajikMessageThreadID) => void
  onThreadClick?: (threadId: MajikMessageThreadID) => void
}

const EmailThreads: React.FC<EmailThreadsProps> = ({
  majik,
  onPageChange,
  onToggleStar,
  onDelete,
  onToggleRead,
  onThreadClick
}) => {
  const { majikah } = useMajikah()

  const [fetchedThreads, setFetchedThreads] = useState<MajikMessageThreadSummary[]>([])

  const [recipients, setRecipients] = useState<MajikContact[]>(() => {
    const myAccount = majik.getActiveAccount()
    if (!myAccount) return []
    return [myAccount]
  })

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

    const createThreadResponse = await majik.createThread(messageRecipients)

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

  const handleRecipientsUpdate = (input: MajikContact[]): void => {
    setRecipients(input)
  }

  const isPreviousDisabled = page <= 1
  const isNextDisabled = !allowNextPage

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
                <NewThreadForm majik={majik} onUpdate={handleRecipientsUpdate} />
              </PopUpFormButton>

              <Controls>
                <StyledIconButton
                  onClick={refreshThreads}
                  aria-label="Reload Threads"
                  icon={ArrowClockwiseIcon}
                  title="Reload Threads"
                  size={25}
                />

                <PaginationContainer>
                  <PageInfo>
                    {/* {totalThreads > 0 ? `${startThread}-${endThread} of ${totalThreads}` : 'No threads'} */}
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
              </Controls>
            </div>
          </Row>
        </SectionTitleFrame>
      </Header>

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
              onDelete={onDelete}
              onToggleRead={onToggleRead}
              onClick={onThreadClick}
            />
          ))
        )}
      </ThreadsList>
    </RootContainer>
  )
}

export default EmailThreads
