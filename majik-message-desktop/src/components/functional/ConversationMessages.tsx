import {
  MajikMessageChat,
  type MajikMessagePublicKey,
} from "@majikah/majik-message";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import styled, { css, keyframes } from "styled-components";
import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import { toast } from "sonner";
import DynamicPlaceholder from "../foundations/DynamicPlaceholder";
import CBaseChatBubble from "../base/CBaseChatBubble";
import { isDevEnvironment } from "@/utils/utils";
import { useMajikMessageRealtime } from "../majikah-session-wrapper/messages/use-majik-message-realtime";
import type { ChatMessagePayload } from "../majikah-session-wrapper/messages/majik-message-realtime";
import { useTypingIndicators } from "./TypingIndicator/useTypingIndicator";
import { TypingIndicator } from "./TypingIndicator/TypingIndicator";
import { sendNotification } from "@tauri-apps/plugin-notification";
import {
  AddressBookIcon,
  UserCirclePlusIcon,
  UsersThreeIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import DynamicSlidingDialogue from "./DynamicSlidingDialogue";
import UserContactInvitations from "./UserContactInvitations";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── useNow — OUTSIDE the component ──────────────────────────────────────────
function useNow(interval = 1000): number {
  // eslint-disable-next-line react-hooks/purity
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

// ─── Styled components ────────────────────────────────────────────────────────

const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
`;

const ScrollArea = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.colors.secondaryBackground} transparent`};

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
`;

// ─── Date separator ───────────────────────────────────────────────────────────
const DateSeparator = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 6px;
`;

const SepLine = styled.div`
  flex: 1;
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const SepLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  white-space: nowrap;
`;

// ─── Missing contacts banner ──────────────────────────────────────────────────

const bannerIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Banner = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.07);
  border-bottom: 1px solid rgba(245, 158, 11, 0.18);
  animation: ${bannerIn} 200ms cubic-bezier(0.4, 0, 0.2, 1) both;
`;

const BannerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f59e0b;
`;

const BannerIcon = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
`;

const BannerTitle = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #f59e0b;
`;

const BannerBody = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.8;
`;

const BannerActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const bannerBtnBase = css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 8px;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 120ms ease,
    opacity 120ms ease,
    transform 80ms ease;
  white-space: nowrap;

  &:hover {
    opacity: 0.85;
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
`;

const BannerBtnPrimary = styled.button`
  ${bannerBtnBase}
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
  color: #f59e0b;
`;

const BannerBtnSecondary = styled.button`
  ${bannerBtnBase}
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-color: rgba(255, 255, 255, 0.07);
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const BannerChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const ContactChip = styled.button`
  ${bannerBtnBase}
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  font-size: 9px;
  padding: 3px 9px;
`;

// ─── Memoized bubble wrapper ──────────────────────────────────────────────────
const MemoizedBubble = memo(CBaseChatBubble, (prev, next) => {
  if (prev.message.getID() !== next.message.getID()) return false;
  if (prev.isOwn !== next.isOwn) return false;
  if (prev.majik !== next.majik) return false;
  if (prev.canDelete !== next.canDelete) return false;
  if (prev.message.getExpiresAt() && prev.now !== next.now) return false;
  return true;
});

// ─── Missing contacts banner component ───────────────────────────────────────

interface MissingContactsBannerProps {
  missingKeys: string[];
  /** Called when user requests a single contact's card by their public key. */
  onRequestContact: (publicKey: string) => void;
  /** Called when user requests all missing contacts at once. */
  onRequestAll: () => void;
  /** Called when user wants to view their pending invitations/requests. */
  onViewInvitations: () => void;
}

const MissingContactsBanner: React.FC<MissingContactsBannerProps> = ({
  missingKeys,
  onRequestContact,
  onRequestAll,
  onViewInvitations,
}) => {
  const count = missingKeys.length;

  // Abbreviate a public key for display: first 6 … last 4
  const abbrev = (key: string): string =>
    key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : key;

  return (
    <Banner>
      <BannerHeader>
        <BannerIcon>
          <WarningIcon size={14} weight="fill" />
        </BannerIcon>
        <BannerTitle>
          {count === 1
            ? "1 participant not in your directory"
            : `${count} participants not in your directory`}
        </BannerTitle>
      </BannerHeader>

      <BannerBody>
        {count === 1
          ? "One participant in this conversation isn't saved in your contact directory. You can request their contact card, or check your pending invitations."
          : "Some participants in this conversation aren't in your contact directory. Request their contact cards individually, or send a request to everyone at once."}
      </BannerBody>

      {/* Per-contact request chips — only shown when there are multiple missing */}
      {count > 1 && (
        <BannerChipRow>
          {missingKeys.map((key) => (
            <ContactChip
              key={key}
              type="button"
              title={`Request contact card from ${key}`}
              onClick={() => onRequestContact(key)}
            >
              <UserCirclePlusIcon size={10} weight="bold" />
              {abbrev(key)}
            </ContactChip>
          ))}
        </BannerChipRow>
      )}

      <BannerActions>
        {count === 1 ? (
          <BannerBtnPrimary
            type="button"
            onClick={() => onRequestContact(missingKeys[0])}
          >
            <UserCirclePlusIcon size={11} weight="bold" />
            Request Contact
          </BannerBtnPrimary>
        ) : (
          <BannerBtnPrimary type="button" onClick={onRequestAll}>
            <UsersThreeIcon size={11} weight="bold" />
            Request All
          </BannerBtnPrimary>
        )}

        <BannerBtnSecondary type="button" onClick={onViewInvitations}>
          <AddressBookIcon size={11} weight="bold" />
          View Invitations
        </BannerBtnSecondary>
      </BannerActions>
    </Banner>
  );
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationMessagesProps {
  majik: MajikMessageDatabase;
  conversationID: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ConversationMessages = forwardRef<
  { insertMessage: (message: MajikMessageChat) => Promise<void> },
  ConversationMessagesProps
>(({ majik, conversationID }, ref) => {
  const client = useMajikMessageRealtime();
  const now = useNow(1000);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [fetchedMessages, setFetchedMessages] = useState<MajikMessageChat[]>(
    [],
  );
  const [senderKey, setSenderKey] = useState<MajikMessagePublicKey | undefined>(
    undefined,
  );
  const [loading, setIsLoading] = useState(false);

  // ── Missing contacts state ─────────────────────────────────────────────────
  const [missingContactKeys, setMissingContactKeys] = useState<string[]>([]);

  const { typingUsers, isAnyoneTyping } = useTypingIndicators(
    client,
    senderKey,
  );

  const observerRef = useRef<IntersectionObserver | null>(null);
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const markedAsReadRef = useRef<Set<string>>(new Set());
  const displayNamesRef = useRef<Record<string, string>>({});

  const [invitationsOpen, setInvitationsOpen] = useState<boolean>(false);

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadInitialMessages = useCallback(async () => {
    try {
      setFetchedMessages([]);
      markedAsReadRef.current.clear();
      setIsLoading(true);
      const fetchResponse = await majik.getConversationMessages(conversationID);
      const messages = fetchResponse.messages;

      if (!messages.length) {
        setFetchedMessages([]);
        return;
      }

      const parsedMessages = messages
        .map((msg) => MajikMessageChat.fromJSON(msg))
        .sort(
          (a, b) =>
            new Date(a.getTimestamp()).getTime() -
            new Date(b.getTimestamp()).getTime(),
        );

      setFetchedMessages(parsedMessages);

      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast.error("Failed to refresh messages", {
          description: error?.message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [conversationID, majik]);

  // ── Reset messages when conversation changes ───────────────────────────────
  useEffect(() => {
    setFetchedMessages([]);
    markedAsReadRef.current.clear();
    loadInitialMessages();
  }, [conversationID, loadInitialMessages]);

  // ── Resolve sender key ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const resolveSenderPublicKey = async (): Promise<void> => {
      try {
        const activeAccount = majik.getActiveAccount();
        if (!activeAccount) return;
        const activeKey = await activeAccount.getPublicKeyBase64();
        if (!cancelled) setSenderKey(activeKey);
      } catch (err) {
        console.error("Failed to resolve sender public key", err);
      }
    };
    resolveSenderPublicKey();
    return () => {
      cancelled = true;
    };
  }, [majik]);

  useEffect(() => {
    loadInitialMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resolve display names ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchNames = async (): Promise<void> => {
      const names: Record<string, string> = {};
      if (fetchedMessages.length === 0) return;
      const convParticipants = fetchedMessages[0].getParticipants();
      for (const participant of convParticipants) {
        const contactData = await majik.getContactByPublicKey(participant);
        if (contactData) {
          names[participant] =
            (await contactData.getDisplayName()) || participant;
        }
      }
      displayNamesRef.current = names;
    };
    fetchNames();
  }, [conversationID, majik, fetchedMessages]);

  // ── Check for missing contacts ─────────────────────────────────────────────
  /**
   * Runs whenever the message list updates (new messages may reveal new
   * participants) or when the conversation changes. Excludes the current
   * user's own key so we never prompt them to add themselves.
   */
  useEffect(() => {
    if (fetchedMessages.length === 0) return;

    const checkMissingContacts = async () => {
      const participants = fetchedMessages[0].getParticipants();
      const currentKey = senderKey;

      // Map each participant to a boolean indicating if they're missing
      const missingFlags = await Promise.all(
        participants.map(async (participant) => {
          if (currentKey && participant === currentKey) return false;
          try {
            const hasContact =
              await majik.hasContactByPublicKeyBase64(participant);
            return !hasContact;
          } catch {
            return false;
          }
        }),
      );

      // Filter participants based on the missingFlags
      const missing = participants.filter((_, index) => missingFlags[index]);
      setMissingContactKeys(missing);
    };

    checkMissingContacts();
  }, [fetchedMessages, senderKey, majik, conversationID]);

  // ── Missing contact banner handlers (placeholder) ─────────────────────────
  const handleRequestContact = useCallback(
    async (publicKey: string): Promise<void> => {
      try {
        const response = await majik.createContactInvite(publicKey);

        if (response.success) {
          toast.success("Contact request sent", {
            description:
              response.message ||
              `Requested contact card from ${publicKey.slice(0, 8)}…`,
            id: `contact-request-${publicKey}`,
          });
        } else {
          toast.error("Contact request failed", {
            description:
              response.message ||
              `Failed to request contact card from ${publicKey.slice(0, 8)}…`,
            id: `contact-request-error-${publicKey}`,
          });
        }
      } catch (error: any) {
        toast.error("Contact request failed", {
          description:
            error?.message ||
            `Failed to request contact card from ${publicKey.slice(0, 8)}…`,
          id: `contact-request-error-${publicKey}`,
          action: {
            onClick: handleViewInvitations,
            label: "View Invitations",
          },
        });
      }
    },
    [],
  );

  const handleRequestAll = useCallback((): void => {
    // TODO: implement — send contact requests to all missingContactKeys
    console.log("[placeholder] requestAll", missingContactKeys);
    toast.info("Contact requests sent", {
      description: `Requested contact cards from ${missingContactKeys.length} participants.`,
      id: "contact-request-all",
    });
  }, [missingContactKeys]);

  const handleViewInvitations = useCallback((): void => {
    setInvitationsOpen(true);
  }, []);

  // ── Realtime event handlers ────────────────────────────────────────────────
  useEffect(() => {
    if (!client) return;

    const handleIncomingMessage = async (
      payload: ChatMessagePayload,
    ): Promise<void> => {
      try {
        if (!payload || !payload.payload) return;
        const msg = MajikMessageChat.fromJSON(payload.payload);

        let didInsert = false;

        setFetchedMessages((prev) => {
          if (prev.some((m) => m.getID() === msg.getID())) {
            return prev;
          }

          didInsert = true;

          return [...prev, msg].sort(
            (a, b) =>
              new Date(a.getTimestamp()).getTime() -
              new Date(b.getTimestamp()).getTime(),
          );
        });

        if (!majik.currentIdentity?.publicKey) return;

        if (
          didInsert &&
          !msg.isSender(majik.currentIdentity.publicKey) &&
          !msg.hasUserRead(majik.currentIdentity.publicKey)
        ) {
          const senderName = displayNamesRef.current[msg.getSender()];
          toast.success("New Message", {
            description: `You have a new message from ${senderName}`,
            id: `toast-success-message-new-${senderName}`,
          });

          sendNotification({
            title: "Majik Message",
            body: `You have a new message from ${senderName}`,
          });
        }

        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      } catch (err) {
        console.error("Failed to process realtime message", err);
      }
    };

    client.on("message", handleIncomingMessage);

    client.on("message_deleted", (data) => {
      setFetchedMessages((prev) =>
        prev.filter((msg) => msg.getID() !== data.messageId),
      );

      if (data.deletedBy !== majik.currentIdentity?.publicKey) {
        toast.success("Message Deleted", {
          description: `Message deleted by ${data.deletedBy}`,
          id: `toast-success-message-deleted-${data.messageId}`,
        });

        sendNotification({
          title: "Majik Message",
          body: `Message deleted by ${data.deletedBy}`,
        });
      }
    });

    client.on("user_joined", async (data) => {
      if (data.user !== majik.currentIdentity?.publicKey) {
        const userDisplayName = displayNamesRef.current[data.user];
        console.log(`${data.user} joined the chat`);
        toast.info("User joined the chat", {
          description: `${userDisplayName} joined the chat`,
          id: `toast-success-user-join-${data.user}`,
        });

        sendNotification({
          title: "Majik Message",
          body: `${data.user} joined the chat`,
        });
      }
    });

    client.on("user_left", async (data) => {
      if (data.user !== majik.currentIdentity?.publicKey) {
        const userDisplayName = displayNamesRef.current[data.user];
        console.log(`${data.user} left the chat`);
        toast.info("User went offline", {
          description: `${userDisplayName} left the chat`,
          id: `toast-success-user-left-${data.user}`,
        });

        sendNotification({
          title: "Majik Message",
          body: `${data.user} left the chat`,
        });
      }
    });

    client.on("error", (data) => {
      const errorMessage = data.message;
      console.warn(`Error: ${errorMessage}`);

      if (errorMessage !== "Invalid recipients") {
        return;
      }

      toast.error("Invalid Recipient", {
        description: `One or more participants in this conversation are no longer registered, so your message couldn't be delivered.`,
        id: `toast-error-invalid-recipient}`,
      });

      sendNotification({
        title: "Majik Message",
        body: `${errorMessage}: One or more participants in this conversation are no longer registered, so your message couldn't be delivered.`,
      });
    });

    return () => {
      client.off("message", handleIncomingMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    if (!bottomRef.current) return;
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [fetchedMessages.length]);

  // ── Intersection observer (mark as read) ──────────────────────────────────
  useEffect(() => {
    if (!client || !senderKey) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;

          const messageId = entry.target.getAttribute("data-message-id");
          if (!messageId) return;
          if (markedAsReadRef.current.has(messageId)) return;

          const message = fetchedMessages.find((m) => m.getID() === messageId);
          if (!message) return;
          if (message.isSender(senderKey)) return;
          if (message.isReadByAll()) return;
          if (message.hasUserRead(senderKey)) return;
          if (!document.hasFocus()) return;

          setTimeout(() => {
            if (entry.isIntersecting) {
              client.markRead(messageId);
              markedAsReadRef.current.add(messageId);
              if (isDevEnvironment()) console.log("Marked as read:", messageId);
            }
          }, 1500);
        });
      },
      { root: null, threshold: 0.5, rootMargin: "0px" },
    );

    messageRefsMap.current.forEach((element) => {
      if (element) observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [client, senderKey, fetchedMessages]);

  useEffect(() => {
    console.log("ConversationMessages mounted");
    return () => console.log("ConversationMessages unmounted");
  }, []);

  // ── Callback ref for message elements ─────────────────────────────────────
  const setMessageRef = useCallback((messageId: string) => {
    return (element: HTMLDivElement | null) => {
      if (element) {
        messageRefsMap.current.set(messageId, element);
        observerRef.current?.observe(element);
      } else {
        const existing = messageRefsMap.current.get(messageId);
        if (existing) {
          observerRef.current?.unobserve(existing);
          messageRefsMap.current.delete(messageId);
        }
      }
    };
  }, []);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const processDelete = async (
    senderPublicKey: MajikMessagePublicKey,
    message: MajikMessageChat,
  ): Promise<string> => {
    if (!senderPublicKey?.trim())
      throw new Error("A valid sender public key is required.");
    if (!message) throw new Error("A valid message is required.");
    if (!message.isSender(senderPublicKey))
      throw new Error("You are not allowed to delete this message.");

    setIsLoading(true);
    client.deleteMessage(message.getID(), message.getRedisKey());
    return "Message deleted successfully!";
  };

  const handleDelete = async (message: MajikMessageChat): Promise<void> => {
    const activeAccount = majik.getActiveAccount();
    if (!activeAccount || !message) return;
    const currentUserPublicKey = await activeAccount.getPublicKeyBase64();

    toast.promise(processDelete(currentUserPublicKey, message), {
      loading: "Deleting message...",
      success: (outputMessage) => {
        setTimeout(() => {
          setFetchedMessages((prev) =>
            prev.filter((m) => m.getID() !== message.getID()),
          );
          setIsLoading(false);
        }, 1000);
        return outputMessage;
      },
      error: (error) => {
        setIsLoading(false);
        return `${error.message}`;
      },
    });
  };

  // ── Insert message (exposed via ref) ──────────────────────────────────────
  const insertMessage = useCallback(
    async (message: MajikMessageChat): Promise<void> => {
      if (!message) return;
      setFetchedMessages((prev) => {
        if (prev.some((m) => m.getID() === message.getID())) return prev;
        const newMessages = [...prev, message].sort(
          (a, b) =>
            new Date(a.getTimestamp()).getTime() -
            new Date(b.getTimestamp()).getTime(),
        );
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
        return newMessages;
      });
    },
    [],
  );

  useImperativeHandle(ref, () => ({ insertMessage }));

  // ── Date separator helper ──────────────────────────────────────────────────
  const getDateLabel = (ts: string): string => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasMissingContacts = missingContactKeys.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root>
      {/* Missing contacts banner — pinned above the scroll area */}
      {hasMissingContacts && (
        <MissingContactsBanner
          missingKeys={missingContactKeys}
          onRequestContact={handleRequestContact}
          onRequestAll={handleRequestAll}
          onViewInvitations={handleViewInvitations}
        />
      )}

      <ScrollArea>
        {loading && fetchedMessages.length === 0 ? (
          <DynamicPlaceholder loading>Loading messages…</DynamicPlaceholder>
        ) : (
          <>
            {loading && fetchedMessages.length > 0 && (
              <div
                style={{ opacity: 0.5, fontSize: "10px", textAlign: "center" }}
              >
                Updating...
              </div>
            )}

            {fetchedMessages.map((msg, index) => {
              const isOwn = msg.isSender(senderKey!);
              const prevMsg = index > 0 ? fetchedMessages[index - 1] : null;
              const showSeparator =
                !prevMsg ||
                getDateLabel(msg.getTimestamp()) !==
                  getDateLabel(prevMsg.getTimestamp());

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
              );
            })}
          </>
        )}
        {isAnyoneTyping && (
          <TypingIndicator
            typingPublicKeys={typingUsers.map((u) => u.publicKey)}
            majik={majik}
          />
        )}

        <div ref={bottomRef} />
      </ScrollArea>
      <DynamicSlidingDialogue
        isOpen={invitationsOpen}
        onOpenChange={setInvitationsOpen}
        modal={{
          title: "My SLinks",
          description: "View and manage all your published signed links.",
        }}
        buttons={{
          cancel: { text: "Close", hide: true },
          confirm: { text: "Done", hide: true },
        }}
        scrollable={false}
        width={820}
      >
        <UserContactInvitations majik={majik} />
      </DynamicSlidingDialogue>
    </Root>
  );
});

ConversationMessages.displayName = "ConversationMessages";
