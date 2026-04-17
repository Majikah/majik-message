/**
 * FileAttachmentRenderer.tsx
 *
 * Renders a [file:<uuid>] token embedded in a chat message.
 * Mirrors the ChatImageRenderer pattern: lazy-loads via IntersectionObserver,
 * shows a skeleton while fetching, and fires onReady once the record is loaded.
 *
 * Exposes two download actions:
 *   - Download raw .mjkb  → streams the encrypted binary directly from R2 (no decrypt)
 *   - Download original   → decrypts in-memory, builds a Blob, triggers save-as
 *
 * File type icon is resolved dynamically via renderFileIcon() from the MIME type.
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  FileIcon,
  FileTextIcon,
  FilePdfIcon,
  FileDocIcon,
  FileXlsIcon,
  FilePptIcon,
  FileZipIcon,
  FileVideoIcon,
  FileAudioIcon,
  FileImageIcon,
  FileCodeIcon,
  FileCsvIcon,
  FileHtmlIcon,
  FileSvgIcon,
  FileRsIcon,
  FileJsIcon,
  FileTsIcon,
  FilePyIcon,
  FileSqlIcon,
  FileMdIcon,
  DownloadSimpleIcon,
  LockSimpleIcon,
  WarningIcon,
} from "@phosphor-icons/react";

import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import { MajikFile, type MajikFileJSON } from "@majikah/majik-file";
import { getChatFileCache, setChatFileCache } from "@/lib/idb/chat-file-cache";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

// ─── Local tokens ─────────────────────────────────────────────────────────────

const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Animations ───────────────────────────────────────────────────────────────

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

// ─── Styled components ────────────────────────────────────────────────────────

const FileBubble = styled.div<{ $isOwn: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 220px;
  max-width: 320px;
  width: fit-content;
  position: relative;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 16px;
  overflow: hidden;
  animation: ${fadeIn} 200ms cubic-bezier(0.4, 0, 0.2, 1) both;

  ${({ $isOwn }) =>
    $isOwn
      ? css`
          border-bottom-right-radius: 4px;
        `
      : css`
          border-bottom-left-radius: 4px;
        `}
`;

const FileHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 10px;
`;

const FileIconWrap = styled.div<{ $color: string }>`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${({ $color }) => $color}1a;
  color: ${({ $color }) => $color};
`;

const FileMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

const FileName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileSizeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const FileSize = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

const MimeTag = styled.span<{ $color: string }>`
  font-family: ${FONT_MONO};
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
  opacity: 0.75;
  padding: 1px 5px;
  border-radius: 3px;
  background: ${({ $color }) => $color}14;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  opacity: 0.5;
  margin: 0 14px;
`;

const ActionRow = styled.div`
  display: flex;
  align-items: stretch;
`;

const ActionBtn = styled.button<{ $loading?: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 10px;
  border: none;
  background: transparent;
  cursor: ${({ $loading }) => ($loading ? "not-allowed" : "pointer")};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: ${({ $loading }) => ($loading ? 0.45 : 0.7)};
  transition:
    opacity 120ms ease,
    background 120ms ease,
    color 120ms ease;

  &:hover:not(:disabled) {
    opacity: 1;
    background: ${({ theme }) => theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
`;

const ActionDivider = styled.div`
  width: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  opacity: 0.5;
  margin: 6px 0;
`;

const Spinner = styled.div`
  width: 10px;
  height: 10px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

const SkeletonBubble = styled.div`
  min-width: 220px;
  height: 90px;
  border-radius: 16px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 25%,
    rgba(255, 255, 255, 0.08) 37%,
    rgba(255, 255, 255, 0.04) 63%
  );
  background-size: 400% 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

const ErrorBubble = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(240, 100, 73, 0.07);
  border: 1px solid rgba(240, 100, 73, 0.18);
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: #f06449;
  max-width: 280px;
`;

// ─── File icon resolution ─────────────────────────────────────────────────────

interface FileIconMeta {
  Icon: React.ElementType;
  color: string;
  label: string;
}

/**
 * Resolves a Phosphor icon, accent color, and short label from a MIME type.
 * Falls back to the generic FileIcon for unrecognised types.
 */
export function renderFileIcon(mimeType: string | null): FileIconMeta {
  if (!mimeType) return { Icon: FileIcon, color: "#94a3b8", label: "FILE" };

  const m = mimeType.toLowerCase();

  // ── Documents ────────────────────────────────────────────────────────────
  if (m === "application/pdf")
    return { Icon: FilePdfIcon, color: "#ef4444", label: "PDF" };
  if (
    m === "application/msword" ||
    m ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return { Icon: FileDocIcon, color: "#3b82f6", label: "DOC" };
  if (
    m === "application/vnd.ms-excel" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    m === "application/vnd.oasis.opendocument.spreadsheet"
  )
    return { Icon: FileXlsIcon, color: "#22c55e", label: "XLS" };
  if (
    m === "application/vnd.ms-powerpoint" ||
    m ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return { Icon: FilePptIcon, color: "#f97316", label: "PPT" };
  if (m === "text/csv")
    return { Icon: FileCsvIcon, color: "#10b981", label: "CSV" };

  // ── Text / Markdown ───────────────────────────────────────────────────────
  if (m === "text/markdown" || m === "text/x-markdown")
    return { Icon: FileMdIcon, color: "#a78bfa", label: "MD" };
  if (m === "text/plain")
    return { Icon: FileTextIcon, color: "#94a3b8", label: "TXT" };
  if (m === "text/html")
    return { Icon: FileHtmlIcon, color: "#f97316", label: "HTML" };
  if (m === "image/svg+xml")
    return { Icon: FileSvgIcon, color: "#06b6d4", label: "SVG" };

  // ── Code ─────────────────────────────────────────────────────────────────
  if (m === "application/json" || m === "text/json")
    return { Icon: FileCodeIcon, color: "#facc15", label: "JSON" };
  if (m === "application/javascript" || m === "text/javascript")
    return { Icon: FileJsIcon, color: "#facc15", label: "JS" };
  if (m === "application/typescript" || m === "text/typescript")
    return { Icon: FileTsIcon, color: "#3b82f6", label: "TS" };
  if (m === "text/x-python" || m === "application/x-python-code")
    return { Icon: FilePyIcon, color: "#facc15", label: "PY" };
  if (m === "application/x-sql" || m === "text/x-sql")
    return { Icon: FileSqlIcon, color: "#38bdf8", label: "SQL" };
  if (m === "text/x-rustsrc" || m === "application/x-rust")
    return { Icon: FileRsIcon, color: "#f97316", label: "RS" };
  if (
    m === "text/x-c" ||
    m === "text/x-c++" ||
    m === "text/x-java-source" ||
    m === "text/x-go" ||
    m === "text/x-ruby" ||
    m === "text/x-php" ||
    m === "text/x-swift" ||
    m === "text/x-kotlin" ||
    m.startsWith("text/x-")
  )
    return { Icon: FileCodeIcon, color: "#c084fc", label: "CODE" };

  // ── Archives ──────────────────────────────────────────────────────────────
  if (
    m === "application/zip" ||
    m === "application/x-7z-compressed" ||
    m === "application/x-rar-compressed" ||
    m === "application/gzip" ||
    m === "application/x-tar" ||
    m === "application/x-bzip2"
  )
    return { Icon: FileZipIcon, color: "#f59e0b", label: "ZIP" };

  // ── Video ─────────────────────────────────────────────────────────────────
  if (m.startsWith("video/"))
    return { Icon: FileVideoIcon, color: "#8b5cf6", label: "VIDEO" };

  // ── Audio ─────────────────────────────────────────────────────────────────
  if (m.startsWith("audio/"))
    return { Icon: FileAudioIcon, color: "#ec4899", label: "AUDIO" };

  // ── Images (non-inline) ───────────────────────────────────────────────────
  if (m.startsWith("image/"))
    return { Icon: FileImageIcon, color: "#06b6d4", label: "IMAGE" };

  // ── Fallback ──────────────────────────────────────────────────────────────
  return { Icon: FileIcon, color: "#94a3b8", label: "FILE" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadPhase = "idle" | "loading" | "ready" | "error";

export interface FileAttachmentReadyInfo {
  fileJSON: MajikFileJSON;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FileAttachmentRendererProps {
  majik: MajikMessageDatabase;
  fileId: string;
  conversationId: string;
  isOwn: boolean;
  onReady?: (info: FileAttachmentReadyInfo) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FileAttachmentRenderer: React.FC<FileAttachmentRendererProps> = ({
  majik,
  fileId,
  conversationId,
  isOwn,
  onReady,
}) => {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [fileJSON, setFileJSON] = useState<MajikFileJSON | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Per-button download loading states
  const [downloadingRaw, setDownloadingRaw] = useState(false);
  const [downloadingDecrypted, setDownloadingDecrypted] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // ── Metadata fetch pipeline ───────────────────────────────────────────────
  const load = useCallback(async () => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    setPhase("loading");

    try {
      // ── Step 1 & 2: binary + fileJSON (cache-aware) ──────────────────────
      let fileJSON: MajikFileJSON;

      const cached = await getChatFileCache(fileId);

      if (cached) {
        fileJSON = cached.fileJSON;
      } else {
        fileJSON = await majik.getConversationFile(conversationId, fileId);

        setChatFileCache(fileId, fileJSON).catch((e) =>
          console.warn("[ChatFileRenderer] cache write failed:", e),
        );
      }

      if (!fileJSON) {
        setErrorMsg("File record not found.");
        setPhase("error");
        return;
      }

      setFileJSON(fileJSON);
      setPhase("ready");
      onReadyRef.current?.({ fileJSON: fileJSON });
    } catch (err) {
      console.warn("[FileAttachmentRenderer] fetch error:", err);
      hasFetchedRef.current = false;
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load file info.",
      );
      setPhase("error");
    }
  }, [conversationId, fileId, majik]);

  // ── IntersectionObserver — lazy trigger ───────────────────────────────────
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

  // ── Download raw .mjkb ────────────────────────────────────────────────────
  const handleDownloadRaw = async (): Promise<void> => {
    if (!fileJSON || downloadingRaw) return;
    setDownloadingRaw(true);

    try {
      const cached = await getChatFileCache(fileJSON.id);

      let binary: Uint8Array;

      if (!!cached?.binary) {
        binary = cached.binary;
      } else {
        binary = await majik.downloadFileBinary(fileId);

        setChatFileCache(fileId, fileJSON, binary).catch((e) =>
          console.warn("[ChatImageRenderer] cache write failed:", e),
        );
      }

      // ── Step 3: Hydrate + validate ───────────────────────────────────────
      const instance = await MajikFile.fromJSONWithBlob(
        fileJSON,
        new Blob([binary as BlobPart], { type: "application/octet-stream" }),
      );
      instance.validate();

      const defaultName = fileJSON?.original_name?.trim()
        ? `${fileJSON.original_name}.mjkb`
        : `majik-file.mjkb`;

      const mjkbBlob = instance.toMJKB();

      // Open the native save dialog
      const filePath = await save({
        defaultPath: defaultName,
        filters: [
          {
            name: "Majik File Binary",
            extensions: ["mjkb"],
          },
        ],
      });

      // User cancelled the dialog
      if (!filePath) {
        toast.info("File download cancelled", {
          id: `toast-info-download-${instance.id}`,
        });
        return;
      } else {
        // Convert blob → Uint8Array and write to the chosen path
        const arrayBuffer = await mjkbBlob.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }

      toast.success("MJKB downloaded successfully", {
        id: `toast-success-download-${instance.id}`,
      });
    } catch (err) {
      console.error("[FileAttachmentRenderer] raw download error:", err);
    } finally {
      setDownloadingRaw(false);
    }
  };

  // ── Download decrypted original ───────────────────────────────────────────
  const handleDownloadDecrypted = async (): Promise<void> => {
    if (!fileJSON || downloadingDecrypted) return;
    setDownloadingDecrypted(true);

    try {
      const cached = await getChatFileCache(fileJSON.id);

      let binary: Uint8Array;

      if (!!cached?.binary) {
        binary = cached.binary;
      } else {
        binary = await majik.downloadFileBinary(fileId);

        setChatFileCache(fileId, fileJSON, binary).catch((e) =>
          console.warn("[ChatFileRenderer] cache write failed:", e),
        );
      }

      // ── Step 3: Hydrate + validate ───────────────────────────────────────
      const instance = await MajikFile.fromJSONWithBlob(
        fileJSON,
        new Blob([binary as BlobPart], { type: "application/octet-stream" }),
      );
      instance.validate();

      const decrypted = await majik.decryptFile({ source: binary });

      const mimeType =
        decrypted.mimeType ?? fileJSON.mime_type ?? "application/octet-stream";
      const blob = new Blob([decrypted.bytes as BlobPart], { type: mimeType });

      const ext =
        getFileExtension(fileJSON.original_name || "default.mjkb") ?? "mjkb";

      const defaultName = fileJSON?.original_name || `majik-file`;

      // Open the native save dialog
      const filePath = await save({
        defaultPath: defaultName,
        filters: [
          {
            name: mimeType,
            extensions: [ext ?? mimeType],
          },
        ],
      });

      // User cancelled the dialog
      if (!filePath) {
        toast.info("File download cancelled", {
          id: `toast-info-download-${instance.id}`,
        });
        return;
      } else {
        // Convert blob → Uint8Array and write to the chosen path
        const arrayBuffer = await blob.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }

      toast.success("File downloaded successfully", {
        id: `toast-success-download-${instance.id}`,
      });
    } catch (err) {
      console.error("[FileAttachmentRenderer] decrypt download error:", err);
    } finally {
      setDownloadingDecrypted(false);
    }
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (phase === "idle" || phase === "loading") {
    return <SkeletonBubble ref={wrapperRef} />;
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === "error" || !fileJSON) {
    return (
      <ErrorBubble ref={wrapperRef}>
        <WarningIcon size={13} />
        {errorMsg ?? "File unavailable."}
      </ErrorBubble>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const { Icon, color, label } = renderFileIcon(fileJSON.mime_type);
  const displayName = fileJSON.original_name ?? `File`;
  const sizeLabel = formatBytes(fileJSON.size_original);

  return (
    <FileBubble ref={wrapperRef} $isOwn={isOwn}>
      <FileHeader>
        <FileIconWrap $color={color}>
          <Icon size={20} weight="fill" />
        </FileIconWrap>

        <FileMeta>
          <FileName title={displayName}>{displayName}</FileName>
          <FileSizeRow>
            <FileSize>{sizeLabel}</FileSize>
            <MimeTag $color={color}>{label}</MimeTag>
          </FileSizeRow>
        </FileMeta>
      </FileHeader>

      <Divider />

      <ActionRow>
        {/* Download raw encrypted .mjkb */}
        <ActionBtn
          type="button"
          onClick={handleDownloadRaw}
          disabled={downloadingRaw || downloadingDecrypted}
          $loading={downloadingRaw}
          title="Download encrypted .mjkb"
        >
          {downloadingRaw ? (
            <Spinner />
          ) : (
            <LockSimpleIcon size={11} weight="bold" />
          )}
          .mjkb
        </ActionBtn>

        <ActionDivider />

        {/* Download decrypted original */}
        <ActionBtn
          type="button"
          onClick={handleDownloadDecrypted}
          disabled={downloadingRaw || downloadingDecrypted}
          $loading={downloadingDecrypted}
          title={`Download original ${displayName}`}
        >
          {downloadingDecrypted ? (
            <Spinner />
          ) : (
            <DownloadSimpleIcon size={11} weight="bold" />
          )}
          Original
        </ActionBtn>
      </ActionRow>
    </FileBubble>
  );
};

/**
 * Extracts the file extension from a filename or path.
 * Returns null if no extension is found.
 */
function getFileExtension(input: string): string | null {
  if (!input) return null;

  // Remove query params or hashes if it's a URL-like string
  const clean = input.split(/[?#]/)[0];

  const lastDotIndex = clean.lastIndexOf(".");
  const lastSlashIndex = clean.lastIndexOf("/");

  // Ensure the dot is part of the filename, not a folder
  if (lastDotIndex === -1 || lastDotIndex < lastSlashIndex) {
    return null;
  }

  return clean.slice(lastDotIndex + 1).toLowerCase();
}
