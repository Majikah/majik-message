/* eslint-disable @typescript-eslint/no-explicit-any */

import { MajikMessageChat, type MajikMessagePublicKey } from '@majikah/majik-message'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import styled from 'styled-components'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import { toast } from 'sonner'
import DynamicPlaceholder from '../foundations/DynamicPlaceholder'
import CBaseChatBubble from '../base/CBaseChatBubble'
import { isDevEnvironment } from '@renderer/utils/utils'

/* ======================================================
 * Root Container
 * ====================================================== */

const Root = styled.div`
  width: 100%;
  height: 100%;
  max-height: 80dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
`

const ScrollArea = styled.div`
  flex: 1 1 auto;
  min-height: 0; /* ensures flex container can shrink */
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;

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

/* ======================================================
 * Types
 * ====================================================== */

interface ConversationMessagesProps {
  majik: MajikMessageDatabase
  conversationID: string
}

/* ======================================================
 * Main Conversation Component
 * ====================================================== */

export const ConversationMessages = forwardRef<
  { refreshMessages: () => Promise<void> }, // methods exposed to parent
  ConversationMessagesProps
>(({ majik, conversationID }, ref) => {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const [fetchedMessages, setFetchedMessages] = useState<MajikMessageChat[]>([])

  const [, setSelectedMessage] = useState<MajikMessageChat | undefined>(undefined)

  const [senderKey, setSenderKey] = useState<MajikMessagePublicKey | undefined>(undefined)

  const [loading, setIsLoading] = useState(false)

  const isRefreshingRef = useRef(false)

  const refreshMessages = useCallback(async () => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true

    try {
      setIsLoading(true)
      const fetchResponse = await majik.getConversationMessages(conversationID)
      const messages = fetchResponse.messages

      if (!messages.length) {
        setFetchedMessages([])
        setSelectedMessage(undefined)
        return
      }

      const parsedMessages = messages
        .map((msg) => MajikMessageChat.fromJSON(msg))
        .sort((a, b) => new Date(a.getTimestamp()).getTime() - new Date(b.getTimestamp()).getTime())

      setFetchedMessages(parsedMessages)
      setSelectedMessage(parsedMessages[0])
      // setAllowNextPage(messages.length > 0)

      // Scroll after setting messages
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to refresh messages', { description: error?.message })
      }
    } finally {
      isRefreshingRef.current = false
      setIsLoading(false)
    }
  }, [conversationID, majik])

  useEffect(() => {
    let cancelled = false

    const resolveSenderPublicKey = async (): Promise<void> => {
      try {
        const activeAccount = majik.getActiveAccount()

        if (!activeAccount) return
        const activeKey = await activeAccount.getPublicKeyBase64()

        if (!cancelled) {
          setSenderKey(activeKey)
        }
      } catch (err) {
        console.error('Failed to resolve sender public key', err)
      }
    }

    resolveSenderPublicKey()

    return () => {
      cancelled = true
    }
  }, [majik])

  // Expose refreshMessages to parent via ref
  useImperativeHandle(ref, () => ({
    refreshMessages
  }))

  useEffect(() => {
    refreshMessages()
  }, [refreshMessages])

  function useNow(interval = 1000): number {
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
      const id = setInterval(() => setNow(Date.now()), interval)
      return () => clearInterval(id)
    }, [interval])

    return now
  }

  useEffect(() => {
    if (!bottomRef.current) return
    // wait one tick for DOM to render
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [fetchedMessages.length])

  const processDelete = async (
    senderPublicKey: MajikMessagePublicKey,
    message: MajikMessageChat
  ): Promise<string> => {
    if (isDevEnvironment()) console.log('Deleting message from: ', message.getID())

    if (!senderPublicKey?.trim()) {
      throw new Error('A valid sender public key is required.')
    }

    if (!message) {
      throw new Error('A valid message is required.')
    }

    if (!message.isSender(senderPublicKey)) {
      throw new Error('You are not allowed to delete this message.')
    }

    setIsLoading(true)

    const deleteMessageResponse = await majik.deleteMessage(message)

    if (
      deleteMessageResponse !== null &&
      deleteMessageResponse.deleted &&
      deleteMessageResponse.message
    ) {
      return `Message deleted successfully! ${deleteMessageResponse.message}`
    } else {
      return `Oh no... There's a problem while sending the message.`
    }
  }

  const handleDelete = async (message: MajikMessageChat): Promise<void> => {
    const activeAccount = majik.getActiveAccount()
    if (!activeAccount) return

    const currentUserPublicKey = await activeAccount.getPublicKeyBase64()

    if (!message) return

    toast.promise(processDelete(currentUserPublicKey, message), {
      loading: `Deleting message...`,
      success: (outputMessage) => {
        setTimeout(() => {
          refreshMessages()
          setIsLoading(false)
        }, 1000)

        return outputMessage
      },
      error: (error) => {
        setIsLoading(false)
        return `${error.message}`
      }
    })
  }

  const now = useNow(1000)

  if (!senderKey || loading) {
    return (
      <>
        <DynamicPlaceholder loading>Loading...</DynamicPlaceholder>
      </>
    )
  }

  return (
    <Root>
      <ScrollArea>
        {fetchedMessages.map((msg) => {
          const isOwn = msg.isSender(senderKey)

          return (
            <CBaseChatBubble
              key={msg.getID()}
              message={msg}
              isOwn={isOwn}
              majik={majik}
              now={now}
              canDelete={isOwn}
              onDelete={handleDelete}
            />
          )
        })}
        <div ref={bottomRef} />
      </ScrollArea>
    </Root>
  )
})

ConversationMessages.displayName = 'ConversationMessages'
