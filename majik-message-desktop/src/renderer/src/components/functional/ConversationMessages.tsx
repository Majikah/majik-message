import { MajikMessageChat, type MajikMessagePublicKey } from '@majikah/majik-message'
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
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

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── useNow — OUTSIDE the component ──────────────────────────────────────────
/**
 * CRITICAL: This hook must live outside ConversationMessages.
 *
 * When defined inside the component, every setNow() tick triggers a full
 * re-render of ConversationMessages, which rebuilds the fetchedMessages.map()
 * and passes new JSX / prop objects to every CBaseChatBubble. Even with stable
 * `key` props, the `message` prop object reference changes, which caused the
 * isMounted ref to reset mid-flight in the decrypt effect.
 *
 * Defined outside, useNow() re-renders only the component that calls it.
 * CBaseChatBubble receives `now` as a prop, but since it's a primitive number
 * and the bubble is memoized (see MemoizedBubble below), it only re-renders
 * when `now` actually matters for expiry display — not every tick.
 */
function useNow(interval = 1000): number {
  // eslint-disable-next-line react-hooks/purity
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}

// ─── Styled components ────────────────────────────────────────────────────────

const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
`

const ScrollArea = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.secondaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`

// ─── Date separator ───────────────────────────────────────────────────────────
/**
 * Mono label between day groups — gives the message stream a clear
 * temporal structure without heavy visual weight.
 */
const DateSeparator = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 6px;
`

const SepLine = styled.div`
  flex: 1;
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`

const SepLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  white-space: nowrap;
`

// ─── Memoized bubble wrapper ──────────────────────────────────────────────────
const MemoizedBubble = memo(CBaseChatBubble, (prev, next) => {
  if (prev.message.getID() !== next.message.getID()) return false
  if (prev.isOwn !== next.isOwn) return false
  if (prev.majik !== next.majik) return false
  if (prev.canDelete !== next.canDelete) return false
  // Only re-render for now changes if message has an expiry
  if (prev.message.getExpiresAt() && prev.now !== next.now) return false
  return true
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationMessagesProps {
  majik: MajikMessageDatabase
  conversationID: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ConversationMessages = forwardRef<
  { insertMessage: (message: MajikMessageChat) => Promise<void> },
  ConversationMessagesProps
>(({ majik, conversationID }, ref) => {
  const client = useMajikMessageRealtime()
  const now = useNow(1000)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [fetchedMessages, setFetchedMessages] = useState<MajikMessageChat[]>([])
  const [senderKey, setSenderKey] = useState<MajikMessagePublicKey | undefined>(undefined)
  const [loading, setIsLoading] = useState(false)

  const { typingUsers, isAnyoneTyping } = useTypingIndicators(client, senderKey)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const markedAsReadRef = useRef<Set<string>>(new Set())
  const displayNamesRef = useRef<Record<string, string>>({})

  // ── Load messages ──────────────────────────────────────────────────────────
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

      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to refresh messages', {
          description: error?.message
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [conversationID, majik])

  // ── Resolve sender key ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const resolveSenderPublicKey = async (): Promise<void> => {
      try {
        const activeAccount = majik.getActiveAccount()
        if (!activeAccount) return
        const activeKey = await activeAccount.getPublicKeyBase64()
        if (!cancelled) setSenderKey(activeKey)
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

  // ── Resolve display names ──────────────────────────────────────────────────
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

  // ── Realtime event handlers ────────────────────────────────────────────────
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

        window.electron.notify('Majik Message', `Message deleted by ${data.deletedBy}`)
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
    return () => {
      client.off('message', handleIncomingMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    if (!bottomRef.current) return
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [fetchedMessages.length])

  // ── Intersection observer (mark as read) ──────────────────────────────────
  useEffect(() => {
    if (!client || !senderKey) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return

          const messageId = entry.target.getAttribute('data-message-id')
          if (!messageId) return
          if (markedAsReadRef.current.has(messageId)) return

          const message = fetchedMessages.find((m) => m.getID() === messageId)
          if (!message) return
          if (message.isSender(senderKey)) return
          if (message.isReadByAll()) return
          if (message.hasUserRead(senderKey)) return
          if (!document.hasFocus()) return

          setTimeout(() => {
            if (entry.isIntersecting) {
              client.markRead(messageId)
              markedAsReadRef.current.add(messageId)
              if (isDevEnvironment()) console.log('Marked as read:', messageId)
            }
          }, 1500)
        })
      },
      { root: null, threshold: 0.5, rootMargin: '0px' }
    )

    messageRefsMap.current.forEach((element) => {
      if (element) observerRef.current?.observe(element)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [client, senderKey, fetchedMessages])

  useEffect(() => {
    console.log('ConversationMessages mounted')
    return () => console.log('ConversationMessages unmounted')
  }, [])

  // ── Callback ref for message elements ─────────────────────────────────────
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

  // ── Delete ─────────────────────────────────────────────────────────────────
  const processDelete = async (
    senderPublicKey: MajikMessagePublicKey,
    message: MajikMessageChat
  ): Promise<string> => {
    if (!senderPublicKey?.trim()) throw new Error('A valid sender public key is required.')
    if (!message) throw new Error('A valid message is required.')
    if (!message.isSender(senderPublicKey))
      throw new Error('You are not allowed to delete this message.')

    setIsLoading(true)
    client.deleteMessage(message.getID(), message.getRedisKey())
    return 'Message deleted successfully!'
  }

  const handleDelete = async (message: MajikMessageChat): Promise<void> => {
    const activeAccount = majik.getActiveAccount()
    if (!activeAccount || !message) return
    const currentUserPublicKey = await activeAccount.getPublicKeyBase64()

    toast.promise(processDelete(currentUserPublicKey, message), {
      loading: 'Deleting message...',
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

  // ── Insert message (exposed via ref) ──────────────────────────────────────
  const insertMessage = useCallback(async (message: MajikMessageChat): Promise<void> => {
    if (!message) return
    setFetchedMessages((prev) => {
      if (prev.some((m) => m.getID() === message.getID())) return prev
      const newMessages = [...prev, message].sort(
        (a, b) => new Date(a.getTimestamp()).getTime() - new Date(b.getTimestamp()).getTime()
      )
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
      return newMessages
    })
  }, [])

  useImperativeHandle(ref, () => ({ insertMessage }))

  // ── Date separator helper ──────────────────────────────────────────────────
  const getDateLabel = (ts: string): string => {
    const d = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root>
      <ScrollArea>
        {/* 1. Only show the full-screen loader if we have NO messages at all */}
        {loading && fetchedMessages.length === 0 ? (
          <DynamicPlaceholder loading>Loading messages…</DynamicPlaceholder>
        ) : (
          <>
            {/* 2. Optional: A small, non-intrusive loader at the top if you are refreshing */}
            {loading && fetchedMessages.length > 0 && (
              <div style={{ opacity: 0.5, fontSize: '10px', textAlign: 'center' }}>Updating...</div>
            )}

            {fetchedMessages.map((msg, index) => {
              const isOwn = msg.isSender(senderKey!) // Added ! because we check length above
              const prevMsg = index > 0 ? fetchedMessages[index - 1] : null
              const showSeparator =
                !prevMsg ||
                getDateLabel(msg.getTimestamp()) !== getDateLabel(prevMsg.getTimestamp())

              return (
                <div
                  key={msg.getID()}
                  ref={setMessageRef(msg.getID())}
                  data-message-id={msg.getID()}
                >
                  {showSeparator && (
                    <DateSeparator>
                      <SepLine />
                      <SepLabel>{getDateLabel(msg.getTimestamp())}</SepLabel>
                      <SepLine />
                    </DateSeparator>
                  )}
                  <MemoizedBubble
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
          </>
        )}
        {isAnyoneTyping && (
          <TypingIndicator typingPublicKeys={typingUsers.map((u) => u.publicKey)} majik={majik} />
        )}

        <div ref={bottomRef} />
      </ScrollArea>
    </Root>
  )
})

ConversationMessages.displayName = 'ConversationMessages'
