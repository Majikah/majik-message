import { MajikMessageChat, type MajikMessagePublicKey } from '@majikah/majik-message'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import styled from 'styled-components'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import { toast } from 'sonner'
import DynamicPlaceholder from '../foundations/DynamicPlaceholder'
import CBaseChatBubble from '../base/CBaseChatBubble'
import { isDevEnvironment } from '@renderer/utils/utils'
import { useMajikMessageRealtime } from '../majikah-session-wrapper/messages/use-majik-message-realtime'
import type { ChatMessagePayload } from '../majikah-session-wrapper/messages/majik-message-realtime'
import { useTypingIndicators } from './TypingIndicator/useTypingIndicator'
import { TypingIndicator } from './TypingIndicator/TypingIndicator'

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
  { insertMessage: (message: MajikMessageChat) => Promise<void> }, // methods exposed to parent
  ConversationMessagesProps
>(({ majik, conversationID }, ref) => {
  const client = useMajikMessageRealtime()

  const bottomRef = useRef<HTMLDivElement | null>(null)

  const [fetchedMessages, setFetchedMessages] = useState<MajikMessageChat[]>([])

  const [senderKey, setSenderKey] = useState<MajikMessagePublicKey | undefined>(undefined)

  const [loading, setIsLoading] = useState(false)

  const { typingUsers, isAnyoneTyping } = useTypingIndicators(client, senderKey)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const markedAsReadRef = useRef<Set<string>>(new Set())

  const displayNamesRef = useRef<Record<string, string>>({})

  const loadInitialMessages = useCallback(async () => {
    try {
      setIsLoading(true)
      const fetchResponse = await majik.getConversationMessages(conversationID)
      const messages = fetchResponse.messages

      if (!messages.length) {
        setFetchedMessages([])

        return
      }

      const parsedMessages = messages
        .map((msg) => MajikMessageChat.fromJSON(msg))
        .sort((a, b) => new Date(a.getTimestamp()).getTime() - new Date(b.getTimestamp()).getTime())

      setFetchedMessages(parsedMessages)

      // setAllowNextPage(messages.length > 0)

      // Scroll after setting messages
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to refresh messages', { description: error?.message })
      }
    } finally {
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

  useEffect(() => {
    loadInitialMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const fetchNames = async (): Promise<void> => {
      const names: Record<string, string> = {}
      if (fetchedMessages.length === 0) return
      const convParticipants = fetchedMessages[0].getParticipants()
      for (const participant of convParticipants) {
        const contactData = await majik.getContactByPublicKey(participant)
        if (contactData) {
          names[participant] = (await contactData.getDisplayName()) || participant
        }
      }
      displayNamesRef.current = names
    }
    fetchNames()
  }, [conversationID, majik, fetchedMessages])

  useEffect(() => {
    if (!client) return

    const handleIncomingMessage = async (payload: ChatMessagePayload): Promise<void> => {
      try {
        if (!payload || !payload.payload) return
        const msg = MajikMessageChat.fromJSON(payload.payload)

        let didInsert = false

        setFetchedMessages((prev) => {
          // Already exists → no insert, no toast
          if (prev.some((m) => m.getID() === msg.getID())) {
            return prev
          }

          didInsert = true

          return [...prev, msg].sort(
            (a, b) => new Date(a.getTimestamp()).getTime() - new Date(b.getTimestamp()).getTime()
          )
        })

        if (!majik.currentIdentity?.publicKey) return

        if (
          didInsert &&
          !msg.isSender(majik.currentIdentity.publicKey) &&
          !msg.hasUserRead(majik.currentIdentity.publicKey)
        ) {
          const senderName = displayNamesRef.current[msg.getSender()]
          toast.success('New Message', {
            description: `You have a new message from ${senderName}`,
            id: `toast-success-message-new-${senderName}`
          })
          window.electron.notify('Majik Message', `You have a new message from ${senderName}`)
        }

        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        })
      } catch (err) {
        console.error('Failed to process realtime message', err)
      }
    }

    client.on('message', handleIncomingMessage)

    client.on('message_deleted', (data) => {
      setFetchedMessages((prev) => prev.filter((msg) => msg.getID() !== data.messageId))

      if (data.deletedBy !== majik.currentIdentity?.publicKey) {
        toast.success('Message Deleted', {
          description: `Message deleted by ${data.deletedBy}`,
          id: `toast-success-message-deleted-${data.messageId}`
        })
      }
    })

    // Listen for users joining
    client.on('user_joined', async (data) => {
      if (data.user !== majik.currentIdentity?.publicKey) {
        const userDisplayName = displayNamesRef.current[data.user]
        console.log(`${data.user} joined the chat`)
        toast.info('User joined the chat', {
          description: `${userDisplayName} joined the chat`,
          id: `toast-success-user-join-${data.user}`
        })
        window.electron.notify('Majik Message', `${data.user} joined the chat`)
      }
    })

    // Listen for users leaving
    client.on('user_left', async (data) => {
      if (data.user !== majik.currentIdentity?.publicKey) {
        const userDisplayName = displayNamesRef.current[data.user]
        console.log(`${data.user} left the chat`)
        toast.info('User went offline', {
          description: `${userDisplayName} left the chat`,
          id: `toast-success-user-left-${data.user}`
        })
        window.electron.notify('Majik Message', `${data.user} left the chat`)
      }
    })

    client.on('error', (data) => {
      const errorMessage = data.message
      console.warn(`Error: ${errorMessage}`)

      // Guard: only handle "Invalid recipients"
      if (errorMessage !== 'Invalid recipients') {
        return
      }

      toast.error('Invalid Recipient', {
        description: `One or more participants in this conversation are no longer registered, so your message couldn’t be delivered.`,
        id: `toast-error-invalid-recipient}`
      })
      window.electron.notify(
        'Majik Message',
        `${errorMessage}: One or more participants in this conversation are no longer registered, so your message couldn’t be delivered.`
      )
    })

    // // Listen for participant list updates
    // client.on('participants', (participants) => {
    //   console.log('Current participants:', participants)
    //   // Update your participant list UI
    // })

    return () => {
      client.off('message', handleIncomingMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  useEffect(() => {
    if (!bottomRef.current) return
    // wait one tick for DOM to render
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [fetchedMessages.length])

  // Setup Intersection Observer
  useEffect(() => {
    if (!client || !senderKey) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // 50% visible
            const messageId = entry.target.getAttribute('data-message-id')
            if (!messageId) return

            // Only mark once per message
            if (markedAsReadRef.current.has(messageId)) return

            const message = fetchedMessages.find((m) => m.getID() === messageId)
            if (!message) return

            // Don't mark own messages as read
            if (message.isSender(senderKey)) return

            if (message.isReadByAll()) return

            if (message.hasUserRead(senderKey)) return

            // Check if tab is focused (optional but recommended)
            if (!document.hasFocus()) return

            // Optional: Add delay to ensure user actually saw it
            setTimeout(() => {
              if (entry.isIntersecting) {
                // Still visible after delay
                client.markRead(messageId)

                markedAsReadRef.current.add(messageId)

                if (isDevEnvironment()) {
                  console.log('Marked as read:', messageId)
                }
              }
            }, 1500) // 1.5 second delay
          }
        })
      },
      {
        root: null, // viewport
        threshold: 0.5, // 50% of message must be visible
        rootMargin: '0px'
      }
    )

    // Observe all current messages
    messageRefsMap.current.forEach((element) => {
      if (element) observerRef.current?.observe(element)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [client, senderKey, fetchedMessages])

  // Callback ref for messages
  const setMessageRef = useCallback((messageId: string) => {
    return (element: HTMLDivElement | null) => {
      if (element) {
        messageRefsMap.current.set(messageId, element)
        observerRef.current?.observe(element)
      } else {
        const existing = messageRefsMap.current.get(messageId)
        if (existing) {
          observerRef.current?.unobserve(existing)
          messageRefsMap.current.delete(messageId)
        }
      }
    }
  }, [])

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

    client.deleteMessage(message.getID(), message.getRedisKey())

    return `Message deleted successfully!`
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
          setFetchedMessages((prev) => prev.filter((m) => m.getID() !== message.getID()))
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

  const insertMessage = useCallback(async (message: MajikMessageChat): Promise<void> => {
    if (!message) return

    setFetchedMessages((prev) => {
      // Prevent duplicates
      if (prev.some((m) => m.getID() === message.getID())) {
        return prev
      }

      const newMessages = [...prev, message].sort(
        (a, b) => new Date(a.getTimestamp()).getTime() - new Date(b.getTimestamp()).getTime()
      )

      // Scroll to bottom after DOM updates
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })

      return newMessages
    })
  }, [])

  // Expose refreshMessages to parent via ref
  useImperativeHandle(ref, () => ({
    insertMessage
  }))

  function useNow(interval = 1000): number {
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
      const id = setInterval(() => setNow(Date.now()), interval)
      return () => clearInterval(id)
    }, [interval])

    return now
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
            <div key={msg.getID()} ref={setMessageRef(msg.getID())} data-message-id={msg.getID()}>
              <CBaseChatBubble
                key={msg.getID()}
                message={msg}
                isOwn={isOwn}
                majik={majik}
                now={now}
                canDelete={isOwn}
                onDelete={handleDelete}
              />
            </div>
          )
        })}
        {isAnyoneTyping && (
          <TypingIndicator typingPublicKeys={typingUsers.map((u) => u.publicKey)} majik={majik} />
        )}
        <div ref={bottomRef} />
      </ScrollArea>
    </Root>
  )
})

ConversationMessages.displayName = 'ConversationMessages'
