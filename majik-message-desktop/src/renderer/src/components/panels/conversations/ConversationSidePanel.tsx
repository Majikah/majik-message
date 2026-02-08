/* eslint-disable @typescript-eslint/no-explicit-any */

import DynamicPlaceholder from '@/components/foundations/DynamicPlaceholder'
import { ButtonPrimaryConfirm } from '@/globals/buttons'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

import type { ConversationSummary } from '@renderer/components/majikah-session-wrapper/api-types'

import { CBaseConversation } from '@renderer/components/base/CBaseConversation'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'
import { SectionTitleFrame } from '@renderer/globals/styled-components'
import { toast } from 'sonner'
import { MajikMessageIdentitySelector } from '@renderer/components/MajikMessageIdentitySelector'

import { MajikMessageChat } from '@majikah/majik-message'
import { NotePencilIcon } from '@phosphor-icons/react'
import PopUpFormButton from '@renderer/components/foundations/PopUpFormButton'
import NewMessageForm from '@renderer/components/NewMessageForm'
import { useMajikah } from '@renderer/components/majikah-session-wrapper/use-majikah'
import UserAuth from '@renderer/components/foundations/UserAuth'

import { MajikMessageRealtimeChatClientProvider } from '@renderer/components/majikah-session-wrapper/messages/MajikMessageRealtimeChatClientProvider'
import { ConversationMessages } from '@renderer/components/functional/ConversationMessages'
import { RealtimeChatInput } from '@renderer/components/functional/RealtimeChatInput'

// Styled Components
const RootContainer = styled.div`
  display: flex;
  flex: 1; 
  min-height:
  overflow: hidden;
  height: 100%;
`

const LeftPane = styled.div`
  width: 40%;

  display: flex;
  flex-direction: column;
  flex: none;
  min-height: 0;
  padding: 0px 10px;
  margin-right: 10px;
`

const RightPane = styled.div`
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  border-left: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`
const ListWrapper = styled.div`
  flex: 1;
  min-height: 0; /* 🔑 THIS WAS MISSING */
  overflow-y: auto;
  padding: 1rem 1rem 150px 1rem;
`

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0.5em;
  background-color: transparent;
  color: ${({ theme }) => theme.colors.textPrimary};
  height: auto;
  padding-bottom: 150px;

  width: 100%;
  overflow-y: auto;
  align-items: center;
  gap: 10px;
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
  @media (max-width: 768px) {
    padding: 5px;
  }
`

const ItemColumnContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 15px;
  width: 100%;
`

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`

interface ConversationSidePanelProps {
  majik: MajikMessageDatabase
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void
}

// Main Component
const ConversationSidePanel: React.FC<ConversationSidePanelProps> = ({ majik }) => {
  const { majikah } = useMajikah()

  const [fetchedConversations, setFetchedConversations] = useState<ConversationSummary[]>([])

  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | undefined>(
    undefined
  )

  const [loading, setIsLoading] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [allowNextPage] = useState(false)

  const isRefreshingRef = useRef(false)

  const [newMessageText, setNewMessageText] = useState<string>('')

  const [isCreatingMessage, setIsCreatingMessage] = useState<boolean>(false)

  const messagesRef = useRef<{ insertMessage: (message: MajikMessageChat) => Promise<void> }>(null)

  const refreshConversations = useCallback(async () => {
    if (!majikah?.isAuthenticated) return

    if (isRefreshingRef.current) return
    isRefreshingRef.current = true

    try {
      setIsLoading(true)
      const fetchResponse = await majik.getConversations()
      const conversations = fetchResponse.conversations

      setFetchedConversations(conversations)
      setSelectedConversation(conversations[0])
      // setAllowNextPage(conversations.length > 0)
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to refresh conversations', { description: error?.message })
      }
    } finally {
      isRefreshingRef.current = false
      setIsLoading(false)
      setIsCreatingMessage(false)
    }
  }, [majik, majikah.isAuthenticated])

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  const handleSelectConversation = (input: ConversationSummary): void => {
    if (!!input && !!input?.conversation_id) {
      setSelectedConversation(input)
    }
  }

  const handlePageLoadMore = (): void => {
    setPageIndex(pageIndex + 1)
  }

  const handleMessageTextUpdate = (text: string): void => {
    setNewMessageText(text || '')
  }

  const isUserRestricted = useMemo(() => {
    return majik?.currentIdentity?.isRestricted() || false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, majik.user?.id, majik.getActiveAccount()?.id])

  if (!majikah?.isAuthenticated) {
    return <UserAuth />
  }

  return (
    <RootContainer>
      <LeftPane>
        <SectionTitleFrame>
          <Row>
            <h2>Chats</h2>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <PopUpFormButton
                icon={NotePencilIcon}
                text="New Message"
                disabled={isUserRestricted}
                modal={{
                  title: 'New Message',
                  description: 'Send a new message to your contacts.'
                }}
                buttons={{
                  cancel: {
                    text: 'Cancel'
                  },
                  confirm: {
                    text: 'Send',
                    isDisabled: !newMessageText?.trim(),
                    hide: true
                  }
                }}
                isOpen={isCreatingMessage}
                onOpenChange={(open) => setIsCreatingMessage(open)}
              >
                <NewMessageForm
                  majik={majik}
                  onSend={refreshConversations}
                  onUpdate={handleMessageTextUpdate}
                />
              </PopUpFormButton>

              {/* <PopUpFormButton scrollable={true} icon={PlusIcon} text="Create Account">
               <></>
             </PopUpFormButton> */}
            </div>
          </Row>
        </SectionTitleFrame>
        <MajikMessageIdentitySelector onChange={refreshConversations} />
        <ListWrapper>
          {!loading ? (
            <ListContainer className="rootListConversations">
              {fetchedConversations.length > 0 ? (
                fetchedConversations.map((conversationItem, index) => (
                  <ItemColumnContainer key={conversationItem.conversation_id || index}>
                    <CBaseConversation
                      majik={majik}
                      conversation={conversationItem}
                      onClick={handleSelectConversation}
                      isActive={
                        selectedConversation
                          ? conversationItem.conversation_id ===
                            selectedConversation.conversation_id
                          : false
                      }
                    />

                    {index === fetchedConversations.length - 1 && allowNextPage ? (
                      <ButtonPrimaryConfirm onClick={handlePageLoadMore} disabled={!allowNextPage}>
                        Load more
                      </ButtonPrimaryConfirm>
                    ) : null}
                  </ItemColumnContainer>
                ))
              ) : (
                <DynamicPlaceholder>No conversations found.</DynamicPlaceholder>
              )}
            </ListContainer>
          ) : (
            <DynamicPlaceholder loading={loading}>Loading...</DynamicPlaceholder>
          )}
        </ListWrapper>
      </LeftPane>
      <RightPane>
        {selectedConversation ? (
          <ChatContainer>
            <MajikMessageRealtimeChatClientProvider
              conversationID={selectedConversation.conversation_id}
              account={majik.currentIdentity!}
            >
              <ConversationMessages
                conversationID={selectedConversation.conversation_id}
                majik={majik}
                ref={messagesRef}
              />
              <RealtimeChatInput
                majik={majik}
                conversationID={selectedConversation.conversation_id}
                participants={selectedConversation.participants}
              />
            </MajikMessageRealtimeChatClientProvider>
          </ChatContainer>
        ) : (
          <DynamicPlaceholder>Select a conversation to view messages.</DynamicPlaceholder>
        )}
      </RightPane>
    </RootContainer>
  )
}

export default ConversationSidePanel
