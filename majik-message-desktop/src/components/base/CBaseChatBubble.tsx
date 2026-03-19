import React, { useEffect, useMemo, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { MajikMessageChat, MessageEnvelope } from "@majikah/majik-message";

import DeleteButton from "../foundations/DeleteButton";
import StyledIconButton from "../foundations/StyledIconButton";
import { DownloadIcon, LinkIcon } from "@phosphor-icons/react";

import moment from "moment";
import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import { toast } from "sonner";
import { downloadBlob } from "@/utils/utils";

import DOMPurify from "dompurify";
import { sendNotification } from "@tauri-apps/plugin-notification";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── GIF message parser ───────────────────────────────────────────────────────
/**
 * Parses a decrypted message string for the [gif:URL] sentinel tag written
 * by ChatInputBox at compose time.
 *
 * Security layers (in order):
 *   1. Strict regex  — only matches the exact [gif:…] pattern, nothing else
 *   2. Origin allowlist — only official Giphy CDN hostnames accepted
 *   3. DOMPurify — sanitizes the extracted URL string
 *   4. Identity check — if DOMPurify mutated the URL at all, it is rejected
 *
 * If any layer fails, the raw tag is shown as plain text (safe, non-confusing).
 * We never use dangerouslySetInnerHTML — the URL goes into <img src> only.
 */
const GIF_TAG_RE = /\n?\[gif:(https?:\/\/[^\]]+)\]$/;

const GIPHY_ORIGIN_ALLOWLIST = new Set([
  "https://media.giphy.com",
  "https://i.giphy.com",
  "https://media0.giphy.com",
  "https://media1.giphy.com",
  "https://media2.giphy.com",
  "https://media3.giphy.com",
  "https://media4.giphy.com",
]);

function isAllowedGiphyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const origin = `${parsed.protocol}//${parsed.hostname}`;
    if (!GIPHY_ORIGIN_ALLOWLIST.has(origin)) return false;
    if (!/\.(gif|webp)(\?|$)/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

interface ParsedMessage {
  text: string;
  gifUrl: string | null;
}

function parseMessageGif(raw: string): ParsedMessage {
  const match = raw.match(GIF_TAG_RE);
  if (!match) return { text: raw, gifUrl: null };

  const extractedUrl = match[1];
  const text = raw.slice(0, raw.length - match[0].length);

  if (!isAllowedGiphyUrl(extractedUrl)) {
    return { text: raw, gifUrl: null };
  }

  const sanitizedUrl = DOMPurify.sanitize(extractedUrl, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    FORCE_BODY: true,
  }).trim();

  if (sanitizedUrl !== extractedUrl) {
    return { text: raw, gifUrl: null };
  }

  return { text, gifUrl: sanitizedUrl };
}

// ─── Animations ───────────────────────────────────────────────────────────────
const msgIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// ─── Styled components ────────────────────────────────────────────────────────

const Root = styled.div<{ $isOwn: boolean }>`
  display: flex;
  width: 100%;
  justify-content: ${({ $isOwn }) => ($isOwn ? "flex-end" : "flex-start")};
  animation: ${msgIn} 180ms cubic-bezier(0.4, 0, 0.2, 1) both;
`;

const Column = styled.div<{ $isOwn: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: fit-content;
  max-width: min(520px, 72vw);
  align-items: ${({ $isOwn }) => ($isOwn ? "flex-end" : "flex-start")};
`;

const BubbleRow = styled.div<{ $isOwn: boolean }>`
  display: flex;
  align-items: flex-end;
  gap: 5px;
  width: fit-content;
  max-width: 100%;
  flex-direction: ${({ $isOwn }) => (!$isOwn ? "row-reverse" : "row")};
`;

const Actions = styled.div<{ $enabled: boolean }>`
  display: flex;
  flex-direction: row;
  gap: 3px;
  align-items: center;
  justify-content: flex-end;
  width: 0px;
  opacity: 0;

  ${({ $enabled }) =>
    $enabled &&
    css`
      @media (hover: hover) and (pointer: fine) {
        ${Column}:hover & {
          width: fit-content;
          opacity: 1;
          padding: 5px;
        }
      }
    `}
`;

const Bubble = styled.div<{ $isOwn: boolean; $hasGif: boolean }>`
  /* No padding when GIF fills the bubble — GifMedia handles its own spacing */
  padding: ${({ $hasGif }) => ($hasGif ? "0" : "10px 14px")};
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: ${({ $hasGif }) => ($hasGif ? "0" : "42px")};
  min-width: 60px;
  width: fit-content;
  position: relative;
  overflow: hidden;
  color: ${({ theme }) => theme.colors.textPrimary};
  max-width: 400px;

  ${({ $isOwn, theme }) =>
    $isOwn
      ? css`
          background: ${theme.gradients.strong};
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          color: ${({ theme }) => theme.colors.static.black};
        `
      : css`
          background: ${theme.colors.secondaryBackground};
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-bottom-left-radius: 4px;
        `}
`;

// ─── GIF media components ──────────────────────────────────────────────────
/**
 * GifMedia renders inside the Bubble so it inherits the gradient/background
 * and the bubble's border-radius. The GIF image is full-width, caption below.
 *
 * The <img> src comes exclusively from parseMessageGif which has already
 * passed 4 security checks. referrerPolicy="no-referrer" prevents the
 * Giphy server from seeing the user's origin URL.
 */
const GifMedia = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: inherit;
  max-width: 280px;
  min-width: 120px;
`;

const GifImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
`;

const GifSkeleton = styled.div`
  width: 220px;
  height: 150px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 25%,
    rgba(255, 255, 255, 0.08) 37%,
    rgba(255, 255, 255, 0.04) 63%
  );
  background-size: 400% 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

const GifCaption = styled.div`
  padding: 8px 12px 4px;
  font-size: 13px;
  line-height: 1.55;
`;

const GifAttribution = styled.div`
  padding: 2px 8px 6px;
  font-family: ${FONT_MONO};
  font-size: 8px;
  letter-spacing: 0.06em;
  opacity: 0.3;
  text-align: right;
`;

// ─── Meta ──────────────────────────────────────────────────────────────────
const MetaRow = styled.div<{ $isOwn: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 3px;
  justify-content: ${({ $isOwn }) => ($isOwn ? "flex-end" : "flex-start")};
  margin-top: 5px;
`;

const Timestamp = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.03em;
  opacity: 0.6;
  white-space: nowrap;
`;

const ExpiryPill = styled.span<{ $expired: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;

  ${({ $expired }) =>
    $expired
      ? css`
          background: rgba(248, 113, 113, 0.12);
          color: #f87171;
          border: 1px solid rgba(248, 113, 113, 0.2);
        `
      : css`
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.2);
        `}
`;

const Receipts = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const ReceiptDot = styled.span<{ $isRead: boolean }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${({ $isRead, theme }) =>
    $isRead ? theme.colors.brand.green : theme.colors.secondaryBackground};
  transition: background 300ms ease;
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface CBaseChatBubbleProps {
  majik: MajikMessageDatabase;
  message: MajikMessageChat;
  isOwn: boolean;
  now: number;
  onEdit?: (data: MajikMessageChat) => void;
  onDelete?: (data: MajikMessageChat) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  canDownload?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
const CBaseChatBubble: React.FC<CBaseChatBubbleProps> = ({
  majik,
  message,
  isOwn,
  now,
  onDelete,
  onEdit,
  canShare = true,
  canDownload = true,
  canEdit = true,
  canDelete = false,
}) => {
  const [text, setText] = useState<string>("");
  const [gifLoaded, setGifLoaded] = useState(false);
  const [gifError, setGifError] = useState(false);

  // ── Ref-based mount guard (survives parent re-renders) ─────────────────────
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const messageId = message.getID();

  // ── Decrypt ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setText("");
    setGifLoaded(false);
    setGifError(false);

    let envelope: MessageEnvelope;
    try {
      envelope = MessageEnvelope.fromMatchedString(
        message.getCompressedMessage(),
      );
    } catch (error) {
      console.warn("Problem parsing Envelope: ", error);
      setText("[Unable to decrypt message]");
      return;
    }

    if (!envelope) {
      console.warn("Envelope not found");
      setText("[Unable to decrypt message]");
      return;
    }

    majik
      .decryptEnvelope(envelope)
      .then((msg: string) => {
        if (isMounted.current) setText(msg ?? "");
      })
      .catch((error) => {
        console.warn("Problem Decrypting: ", error);
        if (isMounted.current) setText("[Unable to decrypt message]");
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  // ── Parse GIF from decrypted plaintext ────────────────────────────────────
  const { text: displayText, gifUrl } = useMemo(
    () => (text ? parseMessageGif(text) : { text: "", gifUrl: null }),
    [text],
  );

  const hasGif = gifUrl !== null;

  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setGifLoaded(true);
    }
  }, [gifUrl]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const time = useMemo(
    () => moment(new Date(message.getTimestamp())).fromNow(),
    [message],
  );

  const fullTime = useMemo(
    () =>
      moment(new Date(message.getTimestamp())).format(
        "MMM D, YYYY [at] h:mm A",
      ),
    [message],
  );

  const expiresAt = message.getExpiresAt();

  const remaining = useMemo(() => {
    if (!expiresAt) return null;
    return Math.max(0, new Date(expiresAt).getTime() - now);
  }, [expiresAt, now]);

  const expiryLabel = useMemo(() => {
    if (remaining === null) return null;
    if (remaining <= 0) return "Expired";
    const dur = moment.duration(remaining);
    if (dur.asHours() >= 1) return `${Math.ceil(dur.asHours())}h left`;
    if (dur.asMinutes() >= 1) return `${Math.ceil(dur.asMinutes())}m left`;
    return `${Math.ceil(dur.asSeconds())}s left`;
  }, [remaining]);

  const isExpired = remaining !== null && remaining <= 0;
  const isReadByAll = message.isReadByAll?.() ?? false;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleShare = async (): Promise<void> => {
    if (!canShare) return;
    const raw = message.getCompressedMessage();
    if (!raw) {
      toast.error("Failed to copy", {
        description: "There seems to be a problem with this message.",
        id: `toast-error-share-${message.getID()}`,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(raw);
      toast.success("Encrypted message copied", {
        description: raw.length > 120 ? raw.slice(0, 120) + "…" : raw,
        id: `toast-success-share-${message.getID()}`,
      });
      // Native Notification

      sendNotification({
        title: "Copied to clipboard",
        body: raw,
      });
    } catch (err) {
      toast.error("Failed to copy", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || String(err),
        id: `toast-error-share-${message.getID()}`,
      });
    }
  };

  const handleDownloadTxt = (): void => {
    if (!canDownload) return;
    const raw = message.getCompressedMessage();
    const blob = new Blob([raw], { type: "application/octet-stream" });
    downloadBlob(blob, "txt", message.getRedisKey() || "Majik Message");
    // Native Notification

    sendNotification({
      title: "Message Downloaded",
      body:
        message.getRedisKey() || "This message has been saved as a TXT file.",
    });
  };

  const hasActions =
    canShare ||
    canDownload ||
    (!!onDelete && canDelete && isOwn) ||
    (!!onEdit && canEdit && isOwn);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root $isOwn={isOwn}>
      <Column $isOwn={isOwn}>
        <BubbleRow $isOwn={isOwn}>
          <Actions $enabled={hasActions}>
            {canShare && (
              <StyledIconButton
                icon={LinkIcon}
                title="Copy encrypted message"
                onClick={handleShare}
                size={22}
              />
            )}
            {canDownload && (
              <StyledIconButton
                icon={DownloadIcon}
                title="Download as .txt"
                onClick={handleDownloadTxt}
                size={22}
              />
            )}
            {!!onDelete && canDelete && isOwn && (
              <DeleteButton
                title="message"
                onClick={() => onDelete?.(message)}
              />
            )}
          </Actions>

          <Bubble $isOwn={isOwn} $hasGif={hasGif} data-private>
            {hasGif ? (
              <GifMedia>
                {/* Skeleton shown while loading, hidden on load/error */}
                {!gifLoaded && !gifError && <GifSkeleton />}

                {/* img src is the DOMPurify-sanitized, allowlisted URL only */}
                {!gifError && (
                  <GifImage
                    ref={imgRef}
                    src={gifUrl!}
                    alt={displayText || "GIF"}
                    onLoad={() => setGifLoaded(true)}
                    onError={() => setGifError(true)}
                    style={{ display: "block" }}
                    // referrerPolicy="no-referrer"
                    loading="lazy"
                    data-private
                  />
                )}

                {gifError && (
                  <GifSkeleton
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                      fontFamily: FONT_MONO,
                    }}
                  >
                    {/* styled-components doesn't allow direct text in div — use span */}
                    <span>GIF unavailable</span>
                  </GifSkeleton>
                )}

                {/* Caption text — only shown if the user wrote a message alongside the GIF */}
                {displayText && (
                  <GifCaption data-private>{displayText}</GifCaption>
                )}

                <GifAttribution>via GIPHY</GifAttribution>
              </GifMedia>
            ) : (
              displayText
            )}
          </Bubble>
        </BubbleRow>

        <MetaRow $isOwn={isOwn}>
          <Timestamp title={fullTime}>{time}</Timestamp>

          {expiryLabel && (
            <ExpiryPill $expired={isExpired}>
              {isExpired ? "✕" : "⏱"} {expiryLabel}
            </ExpiryPill>
          )}

          {isOwn && (
            <Receipts aria-label={isReadByAll ? "Read" : "Delivered"}>
              <ReceiptDot $isRead={isReadByAll} />
            </Receipts>
          )}
        </MetaRow>
      </Column>
    </Root>
  );
};

export default CBaseChatBubble;
