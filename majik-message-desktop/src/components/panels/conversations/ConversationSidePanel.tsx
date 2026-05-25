/* eslint-disable @typescript-eslint/no-explicit-any */

import DynamicPlaceholder from "@/components/foundations/DynamicPlaceholder";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { keyframes } from "styled-components";

import type { ConversationSummary } from "@/components/majikah-session-wrapper/api-types";

import { CBaseConversation } from "@/components/base/CBaseConversation";
import type { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { toast } from "sonner";
import { MajikMessageIdentitySelector } from "@/components/MajikMessageIdentitySelector";

import { MajikMessageChat, MajikMessageIdentity } from "@majikah/majik-message";
import {
  ArrowClockwiseIcon,
  ChatTeardropTextIcon,
  NotePencilIcon,
} from "@phosphor-icons/react";
import PopUpFormButton from "@/components/foundations/PopUpFormButton";
import NewMessageForm from "@/components/NewMessageForm";
import { useMajikah } from "@/components/majikah-session-wrapper/use-majikah";
import UserAuth from "@/components/foundations/UserAuth";

import { MajikMessageRealtimeChatClientProvider } from "@/components/majikah-session-wrapper/messages/MajikMessageRealtimeChatClientProvider";
import { ConversationMessages } from "@/components/functional/ConversationMessages";
import { RealtimeChatInput } from "@/components/functional/RealtimeChatInput";
import GuideHelper from "@/components/functional/GuideHelper";
import { launchTutorialChats } from "@/lib/shepherd-js/tutorials/tutorial-chats";
import { useShepherd } from "@/lib/shepherd-js/use-shepherd";
import StyledIconButton from "@/components/foundations/StyledIconButton";

import { IncomingCallBanner } from "@/components/majikah-session-wrapper/calls/IncomingCallBanner";
import { MajikCallOverlay } from "@/components/majikah-session-wrapper/calls/MajikCallOverlay";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";

// ─── Animations ───────────────────────────────────────────────────────────────
const slideIn = keyframes`
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────
const Root = styled.div`
  display: flex;
  flex: 1;
  height: 100%;
  overflow: hidden;
  width: 100%;
`;

const ListPane = styled.div<{ $hasSelection: boolean }>`
  display: flex;
  flex-direction: column;
  /* Narrow when a thread is open, full width when not */
  width: ${({ $hasSelection }) => ($hasSelection ? "40%" : "100%")};
  flex-shrink: 0;
  overflow: hidden;
  border-right: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

const RightPane = styled.div`
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
`;

// ─── List pane header ─────────────────────────────────────────────────────────
const PaneHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const PaneTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const IdentityRow = styled.div`
  padding: 8px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

// ─── Conversation list ────────────────────────────────────────────────────────
const ConvList = styled.ul`
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px 12px;
  margin: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.colors.secondaryBackground} transparent`};
  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 60px 20px;
  text-align: center;
  flex: 1;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const EmptyIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
`;

const EmptyText = styled.p`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const EmptyHint = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  max-width: 180px;
  line-height: 1.5;
  opacity: 0.7;
`;

// ─── Right pane states ────────────────────────────────────────────────────────
const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  animation: ${slideIn} 200ms cubic-bezier(0.4, 0, 0.2, 1) both;
`;

const ViewerPlaceholder = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const PlaceholderIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
`;

const PlaceholderText = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.6;
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface ConversationSidePanelProps {
  majik: MajikMessageDatabase;
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const ConversationSidePanel: React.FC<ConversationSidePanelProps> = ({
  majik,
}) => {
  const { majikah } = useMajikah();
  const tour = useShepherd();

  const [fetchedConversations, setFetchedConversations] = useState<
    ConversationSummary[]
  >([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | undefined
  >(undefined);
  const [loading, setIsLoading] = useState(false);
  const [newMessageText, setNewMessageText] = useState<string>("");
  const [isCreatingMessage, setIsCreatingMessage] = useState<boolean>(false);

  const isRefreshingRef = useRef(false);
  const messagesRef = useRef<{
    insertMessage: (message: MajikMessageChat) => Promise<void>;
  }>(null);

  const selectedConversation = useMemo(
    () =>
      fetchedConversations.find(
        (c) => c.conversation_id === selectedConversationId,
      ),
    [fetchedConversations, selectedConversationId],
  );

  // ── Read conversationID from URL params on mount ──────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("conversationID");
    if (!raw) return;
    const decoded = decodeURIComponent(raw);
    setSelectedConversationId(decoded);
  }, []);

  // ── Fetch conversations ────────────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    if (!majikah?.isAuthenticated) return;
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    try {
      setIsLoading(true);
      const fetchResponse = await majik.getConversations();
      const conversations = fetchResponse.conversations;
      setFetchedConversations(conversations);

      // Only auto-select the first conversation on initial load (when nothing is selected yet).
      // Never override an active selection on subsequent refreshes.
      setSelectedConversationId((prev) => {
        if (prev !== undefined) return prev;
        return conversations[0]?.conversation_id ?? undefined;
      });
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast.error("Failed to refresh conversations", {
          description: error?.message,
        });
      }
    } finally {
      isRefreshingRef.current = false;
      setIsLoading(false);
      setIsCreatingMessage(false);
    }
  }, [majik, majikah.isAuthenticated]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectConversation = (input: ConversationSummary): void => {
    if (input?.conversation_id)
      setSelectedConversationId(input.conversation_id);
  };

  const handleMessageTextUpdate = (text: string): void => {
    setNewMessageText(text || "");
  };

  useEffect(() => {
    console.log("Identity ref changed");
  }, [majik.currentIdentity]);

  const isUserRestricted = useMemo(
    () => majik?.currentIdentity?.isRestricted() || false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik, majik.user?.id, majik.getActiveAccount()?.id],
  );

  // Use a ref to store the last known good identity
  const lastValidIdentity = useRef<MajikMessageIdentity | null>(
    majik.currentIdentity,
  );

  const stableIdentity = useMemo(() => {
    if (majik.currentIdentity) {
      lastValidIdentity.current = majik.currentIdentity;
      return majik.currentIdentity;
    }
    // If majik.currentIdentity is briefly null, return the last one we had
    return lastValidIdentity.current;
  }, [majik.currentIdentity]); // Only re-calc if the key actually changes

  if (!majikah?.isAuthenticated) return <UserAuth />;

  if (!majik?.currentIdentity)
    return (
      <Root>
        <ListPane $hasSelection={false}>
          <DynamicPlaceholder>
            To use <strong>Chats</strong>, you need a registered Majik Key
            (local seed phrase account). Create a new account and register it
            online, or select an existing one to continue.
            <DynamicAlertBanner
              title="Majik Message Identity Required"
              description="  To use Chats, you need a registered Majik Key (local seed phrase account). Create a new account and register it online, or select an existing one to continue."
              level="warning"
            />
            <IdentityRow>
              <MajikMessageIdentitySelector onChange={refreshConversations} />
            </IdentityRow>
          </DynamicPlaceholder>
        </ListPane>
      </Root>
    );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root>
      {/* ── Left: conversation list ── */}
      <ListPane
        id="section-chats"
        $hasSelection={!!selectedConversation?.conversation_id?.trim()}
      >
        <GuideHelper
          docsPath="https://majikah.solutions/products/majik-message/docs/chats-realtime-documentation"
          startTour={() => launchTutorialChats(tour)}
        />
        <PaneHeader>
          <PaneTitle>Chats</PaneTitle>
          <HeaderActions>
            <PopUpFormButton
              id="button-new-conversation"
              icon={NotePencilIcon}
              text="New"
              disabled={isUserRestricted}
              modal={{
                title: "New Message",
                description: "Send a new message to your contacts.",
              }}
              buttons={{
                cancel: { text: "Cancel" },
                confirm: {
                  text: "Send",
                  isDisabled: !newMessageText?.trim(),
                  hide: true,
                },
              }}
              isOpen={isCreatingMessage}
              onOpenChange={(open) => setIsCreatingMessage(open)}
            >
              <NewMessageForm
                majikah={majikah}
                majik={majik}
                onSend={refreshConversations}
                onUpdate={handleMessageTextUpdate}
              />
            </PopUpFormButton>

            <StyledIconButton
              icon={ArrowClockwiseIcon}
              title="Refresh"
              onClick={refreshConversations}
              size={22}
            />
          </HeaderActions>
        </PaneHeader>

        <IdentityRow>
          <MajikMessageIdentitySelector onChange={refreshConversations} />
        </IdentityRow>

        {loading ? (
          <DynamicPlaceholder loading>Loading…</DynamicPlaceholder>
        ) : fetchedConversations.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <ChatTeardropTextIcon size={18} />
            </EmptyIcon>
            <EmptyText>No conversations yet</EmptyText>
            <EmptyHint>
              Start a new encrypted chat with the button above.
            </EmptyHint>
          </EmptyState>
        ) : (
          <ConvList>
            {fetchedConversations.map((conv) => (
              <li key={conv.conversation_id}>
                <CBaseConversation
                  majik={majik}
                  conversation={conv}
                  onClick={handleSelectConversation}
                  isActive={conv.conversation_id === selectedConversationId}
                />
              </li>
            ))}
          </ConvList>
        )}
      </ListPane>

      {/* ── Right: messages or placeholder ── */}
      <RightPane id="section-chats-messages">
        {selectedConversation ? (
          <ChatContainer>
            {stableIdentity && (
              <MajikMessageRealtimeChatClientProvider
                conversationID={selectedConversation.conversation_id}
                account={stableIdentity}
                majik={majik}
              >
                <IncomingCallBanner majik={majik} />
                <MajikCallOverlay />
                <ConversationMessages
                  conversationID={selectedConversation.conversation_id}
                  majik={majik}
                  ref={messagesRef}
                />
                {selectedConversation && (
                  <RealtimeChatInput
                    majikah={majikah}
                    majik={majik}
                    conversationID={selectedConversation.conversation_id}
                    participants={selectedConversation.participants}
                  />
                )}
              </MajikMessageRealtimeChatClientProvider>
            )}
          </ChatContainer>
        ) : (
          <ViewerPlaceholder>
            <PlaceholderIcon>
              <ChatTeardropTextIcon size={20} />
            </PlaceholderIcon>
            <PlaceholderText>
              Select a conversation to start chatting
            </PlaceholderText>
          </ViewerPlaceholder>
        )}
      </RightPane>
    </Root>
  );
};

export default ConversationSidePanel;
