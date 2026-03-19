import React, { useCallback, useEffect, useState } from "react";
import styled, { css } from "styled-components";
import {
  ArrowSquareOutIcon,
  BracketsCurlyIcon,
  CaretDownIcon,
  CopyIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FilePdfIcon,
  FileVideoIcon,
  FileZipIcon,
  PaperclipIcon,
  TextAaIcon,
} from "@phosphor-icons/react";
import moment from "moment";
import { MessageEnvelope, type MajikMessageMail } from "@majikah/majik-message";
import type {
  MailAttachmentRef,
  MajikMessagePublicKey,
  MajikMessageThread,
} from "@majikah/majik-message";
import type { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";

import { toast } from "sonner";
import StyledIconButton from "@/components/foundations/StyledIconButton";
import { MajikFile } from "@majikah/majik-file";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkIns from "remark-ins";
import remarkFlexibleMarkers from "remark-flexible-markers";
import { downloadBlob } from "@/utils/utils";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";
// ─── Pill shared base ─────────────────────────────────────────────────────────
const pillBase = css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  line-height: 1.6;
`;

// ─── Root card ────────────────────────────────────────────────────────────────
const Card = styled.div<{ $isUnread: boolean }>`
  width: 100%;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid
    ${({ theme, $isUnread }) =>
      $isUnread
        ? `${theme.colors.primary}40`
        : theme.colors.secondaryBackground};
  border-radius: 10px;
  overflow: hidden;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;

  &:hover {
    border-color: ${({ theme, $isUnread }) =>
      $isUnread
        ? `${theme.colors.primary}70`
        : theme.colors.secondaryBackground};
  }
`;

// ─── Shared header row ────────────────────────────────────────────────────────
const HeaderRow = styled.div<{ $clickable: boolean }>`
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};
  transition: background 150ms ease;
  user-select: none;
  overflow: hidden;

  &:hover {
    background: ${({ theme, $clickable }) =>
      $clickable ? theme.colors.secondaryBackground : "transparent"};
    box-shadow: 0 3px 16px rgba(0, 0, 0, 0.2);
  }
`;

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = styled.div<{ $hue: number }>`
  width: 30px;
  height: 30px;
  min-width: 30px;
  border-radius: 50%;
  background: hsl(${({ $hue }) => $hue}, 38%, 26%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.72);
  user-select: none;
  flex-shrink: 0;
`;

// ─── Caret toggle ────────────────────────────────────────────────────────────
const Caret = styled.div<{ $isExpanded: boolean; $disabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  transform: rotate(${({ $isExpanded }) => ($isExpanded ? "180deg" : "0deg")});
  transition: transform 200ms ease;
  opacity: ${({ $disabled }) => ($disabled ? 0.3 : 1)};
`;

// ─── Header body ──────────────────────────────────────────────────────────────
const HeaderBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const SenderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
`;

const SenderName = styled.span<{ $bold: boolean }>`
  font-size: 13px;
  font-weight: ${({ $bold }) => ($bold ? 700 : 500)};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const KeyChip = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
`;

const RecipientsLine = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.7;
`;

const Preview = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.65;
`;

// ─── Header right ─────────────────────────────────────────────────────────────
const HeaderRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  flex-shrink: 0;
`;

const Timestamp = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.04em;
  white-space: nowrap;
`;

const ReadPill = styled.span<{ $isRead: boolean }>`
  ${pillBase}
  ${({ theme, $isRead }) =>
    $isRead
      ? css`
          background: ${theme.colors.secondaryBackground};
          color: ${theme.colors.textSecondary};
          border: 1px solid transparent;
        `
      : css`
          background: ${theme.colors.primary};
          color: #fff;
        `}
`;

// ─── Metadata band ────────────────────────────────────────────────────────────
const MetaBand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 9px 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-top: 1px solid rgba(255, 255, 255, 0.04);
`;

const MetaRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

const MetaLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  min-width: 72px;
  flex-shrink: 0;
`;

const MetaValue = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

// ─── Message body ─────────────────────────────────────────────────────────────
const Body = styled.div`
  padding: 16px;
  font-size: 13px;
  line-height: 1.75;
  color: ${({ theme }) => theme.colors.textPrimary};
  word-wrap: break-word; // ← keep this
  // white-space: pre-wrap;       // ← remove this
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  user-select: text;

  p {
    user-select: text;
    margin: 0 0 0.75em;
    &:last-child {
      margin-bottom: 0;
    }
  }

  ul {
    list-style: disc;
    padding-left: 20px;
    margin: 0 0 8px;
  }
  ol {
    list-style: decimal;
    padding-left: 20px;
    margin: 0 0 8px;
  }
  li {
    margin: 2px 0;
  }

  blockquote {
    border-left: 3px solid ${({ theme }) => theme.colors.primary}55;
    padding-left: 12px;
    margin: 8px 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-style: italic;
  }

  hr {
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.textSecondary};
    margin: 12px 0;
  }

  ins {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  mark {
    background: ${({ theme }) => theme.colors.primary}33;
    color: ${({ theme }) => theme.colors.textPrimary};
    padding: 0 2px;
    border-radius: 2px;
  }
`;
// ─── Action bar ───────────────────────────────────────────────────────────────
const ActionBar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.secondaryBackground}33;
`;

// ─── Attachment compact pill (collapsed / header) ─────────────────────────────
/**
 * Shown in the header right area when collapsed and attachments exist.
 * Keeps the row minimal — just a paperclip + count.
 */
const AttachmentBadge = styled.span`
  ${pillBase}
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
  border: 1px solid rgba(255, 255, 255, 0.06);
  gap: 3px;
  font-size: 9px;
`;

// ─── Attachment section (expanded) ───────────────────────────────────────────
const AttachmentSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  padding: 10px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const AttachmentSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
`;

const AttachmentSectionLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

const AttachmentCount = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

// ─── Individual attachment row ────────────────────────────────────────────────
const AttachmentRow = styled.button`
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.secondaryBackground}66;
  border: 1px solid rgba(255, 255, 255, 0.04);
  transition:
    background 130ms ease,
    border-color 130ms ease;

  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-color: rgba(255, 255, 255, 0.09);
  }

  &:active {
    opacity: 0.75;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

const AttachmentIconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
`;

const AttachmentInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const AttachmentName = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AttachmentMeta = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  letter-spacing: 0.02em;
`;

const AttachmentDownloadIcon = styled.div`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
  flex-shrink: 0;
  transition: opacity 130ms ease;

  ${AttachmentRow}:hover & {
    opacity: 0.7;
  }
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface ThreadMailProps {
  majik: MajikMessageDatabase;
  thread: MajikMessageThread;
  mail: MajikMessageMail;
  currentUserPublicKey: MajikMessagePublicKey;
  isLatest: boolean;
  isSingle: boolean;
  displayNames?: Record<string, string>;
  onToggleStar?: (mailId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ThreadMail: React.FC<ThreadMailProps> = ({
  majik,
  thread,
  mail,
  currentUserPublicKey,
  isLatest,
  isSingle,
  displayNames = {},
}) => {
  const [isExpanded, setIsExpanded] = useState(isLatest);
  const [text, setText] = useState<string>("");
  const [subject, setSubject] = useState<string>(
    mail.metadata?.subject || thread?.metadata?.subject || "(No Subject)",
  );

  const canCollapse = !isLatest && !isSingle;

  // ── Decrypt ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let envelope: MessageEnvelope;
    let encryptedSubject: MessageEnvelope;

    try {
      envelope = MessageEnvelope.fromMatchedString(mail.message);
    } catch {
      return;
    }
    if (!envelope) return;

    majik
      .decryptEnvelope(envelope)
      .then((msg) => {
        if (mounted) setText(msg);
      })
      .catch(() => {
        if (mounted) setText("[Unable to decrypt message]");
      });

    if (mail?.metadata?.subject?.trim()) {
      try {
        encryptedSubject = MessageEnvelope.fromMatchedString(
          mail.metadata.subject,
        );
      } catch {
        return;
      }
      if (!encryptedSubject) return;

      majik
        .decryptEnvelope(encryptedSubject)
        .then((msg) => {
          if (mounted) setSubject(msg);
        })
        .catch(() => {
          if (mounted) setSubject("[Unable to decrypt subject]");
        });
    } else {
      try {
        encryptedSubject = MessageEnvelope.fromMatchedString(
          thread.metadata.subject,
        );
      } catch {
        return;
      }
      if (!encryptedSubject) return;

      majik
        .decryptEnvelope(encryptedSubject)
        .then((msg) => {
          if (mounted) setSubject(msg);
        })
        .catch(() => {
          if (mounted) setSubject("[Unable to decrypt subject]");
        });
    }

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mail.message, mail.metadata.subject]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleExpand = (): void => {
    if (canCollapse) setIsExpanded((prev) => !prev);
  };

  const handleCopy = useCallback(() => {
    if (!mail.message?.trim()) {
      toast.error("Failed to copy to clipboard", {
        description: "No text to copy.",
        id: "toast-error-copy",
      });
      return;
    }
    try {
      navigator.clipboard.writeText(mail.message);
      toast.success("Copied to clipboard", {
        description:
          mail.message.length > 200
            ? mail.message.slice(0, 200) + "…"
            : mail.message,
        id: `toast-success-copy-${mail.message}`,
      });
    } catch (e) {
      toast.error("Failed to copy to clipboard", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-copy-${mail?.message}`,
      });
    }
  }, [mail.message]);

  const handleDownloadTxt = async (): Promise<void> => {
    const blob = new Blob([mail.message], { type: "application/octet-stream" });
    const sender = await majik.getContactByPublicKey(mail.sender);
    downloadBlob(
      blob,
      "txt",
      `Mail Message from ${sender?.meta?.label ?? mail.sender}_${mail.id}_${mail.timestamp.toLocaleDateString()}`,
    );
  };

  const handleDownloadJson = async (): Promise<void> => {
    const blob = new Blob(
      [JSON.stringify({ original: text, encrypted: mail.message })],
      {
        type: "application/json;charset=utf-8",
      },
    );
    const sender = await majik.getContactByPublicKey(mail.sender);
    downloadBlob(
      blob,
      "json",
      `Mail Message from ${sender?.meta?.label ?? mail.sender}_${mail.id}_${mail.timestamp.toLocaleDateString()}`,
    );
  };

  // ── Placeholder — wire this up later ─────────────────────────────────────

  const handleDownloadAttachment = (_attachment: MailAttachmentRef): void => {
    toast.promise(
      (async () => {
        const binary = await majik.downloadFileBinary(_attachment.fileId);
        const blob = new Blob([binary as BlobPart], {
          type: "application/octet-stream",
        });
        const fileJSON = await majik.getFile(_attachment.fileId);
        const instance = await MajikFile.fromJSONWithBlob(fileJSON, blob);
        instance.validate();
        const decrypted = await majik.decryptFile({
          source: binary,
        });
        const downloadBlob = new Blob([decrypted.bytes as BlobPart], {
          type: decrypted.mimeType ?? "application/octet-stream",
        });
        // const mjkb = instance.toMJKB()
        const url = URL.createObjectURL(downloadBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          decrypted.originalName ??
          _attachment.originalName ??
          "Downloaded File";
        a.click();
        URL.revokeObjectURL(url);
        return `Downloaded "${_attachment.originalName}"`;
      })(),
      {
        loading: `Downloading…`,
        success: (msg) => msg,
        error: (err) => {
          if (err.code === "NOT_FOUND") {
            return "This file is no longer available for download. It may have been deleted by the sender.";
          }
          return (
            err.message ||
            "There seems to be a problem while downloading this file."
          );
        },
      },
    );
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const senderKey = mail.sender;
  const senderName = displayNames[senderKey] || senderKey;
  const isOwn = mail.isSender(currentUserPublicKey);
  const hasUserRead = mail.hasUserRead(currentUserPublicKey);
  const isUnread = !hasUserRead && !isOwn;

  const recipientNames = mail.recipients
    .map((key) => displayNames[key] || key)
    .join(", ");

  const timestamp = moment(mail.timestamp);
  const relativeTime = timestamp.fromNow();
  const fullTime = timestamp.format("MMM D, YYYY [at] h:mm A");

  const priority = mail.metadata?.priority;
  const attachments = mail.attachments; // typed MailAttachmentRef[]

  const hasAttachments = attachments.length > 0;
  const hasMetadata = subject || priority;

  const avatarHue = getHue(senderName);
  const initials = getInitials(senderName);
  const shortKey = shortenKey(senderKey);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card $isUnread={isUnread}>
      {/* ── Header ── */}
      <HeaderRow $clickable={canCollapse} onClick={handleToggleExpand}>
        <Caret $isExpanded={isExpanded} $disabled={!canCollapse}>
          <CaretDownIcon size={14} />
        </Caret>

        <Avatar $hue={avatarHue} data-private>
          {initials}
        </Avatar>

        <HeaderBody>
          <SenderRow>
            <SenderName $bold={isUnread} data-private>
              {senderName}
            </SenderName>
            {isExpanded && <KeyChip data-private>{shortKey}</KeyChip>}
            {isUnread && !isExpanded && (
              <ReadPill $isRead={false}>New</ReadPill>
            )}
          </SenderRow>

          {isExpanded ? (
            recipientNames && (
              <RecipientsLine data-private>to {recipientNames}</RecipientsLine>
            )
          ) : (
            <Preview data-private>{stripMarkdown(text)}</Preview>
          )}
        </HeaderBody>

        <HeaderRight>
          <Timestamp title={fullTime}>{relativeTime}</Timestamp>
          {/* Compact attachment badge — only when collapsed and attachments exist */}
          {!isExpanded && hasAttachments && (
            <AttachmentBadge>
              <PaperclipIcon size={9} weight="bold" />
              {attachments.length}
            </AttachmentBadge>
          )}
          {isExpanded && !isOwn && (
            <ReadPill $isRead={hasUserRead}>
              {hasUserRead ? "Read" : "Unread"}
            </ReadPill>
          )}
        </HeaderRight>
      </HeaderRow>

      {/* ── Metadata band (subject / priority only — attachments have own section) ── */}
      {isExpanded && hasMetadata && (
        <MetaBand>
          {subject && (
            <MetaRow>
              <MetaLabel>Subject</MetaLabel>
              <MetaValue data-private>{subject}</MetaValue>
            </MetaRow>
          )}
          {priority && (
            <MetaRow>
              <MetaLabel>Priority</MetaLabel>
              <MetaValue style={{ textTransform: "capitalize" }}>
                {priority}
              </MetaValue>
            </MetaRow>
          )}
        </MetaBand>
      )}

      {/* ── Message body ── */}
      {isExpanded && (
        <Body data-private>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkIns, remarkFlexibleMarkers]}
          >
            {text}
          </ReactMarkdown>
        </Body>
      )}

      {/* ── Attachments section (expanded only) ── */}
      {isExpanded && hasAttachments && (
        <AttachmentSection>
          <AttachmentSectionHeader>
            <PaperclipIcon
              size={11}
              weight="bold"
              color="currentColor"
              style={{ opacity: 0.4 }}
            />
            <AttachmentSectionLabel>Attachments</AttachmentSectionLabel>
            <AttachmentCount>({attachments.length})</AttachmentCount>
          </AttachmentSectionHeader>

          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.fileId}
              onClick={() => handleDownloadAttachment(attachment)}
              title={`Download ${attachment.originalName ?? attachment.fileId}`}
              data-private
            >
              <AttachmentIconWrap>
                <AttachmentFileIcon mimeType={attachment.mimeType} />
              </AttachmentIconWrap>

              <AttachmentInfo>
                <AttachmentName data-private>
                  {attachment.originalName ?? attachment.fileId}
                </AttachmentName>
                <AttachmentMeta>
                  {formatFileSize(attachment.sizeOriginal)}
                  {attachment.mimeType && (
                    <>
                      {" "}
                      · <span data-private>{attachment.mimeType}</span>
                    </>
                  )}
                </AttachmentMeta>
              </AttachmentInfo>

              <AttachmentDownloadIcon>
                <ArrowSquareOutIcon size={13} weight="bold" />
              </AttachmentDownloadIcon>
            </AttachmentRow>
          ))}
        </AttachmentSection>
      )}

      {/* ── Action bar ── */}
      {isExpanded && (
        <ActionBar>
          <StyledIconButton
            onClick={handleCopy}
            aria-label="Copy encrypted message"
            icon={CopyIcon}
            title="Copy encrypted message to clipboard"
            size={22}
          />
          <StyledIconButton
            onClick={handleDownloadTxt}
            aria-label="Download as .txt"
            icon={TextAaIcon}
            title="Download encrypted message as .txt"
            size={22}
          />
          <StyledIconButton
            onClick={handleDownloadJson}
            aria-label="Download as .json"
            icon={BracketsCurlyIcon}
            title="Download encrypted message as .json"
            size={22}
          />
        </ActionBar>
      )}
    </Card>
  );
};

export default ThreadMail;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function shortenKey(key: string, chars = 4): string {
  const s = String(key);
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

/**
 * Formats a byte count into a human-readable size string.
 * Auto-selects the most appropriate unit.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Returns the appropriate Phosphor icon for a given MIME type.
 */
function AttachmentFileIcon({
  mimeType,
}: {
  mimeType: string | null;
}): React.ReactElement {
  const size = 14;

  if (!mimeType) return <FileIcon size={size} />;

  if (mimeType.startsWith("image/")) return <FileImageIcon size={size} />;
  if (mimeType === "application/pdf") return <FilePdfIcon size={size} />;
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/x-7z-compressed"
  )
    return <FileZipIcon size={size} />;
  if (mimeType.startsWith("video/")) return <FileVideoIcon size={size} />;
  if (mimeType.startsWith("audio/")) return <FileAudioIcon size={size} />;
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("javascript") ||
    mimeType.includes("json") ||
    mimeType.includes("xml")
  )
    return <FileCodeIcon size={size} />;

  return <FileIcon size={size} />;
}

function stripMarkdown(md: string): string {
  if (!md) return "";

  // Normalize, split, find first meaningful line
  const firstLine =
    md
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !/^[-*_]{3,}$/.test(l)) ?? // skip blank lines and hr
    "";

  // Strip markdown syntax from just that one line
  return firstLine
    .replace(/^#{1,6}\s*/, "") // leading heading
    .replace(/^>\s*/, "") // leading blockquote
    .replace(/^\s*[-*+]\s+/, "") // bullet
    .replace(/^\s*\d+\.\s+/, "") // ordered list
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1") // italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .replace(/==(.*?)==/g, "$1") // highlight
    .replace(/\+\+(.*?)\+\+/g, "$1") // underline
    .replace(/`[^`]*`/g, "") // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/[#~`*_>]/g, "") // nuke remaining
    .trim();
}
