/**
 * ChatImageRenderer.tsx
 *
 * Renders an [img:${fileId}] tag embedded in a chat message.
 *
 * Pipeline (cache-aware):
 *   1. Check IDB cache (chatImageCache) for a fresh entry
 *      └─ HIT:  use cached binary + fileJSON, skip network calls
 *      └─ MISS: majik.downloadFileBinary(fileId) + majik.getFile(fileId)
 *               then write to IDB cache for future renders
 *   2. MajikFile.fromJSONWithBlob() → validate
 *   3. majik.decryptFile({ source }) → { bytes, mimeType, originalName }
 *   4. Create object URL → render <img>
 *
 * onReady(url, mimeType, originalName) fires once decryption completes.
 * CBaseChatBubble uses this to drive the "Download image" action without
 * re-fetching or re-decrypting.
 *
 * Lazy load: IntersectionObserver triggers the pipeline only when the
 * bubble scrolls within 200px of the viewport.
 *
 * Object URLs are revoked on unmount to prevent memory leaks.
 * IDB entries expire after 24 h (stale-on-read) and are purged after
 * 25 h (on DB open) — see chatImageCache.ts.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { MajikFile, MajikFileJSON } from "@majikah/majik-file";
import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import { WarningIcon, ArrowsOutIcon } from "@phosphor-icons/react";
import {
  getChatImageCache,
  setChatImageCache,
} from "@/lib/idb/chat-image-cache";
import { toast } from "sonner";
import DynamicPopUp from "../functional/DynamicPopUp";

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadPhase = "idle" | "loading" | "decrypting" | "ready" | "error";

export interface ChatImageReadyInfo {
  /** Blob object URL of the decrypted image — valid until component unmounts */
  objectUrl: string;
  /** MIME type returned by decryptFile, e.g. "image/webp" */
  mimeType: string;
  /** Original filename from file metadata, if present */
  originalName: string | null;
}

// ─── Animations ───────────────────────────────────────────────────────────────

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
`;

// ─── Styled components ────────────────────────────────────────────────────────

const Wrapper = styled.div<{ $maxWidth: number }>`
  position: relative;
  display: inline-block;
  max-width: ${({ $maxWidth }) => $maxWidth}px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  cursor: pointer;
`;

const Skeleton = styled.div<{ $width: number; $height: number }>`
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.secondaryBackground} 25%,
    ${({ theme }) => theme.colors.primaryBackground} 50%,
    ${({ theme }) => theme.colors.secondaryBackground} 75%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

const PhaseLabel = styled.div`
  position: absolute;
  bottom: 6px;
  left: 8px;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
`;

const StyledImg = styled.img<{ $visible: boolean }>`
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  animation: ${fadeIn} 250ms cubic-bezier(0.4, 0, 0.2, 1) both;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity 200ms ease;
  cursor: zoom-in;
`;

const ErrorBox = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(240, 100, 73, 0.08);
  border: 1px solid rgba(240, 100, 73, 0.2);
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: #f06449;
  max-width: 280px;
`;

const ExpandBtn = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  opacity: 0;
  transition: opacity 120ms ease;
  ${Wrapper}:hover & {
    opacity: 1;
  }
`;

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const LightboxImg = styled.img`
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 12px;
  object-fit: contain;
  box-shadow: 0 32px 96px rgba(0, 0, 0, 0.7);
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatImageRendererProps {
  /** The fileId extracted from [img:${fileId}] */
  fileId: string;
  conversationId: string;
  majik: MajikMessageDatabase;
  /** Max rendered width in px. Defaults to 320. */
  maxWidth?: number;
  /** Placeholder dimensions while loading. Defaults to 240×180. */
  placeholderWidth?: number;
  placeholderHeight?: number;
  /**
   * Fired once after the image is successfully decrypted and the object URL
   * is created. Use this to drive external actions (e.g. download button)
   * without re-fetching or re-decrypting.
   *
   * The object URL is only valid while this component is mounted — do not
   * store it beyond the component's lifetime.
   */
  onReady?: (info: ChatImageReadyInfo) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ChatImageRenderer: React.FC<ChatImageRendererProps> = ({
  fileId,
  conversationId,
  majik,
  maxWidth = 320,
  placeholderWidth = 240,
  placeholderHeight = 180,
  onReady,
}) => {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const hasFetchedRef = useRef(false);
  // Stable ref so load() doesn't need onReady in its dependency array
  const onReadyRef = useRef(onReady);

  const [imageInfo, setImageInfo] = useState<{
    objectUrl: string;
    mimeType: string;
    originalName: string | null;
  } | null>(null);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // ── Cleanup object URL on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // ── Lightbox keyboard close ───────────────────────────────────────────────
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxOpen]);

  // ── Load pipeline ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (hasFetchedRef.current) return;

    hasFetchedRef.current = true;
    setPhase("loading");

    try {
      // ── Step 1 & 2: binary + fileJSON (cache-aware) ──────────────────────
      let binary: Uint8Array;
      let fileJSON: MajikFileJSON;

      const cached = await getChatImageCache(fileId);

      if (cached) {
        binary = cached.binary;
        fileJSON = cached.fileJSON;
      } else {
        [binary, fileJSON] = await Promise.all([
          majik.downloadFileBinary(fileId),
          majik.getConversationFile(conversationId, fileId),
        ]);

        setChatImageCache(fileId, binary, fileJSON).catch((e) =>
          console.warn("[ChatImageRenderer] cache write failed:", e),
        );
      }

      // ── Step 3: Hydrate + validate ───────────────────────────────────────
      const instance = await MajikFile.fromJSONWithBlob(
        fileJSON,
        new Blob([binary as BlobPart], { type: "application/octet-stream" }),
      );
      instance.validate();

      // ── Step 4: Decrypt ──────────────────────────────────────────────────
      setPhase("decrypting");
      const decrypted = await majik.decryptFile({ source: binary });

      // ── Step 5: Build object URL ─────────────────────────────────────────
      const mimeType = decrypted.mimeType ?? "image/webp";
      const blob = new Blob([decrypted.bytes as BlobPart], { type: mimeType });
      const url = URL.createObjectURL(blob);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = url;
      setObjectUrl(url);
      setPhase("ready");

      setImageInfo({
        objectUrl: url,
        mimeType,
        originalName: decrypted.originalName ?? null,
      });

      // ── Notify parent ────────────────────────────────────────────────────
      onReadyRef.current?.({
        objectUrl: url,
        mimeType,
        originalName: decrypted.originalName ?? null,
      });
    } catch (err) {
      console.error("[ChatImageRenderer] load error:", err);
      hasFetchedRef.current = false;
      setPhase("error");

      const code = (err as { code?: string })?.code;
      if (code === "NOT_FOUND") {
        setError(
          "This image is no longer available. It may have been deleted by the sender.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to load image.");
      }
    }
  }, [conversationId, fileId, majik]);

  // ── IntersectionObserver — lazy load when scrolled into view ─────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [load]);

  const handleDownloadImage = (): void => {
    if (!imageInfo) {
      toast.error("Image not ready", {
        description: "Please wait for the image to finish loading.",
        id: `toast-error-imgdl`,
      });
      return;
    }

    const ext = extensionFromMime(imageInfo.mimeType);
    const filename = imageInfo.originalName ?? `majik-image.${ext}`;

    const a = document.createElement("a");
    a.href = imageInfo.objectUrl;
    a.download = filename;
    a.click();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "error") {
    return (
      <ErrorBox>
        <WarningIcon size={13} />
        {error ?? "Could not load image."}
      </ErrorBox>
    );
  }

  return (
    <>
      <Wrapper
        ref={wrapperRef}
        $maxWidth={maxWidth}
        onClick={() => {
          if (phase === "ready") setLightboxOpen(true);
        }}
        title={phase === "ready" ? "Click to expand" : undefined}
      >
        {phase !== "ready" && (
          <Skeleton $width={placeholderWidth} $height={placeholderHeight} />
        )}

        {phase === "loading" && <PhaseLabel>Fetching…</PhaseLabel>}
        {phase === "decrypting" && <PhaseLabel>Decrypting…</PhaseLabel>}

        {objectUrl && (
          <StyledImg
            src={objectUrl}
            alt="Chat image"
            $visible={phase === "ready"}
            data-private
          />
        )}

        {phase === "ready" && (
          <ExpandBtn
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(true);
            }}
            title="View full size"
          >
            <ArrowsOutIcon size={13} />
          </ExpandBtn>
        )}
      </Wrapper>

      <DynamicPopUp
        scrollable={false}
        isOpen={lightboxOpen}
        onOpenChange={setLightboxOpen}
        modal={{
          title: imageInfo?.originalName || "Image Preview",
          description: imageInfo?.objectUrl || "",
        }}
        buttons={{
          cancel: {
            text: "Close",
          },
          confirm: {
            text: "Download",
            isDisabled: !imageInfo,
            onClick: handleDownloadImage,
          },
        }}
      >
        {lightboxOpen && objectUrl && (
          <LightboxImg
            src={objectUrl}
            alt="Chat image (full size)"
            onClick={(e) => e.stopPropagation()}
            data-private
          />
        )}
      </DynamicPopUp>
    </>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives a sensible download filename from the MIME type.
 * Falls back to "image" if the type is unrecognised.
 */
function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/heic": "heic",
  };
  return map[mimeType] ?? "image";
}
