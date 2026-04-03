import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { css, keyframes } from "styled-components";
import {
  NotePencilIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ArrowClockwiseIcon,
  EnvelopeSimpleIcon,
} from "@phosphor-icons/react";
import ThreadRow from "./ThreadRow";
import {
  MajikMessageThread,
  type MajikMessageThreadID,
  type MajikMessageThreadSummary,
} from "@majikah/majik-message";
import PopUpFormButton from "@/components/foundations/PopUpFormButton";
import UserAuth from "@/components/foundations/UserAuth";
import { useMajikah } from "@/components/majikah-session-wrapper/use-majikah";
import type { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import { toast } from "sonner";
import NewThreadForm from "./NewThreadForm";
import { isDevEnvironment } from "@/utils/utils";
import StyledIconButton from "@/components/foundations/StyledIconButton";
import ThreadViewer from "./ThreadViewer";
import DynamicPlaceholder from "@/components/foundations/DynamicPlaceholder";
import { launchTutorialThreads } from "@/lib/shepherd-js/tutorials/tutorial-threads";
import { useShepherd } from "@/lib/shepherd-js/use-shepherd";
import GuideHelper from "@/components/functional/GuideHelper";
import { MajikMessageIdentitySelector } from "@/components/MajikMessageIdentitySelector";
import { MajikContact } from "@majikah/majik-contact";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Animations ───────────────────────────────────────────────────────────────
const slideIn = keyframes`
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

// ─── Root split layout ────────────────────────────────────────────────────────
/**
 * Two-pane layout:
 *   Left  — fixed-width thread list (never shrinks below 300px)
 *   Right — thread viewer fills remaining space, hidden when no thread selected
 *
 * The original used a DynamicSlidingDialogue overlay. The split-screen
 * approach keeps context: users can see the thread list while reading messages.
 */
const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.primaryBackground};
  flex-direction: row;
`;

// ─── Left pane ────────────────────────────────────────────────────────────────
const ListPane = styled.div<{ $hasSelection: boolean }>`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Narrow when a thread is open, full width when not */
  width: ${({ $hasSelection }) => ($hasSelection ? "40%" : "100%")};

  /* On very small viewports collapse the list completely when viewing */
  @media (max-width: 640px) {
    width: ${({ $hasSelection }) => ($hasSelection ? "0px" : "100%")};
    border-right: none;
  }
`;

// ─── Right pane ───────────────────────────────────────────────────────────────
const ViewerPane = styled.div<{ $visible: boolean }>`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: ${({ $visible }) => ($visible ? "flex" : "none")};
  flex-direction: column;
  animation: ${({ $visible }) =>
    $visible
      ? css`
          ${slideIn} 220ms cubic-bezier(0.4, 0, 0.2, 1) both
        `
      : "none"};
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
  background: ${({ theme }) => theme.colors.primaryBackground};
`;

const PaneTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  letter-spacing: -0.01em;
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

// ─── Identity + pagination sub-row ────────────────────────────────────────────
const SubRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
`;

const PageLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.04em;
  white-space: nowrap;
`;

const PageBtn = styled.button<{ $disabled: boolean }>`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  border-radius: 4px;
  color: ${({ theme, $disabled }) =>
    $disabled ? theme.colors.secondaryBackground : theme.colors.textSecondary};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  transition: all 150ms ease;

  &:hover {
    background: ${({ theme, $disabled }) =>
      $disabled ? "transparent" : theme.colors.secondaryBackground};
    color: ${({ theme, $disabled }) =>
      $disabled ? theme.colors.secondaryBackground : theme.colors.textPrimary};
  }

  &:active {
    transform: ${({ $disabled }) => ($disabled ? "none" : "scale(0.92)")};
  }
`;

// ─── Thread list scroll area ──────────────────────────────────────────────────
const ListScroll = styled.ul`
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
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`;

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  text-align: center;
  flex: 1;
`;

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
`;

const EmptyTitle = styled.p`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const EmptyMessage = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  max-width: 200px;
  line-height: 1.5;
`;

// ─── Viewer placeholder (no thread selected) ──────────────────────────────────
const ViewerPlaceholder = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  animation: ${fadeIn} 300ms ease both;
`;

const PlaceholderIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const PlaceholderText = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface EmailThreadsProps {
  majik: MajikMessageDatabase;
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void;
  onPageChange?: (page: number) => void;
  onToggleStar?: (threadId: MajikMessageThreadID) => void;
  onToggleRead?: (threadId: MajikMessageThreadID) => void;
  onThreadClick?: (threadId: MajikMessageThreadID) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const EmailThreads: React.FC<EmailThreadsProps> = ({
  majik,
  onPageChange,
  onToggleStar,
  onToggleRead,
  onThreadClick,
}) => {
  const { majikah } = useMajikah();
  const tour = useShepherd();

  const [fetchedThreads, setFetchedThreads] = useState<
    MajikMessageThreadSummary[]
  >([]);
  const [totalThreads, setTotalThreads] = useState<number>(0);
  const [recipients, setRecipients] = useState<MajikContact[]>(() => {
    const myAccount = majik.getActiveAccount();
    return myAccount ? [myAccount] : [];
  });
  const [threadLabel, setThreadLabel] = useState<string | undefined>(undefined);
  const [selectedThread, setSelectedThread] =
    useState<MajikMessageThread | null>(null);
  const [loading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [allowNextPage, setAllowNextPage] = useState(false);

  const isRefreshingRef = useRef(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const refreshThreads = useCallback(async () => {
    if (!majikah?.isAuthenticated) return;
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    try {
      setIsLoading(true);
      const fetchResponse = await majik.getThreads();
      setFetchedThreads(fetchResponse.threads);
      setTotalThreads(fetchResponse.total_threads);
      setAllowNextPage(fetchResponse.canNextPage);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast.error("Failed to refresh threads", {
          description: error?.message,
        });
      }
    } finally {
      isRefreshingRef.current = false;
      setIsLoading(false);
    }
  }, [majik, majikah.isAuthenticated]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const handlePreviousPage = (): void => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      onPageChange?.(newPage);
    }
  };

  const handleNextPage = (): void => {
    if (!allowNextPage) return;
    const newPage = page + 1;
    setPage(newPage);
    onPageChange?.(newPage);
  };

  // ── Create thread ──────────────────────────────────────────────────────────
  const processCreateThread = async (): Promise<string> => {
    if (isDevEnvironment()) console.log("Creating thread for: ", recipients);
    if (!recipients || recipients.length <= 1)
      throw new Error("Assign recipients first.");

    const activeAccount = majik.currentIdentity;
    if (!activeAccount) throw new Error("No active account found");

    const currentUserPublicKey = activeAccount.publicKey;
    const messageRecipients = (
      await Promise.all(
        recipients
          .filter((r) => r.isMajikahRegistered())
          .map(async (r) => r.getPublicKeyBase64()),
      )
    ).filter((pk) => pk !== currentUserPublicKey);

    if (isDevEnvironment()) console.log("Recipients: ", messageRecipients);

    const createThreadResponse = await majik.createThread(
      messageRecipients,
      threadLabel,
    );

    if (createThreadResponse?.success && createThreadResponse.message) {
      refreshThreads();
      const parsedThread = MajikMessageThread.fromJSON(
        createThreadResponse.data,
      );
      setSelectedThread(parsedThread);
      return `Thread created successfully! ${createThreadResponse.message}`;
    }
    return `Oh no... There's a problem while creating the thread.`;
  };

  const handleCreateThread = async (): Promise<void> => {
    if (!majik.currentIdentity) return;
    if (!recipients || recipients.length <= 1) {
      toast.error("Assign recipients first.");
      return;
    }

    toast.promise(processCreateThread(), {
      loading: "Creating thread...",
      success: (msg) => msg,
      error: () => "Oh no... There's a problem while creating the thread.",
    });
  };

  const handleThreadFormUpdate = (
    input: MajikContact[],
    subject?: string,
  ): void => {
    setRecipients(input);
    setThreadLabel(subject);
  };

  // ── Select thread ──────────────────────────────────────────────────────────
  const processSelectThread = async (
    threadID: MajikMessageThreadID,
  ): Promise<string> => {
    if (isDevEnvironment()) console.log("Loading thread: ", threadID);
    if (!threadID.trim()) throw new Error("Please select a valid thread.");
    if (!majik.currentIdentity) throw new Error("No active account found");

    const fetchedThread = await majik.getThread(threadID);
    if (fetchedThread?.thread) {
      const parsedThread = MajikMessageThread.fromJSON(fetchedThread.thread);
      setSelectedThread(parsedThread);
      return "Thread loaded successfully!";
    }
    return "Oh no... There's a problem while loading this thread.";
  };

  const handleSelectThread = async (
    threadID: MajikMessageThreadID,
  ): Promise<void> => {
    if (!majik.currentIdentity) return;
    if (!threadID.trim()) {
      toast.error("A valid thread ID is required.");
      return;
    }

    if (threadID === selectedThread?.id) return;

    toast.promise(processSelectThread(threadID), {
      loading: "Loading thread...",
      success: (msg) => {
        onThreadClick?.(threadID);
        return msg;
      },
      error: () => "Oh no... There's a problem while loading this thread.",
    });
  };

  // ── Close / refresh ────────────────────────────────────────────────────────
  const handleCloseThread = (): void => setSelectedThread(null);

  const handleMarkThreadClosed = (): void => {
    handleCloseThread();
    refreshThreads();
  };

  // ── Delete thread (by object) ──────────────────────────────────────────────
  const processDeleteThread = async (
    thread: MajikMessageThread,
  ): Promise<string> => {
    const activeAccount = majik.currentIdentity;
    if (!activeAccount) throw new Error("No active account found");
    if (!thread?.validate()) throw new Error("Invalid thread");
    if (thread.hasDeletionApproval(activeAccount.publicKey))
      throw new Error("You've already requested to delete this thread.");

    const res = await majik.deleteThread(thread);
    return res?.success
      ? res.message || "Your deletion request has been recorded successfully!"
      : "Oh no... There's a problem while requesting to delete this thread.";
  };

  const handleDeleteThread = async (
    thread: MajikMessageThread,
  ): Promise<void> => {
    if (!majik.currentIdentity) return;
    if (!thread?.validate()) {
      toast.error("Invalid thread provided.");
      return;
    }

    toast.promise(processDeleteThread(thread), {
      loading: "Requesting to delete this thread...",
      success: (msg) => {
        setTimeout(refreshThreads, 1000);
        handleCloseThread();
        return msg;
      },
      error: () =>
        "Oh no... There's a problem while requesting to delete this thread.",
    });
  };

  const processCancelDeleteThread = async (
    thread: MajikMessageThread,
  ): Promise<string> => {
    if (!majik.currentIdentity) throw new Error("No active account found");
    if (!thread?.validate()) throw new Error("Invalid thread");
    if (!thread.hasDeletionApproval(majik.currentIdentity.publicKey))
      throw new Error("You haven't requested to delete this thread yet.");

    const res = await majik.revokeDeleteThread(thread);
    return res?.success
      ? res.message || "Your deletion request has been revoked successfully!"
      : "Oh no... There's a problem while revoking your request to delete this thread.";
  };

  const handleCancelDeleteThread = async (
    thread: MajikMessageThread,
  ): Promise<void> => {
    if (!majik.currentIdentity) return;
    if (!thread?.validate()) {
      toast.error("Invalid thread provided.");
      return;
    }

    toast.promise(processCancelDeleteThread(thread), {
      loading: "Revoking your request to delete this thread...",
      success: (msg) => {
        setTimeout(refreshThreads, 1000);
        handleCloseThread();
        return msg;
      },
      error: () =>
        "Oh no... There's a problem while revoking your request to delete this thread.",
    });
  };

  // ── Delete thread (by ID) ──────────────────────────────────────────────────
  const processDeleteThreadByID = async (
    threadID: MajikMessageThreadID,
  ): Promise<string> => {
    if (!majik.currentIdentity) throw new Error("No active account found");
    if (!threadID?.trim()) throw new Error("Invalid thread ID");

    const res = await majik.manageThreadDeletionByID(threadID);
    return res?.success
      ? res.message || "Your deletion request has been recorded successfully!"
      : "Oh no... There's a problem while requesting to delete this thread.";
  };

  const handleDeleteThreadByID = async (
    threadID: MajikMessageThreadID,
  ): Promise<void> => {
    if (!majik.currentIdentity) return;
    if (!threadID?.trim()) {
      toast.error("Invalid thread ID provided.");
      return;
    }

    toast.promise(processDeleteThreadByID(threadID), {
      loading: "Requesting to delete this thread...",
      success: (msg) => {
        setTimeout(refreshThreads, 1000);
        handleCloseThread();
        return msg;
      },
      error: () =>
        "Oh no... There's a problem while requesting to delete this thread.",
    });
  };

  const processCancelDeleteThreadByID = async (
    threadID: MajikMessageThreadID,
  ): Promise<string> => {
    if (!majik.currentIdentity) throw new Error("No active account found");
    if (!threadID?.trim()) throw new Error("Invalid thread ID");

    const res = await majik.manageThreadDeletionByID(threadID, true);
    return res?.success
      ? res.message || "Your deletion request has been revoked successfully!"
      : "Oh no... There's a problem while revoking your request to delete this thread.";
  };

  const handleCancelDeleteThreadByID = async (
    threadID: MajikMessageThreadID,
  ): Promise<void> => {
    if (!majik.currentIdentity) return;
    if (!threadID?.trim()) {
      toast.error("Invalid thread ID provided.");
      return;
    }

    toast.promise(processCancelDeleteThreadByID(threadID), {
      loading: "Revoking your request to delete this thread...",
      success: (msg) => {
        setTimeout(refreshThreads, 1000);
        handleCloseThread();
        return msg;
      },
      error: () =>
        "Oh no... There's a problem while revoking your request to delete this thread.",
    });
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isPreviousDisabled = page <= 1;
  const isNextDisabled = !allowNextPage;
  const mailsPerPage = 50;
  const startThread = totalThreads === 0 ? 0 : (page - 1) * mailsPerPage + 1;
  const endThread = Math.min(page * mailsPerPage, totalThreads);

  const isUserRestricted = useMemo(
    () => majik?.currentIdentity?.isRestricted() || false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik, majik.user?.id, majik.getActiveAccount()?.id],
  );

  const hasSelection = !!selectedThread?.validate();

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!majikah?.isAuthenticated) return <UserAuth />;

  if (!majik?.currentIdentity)
    return (
      <Root>
        <ListPane $hasSelection={false}>
          <DynamicPlaceholder>
            To use <strong>Threads</strong>, you need a registered Majik Key
            (local seed phrase account). Create a new account and register it
            online, or select an existing one to continue.
            <SubRow>
              <MajikMessageIdentitySelector onChange={refreshThreads} />
            </SubRow>
          </DynamicPlaceholder>
        </ListPane>
      </Root>
    );

  if (loading) {
    return (
      <Root>
        <ListPane $hasSelection={false}>
          <DynamicPlaceholder loading>Loading…</DynamicPlaceholder>
        </ListPane>
      </Root>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <Root id="section-threads">
      {/* ── LEFT: thread list ── */}
      <ListPane $hasSelection={hasSelection}>
        <GuideHelper
          docsPath="https://majikah.solutions/products/majik-message/docs/threads-documentation"
          startTour={() => launchTutorialThreads(tour)}
          id="main-threads"
        />
        {/* Header */}
        <PaneHeader>
          <PaneTitle>Threads</PaneTitle>
          <HeaderActions>
            <PopUpFormButton
              id="button-new-thread"
              icon={NotePencilIcon}
              text="New"
              disabled={isUserRestricted}
              modal={{
                title: "New Thread",
                description: "Create a new thread",
              }}
              buttons={{
                cancel: { text: "Cancel" },
                confirm: {
                  text: "Create",
                  onClick: handleCreateThread,
                  isDisabled: loading,
                },
              }}
            >
              <NewThreadForm majik={majik} onUpdate={handleThreadFormUpdate} />
            </PopUpFormButton>

            <StyledIconButton
              onClick={refreshThreads}
              aria-label="Reload Threads"
              icon={ArrowClockwiseIcon}
              title="Reload Threads"
              size={22}
              id="button-refresh-thread"
            />
          </HeaderActions>
        </PaneHeader>

        {/* Identity selector + pagination */}
        <SubRow>
          <MajikMessageIdentitySelector onChange={refreshThreads} />
          {fetchedThreads.length > 0 && (
            <Pagination>
              <PageLabel>
                {totalThreads > 0
                  ? `${startThread}–${endThread} of ${totalThreads}`
                  : "—"}
              </PageLabel>
              <PageBtn
                onClick={handlePreviousPage}
                $disabled={isPreviousDisabled}
                disabled={isPreviousDisabled}
                aria-label="Previous page"
              >
                <CaretLeftIcon size={12} />
              </PageBtn>
              <PageBtn
                onClick={handleNextPage}
                $disabled={isNextDisabled}
                disabled={isNextDisabled}
                aria-label="Next page"
              >
                <CaretRightIcon size={12} />
              </PageBtn>
            </Pagination>
          )}
        </SubRow>

        {/* Thread list */}
        {fetchedThreads.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <EnvelopeSimpleIcon size={20} />
            </EmptyIcon>
            <EmptyTitle>No threads yet</EmptyTitle>
            <EmptyMessage>
              Your inbox is empty. Create a new thread above to get started.
            </EmptyMessage>
          </EmptyState>
        ) : (
          <ListScroll>
            {fetchedThreads.map((thread) => (
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
            ))}
          </ListScroll>
        )}
      </ListPane>

      {/* ── RIGHT: thread viewer or placeholder ── */}
      {hasSelection ? (
        <ViewerPane $visible>
          <ThreadViewer
            majik={majik}
            thread={selectedThread!}
            onDelete={handleDeleteThread}
            onRevokeDelete={handleCancelDeleteThread}
            onMarkClosed={handleMarkThreadClosed}
          />
        </ViewerPane>
      ) : (
        <ViewerPlaceholder>
          <PlaceholderIcon>
            <EnvelopeSimpleIcon size={24} />
          </PlaceholderIcon>
          <PlaceholderText>Select a thread to read messages</PlaceholderText>
        </ViewerPlaceholder>
      )}
    </Root>
  );
};

export default EmailThreads;
