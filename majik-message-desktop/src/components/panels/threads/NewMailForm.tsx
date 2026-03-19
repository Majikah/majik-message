import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { toast } from "sonner";
import {
  PaperPlaneRightIcon,
  PaperclipIcon,
  LockSimpleIcon,
} from "@phosphor-icons/react";

import type {
  MajikContact,
  MajikMessagePublicKey,
  MajikMessageThread,
} from "@majikah/majik-message";
import type { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";

import { MailInputBox } from "@/components/functional/MailInputBox";

import { isDevEnvironment } from "@/utils/utils";
import ThreadAttachments from "./ThreadAttachments";
import type { MajikFile } from "@majikah/majik-file";

// ─── Animations ───────────────────────────────────────────────────────────────

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Root — fills the DynamicSlidingDialogue body ─────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 10px;

  background: ${({ theme }) => theme.colors.primaryBackground};
  animation: ${slideIn} 200ms ease both;
  margin-top: 20px;
`;

// ─── Compose header ────────────────────────────────────────────────────────────
// Gmail-style header with thread title and close button (handled by parent).
// Inside here we show the From field (read-only sender) and To (locked list).

const ComposeHeader = styled.div`
  flex-shrink: 0;
  padding: 0 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

const FieldRow = styled.div<{ $borderless?: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0;
  min-height: 42px;
  ${({ $borderless, theme }) =>
    !$borderless &&
    css`
      border-bottom: 1px solid ${theme.colors.secondaryBackground}77;
    `}
`;

const FieldLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  width: 36px;
  flex-shrink: 0;

  user-select: none;
`;

const FieldValue = styled.div`
  flex: 1;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 5px;
  padding: 0px 10px;
  min-height: 42px;
`;

const ContactChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0px 9px;
  border-radius: 100px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: 500;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LockBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 3px 8px;
  border-radius: 100px;
  background: ${({ theme }) => theme.colors.primary}15;
  border: 1px solid ${({ theme }) => theme.colors.primary}2a;
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.75;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: center;
`;

// ─── Subject field ────────────────────────────────────────────────────────────
// Overrides CustomInputField to match the compose style.

const SubjectWrap = styled.div`
  flex: 1;
  padding: 0 0 0 10px;
  display: flex;
  align-items: center;

  input,
  textarea {
    background: transparent;
    border: none;
    outline: none;
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textPrimary};
    width: 100%;
    padding: 0;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textSecondary};
      opacity: 0.35;
    }
  }
`;

const SubjectInput = styled.input`
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 100%;
  padding: 11px 0;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.35;
    font-weight: 400;
  }
`;

// ─── Editor body ──────────────────────────────────────────────────────────────

const ComposeBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 20px 0;
  overflow: hidden;
`;

// ─── Footer toolbar ───────────────────────────────────────────────────────────

const ComposeFooter = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  height: fit-content;
`;

const SendBtn = styled.button<{ $canSend: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 20px;
  height: 36px;
  border-radius: 9px;
  border: none;
  background: ${({ $canSend, theme }) =>
    $canSend
      ? (theme.gradients?.strong ?? theme.colors.primary)
      : theme.colors.secondaryBackground};
  color: ${({ $canSend, theme }) =>
    $canSend ? theme.colors.primaryBackground : theme.colors.textSecondary};
  font-size: 13px;
  font-weight: 600;
  cursor: ${({ $canSend }) => ($canSend ? "pointer" : "not-allowed")};
  opacity: ${({ $canSend }) => ($canSend ? 1 : 0.5)};
  transition:
    opacity 150ms ease,
    transform 120ms ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    opacity: 0.88;
    transform: scale(1.02);
  }
`;

const FooterIconBtn = styled.button<{ $active?: boolean }>`
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  transition: all 120ms ease;
  flex-shrink: 0;

  ${({ $active, theme }) =>
    $active &&
    css`
      background: ${theme.colors.primary}18;
      border-color: ${theme.colors.primary}33;
    `}

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const FooterSpacer = styled.div`
  flex: 1;
`;

const AttachmentCount = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary}18;
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  padding: 1px 5px;
  border-radius: 100px;
  margin-left: -4px;
`;

const EncryptedHint = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 4px;
`;

// ─── Attachment panel container ───────────────────────────────────────────────

const AttachPanelWrap = styled.div<{ $open: boolean }>`
  flex-shrink: 0;
  overflow: hidden;
  max-height: ${({ $open }) => ($open ? "420px" : "0")};
  transition: max-height 280ms cubic-bezier(0.4, 0, 0.2, 1);
  border-top: ${({ $open, theme }) =>
    $open ? `1px solid ${theme.colors.secondaryBackground}` : "none"};
`;

const AttachPanelInner = styled.div`
  padding: 16px 20px;
  height: 380px;
  overflow: hidden;
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewMailFormProps {
  majik: MajikMessageDatabase;
  thread: MajikMessageThread;
  onUpdate?: (message: string, subject?: string) => void;
  onSend?: (message: string, subject?: string) => void;
  reply?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const NewMailForm: React.FC<NewMailFormProps> = ({
  majik,
  thread,
  onUpdate,
  onSend,
}) => {
  const [input, setInput] = useState<string>("");
  const [subject, setSubject] = useState<string | undefined>(undefined);
  const [attachPanelOpen, setAttachPanelOpen] = useState(false);
  const [participants, setParticipants] = useState<MajikContact[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<MajikFile[]>([]); // ← ADD
  const [hasPendingEncryption, setHasPendingEncryption] = useState(false); // ← ADD

  const myAccount = useMemo(() => majik.getActiveAccount() ?? null, [majik]);

  // ── Resolve participants ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const resolve = async (): Promise<void> => {
      if (!thread?.participants?.length) return;
      try {
        const resolved = await Promise.all(
          thread.participants.map((pKey) => majik.getContactByPublicKey(pKey)),
        );
        const valid = resolved.filter((c): c is MajikContact => Boolean(c));
        if (!cancelled) setParticipants(valid);
      } catch (err) {
        console.error("[NewMailForm] Failed to load participants", err);
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, majik]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAttachmentsChange = useCallback((files: MajikFile[]) => {
    setPendingAttachments(files);
    console.log("Received Attachments: ", files);
  }, []);

  // Track whether any files are still encrypting (majikFile === undefined)
  // so we can block send until all are ready
  const handleEncryptionPending = useCallback((isPending: boolean) => {
    setHasPendingEncryption(isPending);
  }, []);

  const handleBodyChange = useCallback(
    (markdown: string) => {
      setInput(markdown);
      onUpdate?.(markdown, subject);
    },
    [onUpdate, subject],
  );

  const handleSubjectChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setSubject(e.target.value);
    onUpdate?.(input, e.target.value);
  };

  const processSend = async (
    senderPublicKey: MajikMessagePublicKey,
    text: string,
  ): Promise<string> => {
    if (isDevEnvironment())
      console.log("[NewMailForm] Sending from:", senderPublicKey);

    if (!text?.trim()) throw new Error("A valid message is required.");
    if (!senderPublicKey?.trim())
      throw new Error("A valid sender key is required.");
    if (!participants || participants.length <= 1)
      throw new Error("Assign recipients first.");
    console.log("Pending Attachments: ", pendingAttachments);
    const subjectValue = subject?.trim() || undefined;

    // Pass ready MajikFile[] into the send call
    const sendMessageResponse = await majik.createThreadMail(
      thread,
      text,
      subjectValue,
      pendingAttachments.length > 0 ? pendingAttachments : undefined,
    );

    if (!sendMessageResponse?.mail.success) {
      throw new Error("There's a problem while sending the message.");
    }

    // Warn about partial upload failures without throwing
    if (
      pendingAttachments.length > 0 &&
      !sendMessageResponse.allAttachmentsUploaded
    ) {
      const failed = sendMessageResponse.attachments.filter((a) => !a.success);
      toast.warning(
        `Message sent, but ${failed.length} attachment${failed.length > 1 ? "s" : ""} failed to upload.`,
        {
          description: failed.map((a) => a.originalName ?? a.fileId).join(", "),
        },
      );
    }

    onSend?.(text, subjectValue);
    return sendMessageResponse.mail.message || "Message sent successfully!";
  };

  const handleSend = async (): Promise<void> => {
    const activeAccount = majik.currentIdentity;
    if (!activeAccount) return;
    if (!participants || participants.length <= 1) {
      toast.error("Assign recipients first.");
      return;
    }
    toast.promise(processSend(activeAccount.publicKey, input), {
      loading: "Encrypting and sending…",
      success: (msg) => msg,
      error: (err) => `${err.message}`,
    });
  };

  // Block send if files are still encrypting
  const canSend =
    input.trim().length > 0 && participants.length > 1 && !hasPendingEncryption;
  // Display names for To: field
  const toChips = participants.map((p) => ({
    id: p.id,
    label: p.meta?.label || p.id.slice(0, 6) + "…" + p.id.slice(-4),
  }));

  // Sender display
  const fromLabel = myAccount?.meta?.label || "You";

  return (
    <Root>
      {/* ── Header: From / To / Subject ── */}
      <ComposeHeader>
        {/* From */}
        <FieldRow>
          <FieldLabel>From</FieldLabel>
          <FieldValue>
            <ContactChip data-private>{fromLabel}</ContactChip>
          </FieldValue>
          <LockBadge>
            <LockSimpleIcon size={9} weight="fill" />
            ML-KEM-768
          </LockBadge>
        </FieldRow>

        {/* To */}
        <FieldRow>
          <FieldLabel>To</FieldLabel>
          <FieldValue data-private>
            {toChips.length === 0 ? (
              <span style={{ opacity: 0.35, fontSize: 12 }}>
                Loading participants…
              </span>
            ) : (
              toChips.map((c) => (
                <ContactChip key={c.id} data-private>
                  {c.label}
                </ContactChip>
              ))
            )}
          </FieldValue>
        </FieldRow>

        {/* Subject */}
        <FieldRow $borderless>
          <FieldLabel>Subj</FieldLabel>
          <SubjectWrap data-private>
            <SubjectInput
              value={subject}
              onChange={handleSubjectChange}
              placeholder="Subject (optional)"
              maxLength={80}
              data-private
            />
          </SubjectWrap>
        </FieldRow>
      </ComposeHeader>

      {/* ── Rich text editor body ── */}
      <ComposeBody>
        <MailInputBox
          onChange={handleBodyChange}
          placeholder="Write your message…"
        />
      </ComposeBody>

      {/* ── Attachment panel (collapse/expand) ── */}
      <AttachPanelWrap $open={attachPanelOpen}>
        <AttachPanelInner>
          <ThreadAttachments
            majik={majik}
            thread={thread}
            participants={participants}
            composeMode={true}
            onAttachmentsChange={handleAttachmentsChange}
            onEncryptingChange={handleEncryptionPending}
          />
        </AttachPanelInner>
      </AttachPanelWrap>

      {/* ── Footer toolbar ── */}
      <ComposeFooter>
        {/* Send */}
        <SendBtn $canSend={canSend} onClick={handleSend} disabled={!canSend}>
          <PaperPlaneRightIcon size={15} weight="bold" />
          Send
        </SendBtn>

        {/* Attachment toggle — show count badge when files are ready */}
        <FooterIconBtn
          $active={attachPanelOpen}
          onClick={() => setAttachPanelOpen((v) => !v)}
          title={attachPanelOpen ? "Hide attachments" : "Manage attachments"}
        >
          <PaperclipIcon
            size={16}
            weight={attachPanelOpen ? "fill" : "regular"}
          />
          {pendingAttachments.length > 0 && (
            <AttachmentCount>{pendingAttachments.length}</AttachmentCount> // ← uncomment + use
          )}
        </FooterIconBtn>

        <FooterSpacer />

        <EncryptedHint>
          <LockSimpleIcon size={9} weight="fill" />
          End-to-end encrypted
        </EncryptedHint>
      </ComposeFooter>
    </Root>
  );
};

export { NewMailForm };
export default NewMailForm;
