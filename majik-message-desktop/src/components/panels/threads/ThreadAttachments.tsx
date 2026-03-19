// ThreadAttachments.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  DownloadSimpleIcon,
  TrashIcon,
  XIcon,
  LockKeyIcon,
  WarningIcon,
  PuzzlePieceIcon,
  PaperclipIcon,
  CheckCircleIcon,
  ProhibitIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
} from "@phosphor-icons/react";
import { MajikFile } from "@majikah/majik-file";
import type { FileContext, MajikFileJSON } from "@majikah/majik-file";

import type { MajikContact, MajikMessageThread } from "@majikah/majik-message";
import { toast } from "sonner";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";

import { MajikFileScanner } from "@/SDK/majik-file-scanner/majik-file-scanner";
import type { FileScanResult } from "@/SDK/majik-file-scanner/majik-file-scanner";
import type { UploadIntentBody } from "@/components/majikah-session-wrapper/types/files-api";

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const pulseOpacity = keyframes`
  0%, 100% { opacity: 0.3; }
  50%       { opacity: 0.65; }
`;

// Pulse used on the scanning badge — mirrors UserFiles.tsx scanPulse
const scanPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
`;

// ─── Scanner singleton (shared with UserFiles if in same bundle) ───────────────

const scanner = new MajikFileScanner();
let scannerReady = false;

async function ensureScanner(): Promise<void> {
  if (!scannerReady) {
    await scanner.initialize();
    scannerReady = true;
  }
}

/**
 * Minimum YARA scan score required to allow upload.
 * Mirrors the constant in UserFiles.tsx.
 */
const SCAN_PASS_THRESHOLD = 70;

// ─── MJKB magic-byte guard ────────────────────────────────────────────────────

const MJKB_MAGIC = new Uint8Array([0x4d, 0x4a, 0x4b, 0x42]);

async function looksLikeMjkb(file: File): Promise<boolean> {
  try {
    const buf = await file.arrayBuffer();
    return MajikFile.isValidMJKB(buf);
  } catch {
    try {
      const slice = await file.slice(0, 4).arrayBuffer();
      const bytes = new Uint8Array(slice);
      return MJKB_MAGIC.every((b, i) => bytes[i] === b);
    } catch {
      return false;
    }
  }
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  animation: ${fadeUp} 180ms ease both;
`;

// ─── Section label ────────────────────────────────────────────────────────────

const SectionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-shrink: 0;
`;

const SectionLabel = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.8px;
  opacity: 0.55;
  white-space: nowrap;
`;

const SectionDivider = styled.div`
  flex: 1;
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

// ─── Scrollable area ─────────────────────────────────────────────────────────

const ScrollArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
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

// ─── Drop zone ────────────────────────────────────────────────────────────────

const DropZone = styled.div<{ $active: boolean }>`
  border: 1.5px dashed
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.secondaryBackground};
  border-radius: 10px;
  padding: 18px;
  text-align: center;
  background: ${({ $active, theme }) =>
    $active
      ? theme.colors.primary + "10"
      : theme.colors.secondaryBackground + "55"};
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 14px;
  flex-shrink: 0;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primary + "10"};
  }
`;

const DropText = styled.p`
  margin: 6px 0 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  strong {
    color: ${({ theme }) => theme.colors.textPrimary};
    font-weight: 600;
  }
`;

const DropHint = styled.p`
  margin: 3px 0 0;
  font-family: "Fira Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

// ─── File row ─────────────────────────────────────────────────────────────────

const FileRow = styled.div<{ $scanBlocked?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 9px;
  border: 1px solid
    ${({ $scanBlocked, theme }) =>
      $scanBlocked ? "rgba(240,100,73,0.3)" : theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.secondaryBackground}55;
  margin-bottom: 5px;
  animation: ${fadeUp} 0.18s ease;
  transition: border-color 0.15s;

  &:hover {
    border-color: ${({ $scanBlocked, theme }) =>
      $scanBlocked ? "rgba(240,100,73,0.45)" : theme.colors.primary + "44"};
  }
`;

// ─── File type badge ──────────────────────────────────────────────────────────

type BadgeCls = "img" | "pdf" | "doc" | "zip" | "file";

const FileBadge = styled.div<{ $cls: BadgeCls }>`
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Fira Mono", monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.4px;
  flex-shrink: 0;
  border: 1px solid;

  ${({ $cls, theme }) => {
    switch ($cls) {
      case "img":
        return css`
          background: rgba(62, 207, 142, 0.1);
          color: #3ecf8e;
          border-color: rgba(62, 207, 142, 0.22);
        `;
      case "pdf":
        return css`
          background: rgba(240, 100, 73, 0.1);
          color: #f06449;
          border-color: rgba(240, 100, 73, 0.22);
        `;
      case "doc":
        return css`
          background: ${theme.colors.primary}18;
          color: ${theme.colors.primary};
          border-color: ${theme.colors.primary}44;
        `;
      case "zip":
        return css`
          background: rgba(245, 166, 35, 0.1);
          color: #f5a623;
          border-color: rgba(245, 166, 35, 0.22);
        `;
      default:
        return css`
          background: ${theme.colors.secondaryBackground};
          color: ${theme.colors.textSecondary};
          border-color: ${theme.colors.primaryBackground};
        `;
    }
  }}
`;

const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileName = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  flex-wrap: wrap;
`;

const FileMetaText = styled.span`
  font-family: "Fira Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`;

const PermTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.primary}44;
  background: ${({ theme }) => theme.colors.primary}18;
  color: ${({ theme }) => theme.colors.primary};
  font-family: "Fira Mono", monospace;
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = styled.span<{
  $error?: boolean;
  $warn?: boolean;
  $success?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: "Fira Mono", monospace;
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid;
  background: ${({ $error, $warn, $success }) =>
    $error
      ? "rgba(240,100,73,0.08)"
      : $warn
        ? "rgba(245,166,35,0.08)"
        : $success
          ? "rgba(62,207,142,0.08)"
          : "rgba(124,106,247,0.10)"};
  color: ${({ $error, $warn, $success, theme }) =>
    $error
      ? "#f06449"
      : $warn
        ? "#f5a623"
        : $success
          ? "#3ecf8e"
          : theme.colors.primary};
  border-color: ${({ $error, $warn, $success }) =>
    $error
      ? "rgba(240,100,73,0.22)"
      : $warn
        ? "rgba(245,166,35,0.22)"
        : $success
          ? "rgba(62,207,142,0.22)"
          : "rgba(124,106,247,0.22)"};
`;

// Scan-specific badge with pulse animation during scanning
const ScanBadge = styled(StatusBadge)<{ $scanning?: boolean }>`
  ${({ $scanning }) =>
    $scanning &&
    css`
      animation: ${scanPulse} 1.1s ease infinite;
    `}
`;

// Score pill — circular badge matching UserFiles.tsx style
const ScanScorePill = styled.div<{ $pass: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 18px;
  padding: 0 5px;
  border-radius: 100px;
  font-family: "Fira Mono", monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: -0.02em;
  flex-shrink: 0;
  border: 1px solid
    ${({ $pass }) =>
      $pass ? "rgba(62,207,142,0.35)" : "rgba(240,100,73,0.35)"};
  color: ${({ $pass }) => ($pass ? "#3ecf8e" : "#f06449")};
  background: ${({ $pass }) =>
    $pass ? "rgba(62,207,142,0.08)" : "rgba(240,100,73,0.08)"};
`;

// Scan blocked notice — shown below the file row when scan fails
const ScanBlockedNotice = styled.div`
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 6px 8px;
  background: rgba(240, 100, 73, 0.07);
  border: 1px solid rgba(240, 100, 73, 0.18);
  border-radius: 6px;
  font-family: "Fira Mono", monospace;
  font-size: 9px;
  color: #f06449;
  line-height: 1.55;
  margin-top: 6px;
  animation: ${fadeIn} 150ms ease both;
`;

// ─── Pending file row wrapper — stacks main row + scan notice ─────────────────

const PendingRowWrap = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 5px;
`;

const Spinner = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid rgba(124, 106, 247, 0.22);
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.7s linear infinite;
  flex-shrink: 0;
`;

// ─── Icon button ──────────────────────────────────────────────────────────────

const IconBtn = styled.button<{ $variant?: "green" | "red" }>`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    ${({ $variant, theme }) => {
      if ($variant === "green")
        return css`
          background: rgba(62, 207, 142, 0.1);
          color: #3ecf8e;
          border-color: rgba(62, 207, 142, 0.3);
        `;
      if ($variant === "red")
        return css`
          background: rgba(240, 100, 73, 0.1);
          color: #f06449;
          border-color: rgba(240, 100, 73, 0.3);
        `;
      return css`
        background: ${theme.colors.secondaryBackground};
        color: ${theme.colors.textPrimary};
      `;
    }}
  }
`;

// ─── Confirm upload button ────────────────────────────────────────────────────

const ConfirmBtn = styled.button<{ $ready: boolean }>`
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  font-family: "Fira Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid
    ${({ $ready }) => ($ready ? "rgba(62,207,142,0.3)" : "transparent")};
  background: ${({ $ready }) =>
    $ready ? "rgba(62,207,142,0.1)" : "rgba(255,255,255,0.04)"};
  color: ${({ $ready }) => ($ready ? "#3ecf8e" : "#6b6b80")};
  cursor: ${({ $ready }) => ($ready ? "pointer" : "not-allowed")};
  opacity: ${({ $ready }) => ($ready ? 1 : 0.5)};
  transition: all 0.15s;
  flex-shrink: 0;
  &:hover:not(:disabled) {
    background: rgba(62, 207, 142, 0.18);
  }
`;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow = styled.div`
  height: 52px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  animation: ${pulseOpacity} 1.4s ease-in-out infinite;
  margin-bottom: 5px;
`;

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = styled.div`
  text-align: center;
  padding: 36px 20px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const EmptyTitle = styled.p`
  margin: 8px 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const EmptySub = styled.p`
  margin: 0;
  font-family: "Fira Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
`;

// ─── Locked recipients notice ─────────────────────────────────────────────────

const RecipientsNotice = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.primary}0d;
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  margin-bottom: 14px;
  flex-shrink: 0;
`;

const NoticeText = styled.span`
  font-family: "Fira Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  flex: 1;
`;

const RecipientChip = styled.span`
  font-family: "Fira Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary}18;
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function extInfo(name: string | null): { label: string; cls: BadgeCls } {
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "avif",
      "bmp",
      "heic",
    ].includes(ext)
  )
    return { label: "IMG", cls: "img" };
  if (ext === "pdf") return { label: "PDF", cls: "pdf" };
  if (["doc", "docx", "txt", "md", "rtf", "odt"].includes(ext))
    return { label: "DOC", cls: "doc" };
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext))
    return { label: "ZIP", cls: "zip" };
  return { label: ext.toUpperCase().slice(0, 4) || "FILE", cls: "file" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FileScanPhase = "idle" | "scanning" | "clean" | "flagged" | "error";

interface PendingAttachment {
  id: string;
  raw: File;
  majikFile: MajikFile | null | undefined;
  encryptError?: string;
  /** YARA scan phase for this pending file */
  scanPhase: FileScanPhase;
  /** YARA scan result — null until scan completes */
  scanResult: FileScanResult | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ThreadAttachmentsProps {
  majik: MajikMessageDatabase;
  thread: MajikMessageThread;
  participants: MajikContact[];
  /** Compose mode: parent owns the upload, we just report ready files */
  onAttachmentsChange?: (files: MajikFile[]) => void;
  /** When true, hides the manual Upload button (send flow handles it) */
  composeMode?: boolean;
  onEncryptingChange?: (isPending: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ThreadAttachments: React.FC<ThreadAttachmentsProps> = ({
  majik,
  thread,
  participants,
  onAttachmentsChange,
  composeMode = false,
  onEncryptingChange,
}) => {
  const [existingFiles, setExistingFiles] = useState<MajikFileJSON[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing thread attachments ────────────────────────────────────────
  // TODO: replace with your actual thread-files fetch
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoadingExisting(true);
      try {
        // PLACEHOLDER — swap with real call e.g.:
        // const data = await majik.getThreadFiles(thread.id)
        const data: MajikFileJSON[] = [];
        if (!cancelled) setExistingFiles(data);
      } catch (e) {
        console.error("[ThreadAttachments] fetch existing files failed", e);
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [thread.id]);

  // ── Encrypt helper ───────────────────────────────────────────────────────────
  // Only called after scan passes — accepts the latest snapshot of the pending
  // file to avoid stale closure over any mutable fields.

  const encryptPendingFile = useCallback(
    async (pf: PendingAttachment) => {
      const identity = majik.currentIdentity;
      if (!identity) {
        setPendingFiles((prev) =>
          prev.map((p) =>
            p.id === pf.id
              ? { ...p, majikFile: null, encryptError: "No active identity" }
              : p,
          ),
        );
        return;
      }

      // Build recipient pub keys from thread participants, excluding self
      const ownFingerprint = identity.id;
      const recipientPubKeys = (
        await Promise.all(
          participants
            .filter((r) => r?.fingerprint !== ownFingerprint)
            .map((r) => r.getPublicKeyBase64()),
        )
      ).filter(Boolean) as string[];

      try {
        const bytes = new Uint8Array(await pf.raw.arrayBuffer());
        const encryptedResult = await majik.encryptFile({
          data: bytes,
          mimeType: pf.raw.type || "application/octet-stream",
          originalName: pf.raw.name,
          context: "thread_attachment" as FileContext,
          isTemporary: false, // attachments are always permanent
          userId: majik?.user?.id,
          expiresAt: undefined,
          recipients: recipientPubKeys,
        });

        setPendingFiles((prev) => {
          const updated = prev.map((p) =>
            p.id === pf.id ? { ...p, majikFile: encryptedResult.file } : p,
          );

          const anyEncrypting = updated.some(
            (p) => p.majikFile === undefined && !p.encryptError,
          );
          onEncryptingChange?.(anyEncrypting);

          // Report all currently-ready files up to parent
          const readyFiles = updated
            .map((p) => p.majikFile)
            .filter((f): f is MajikFile => f instanceof MajikFile);
          onAttachmentsChange?.(readyFiles);

          return updated;
        });
      } catch (e) {
        setPendingFiles((prev) =>
          prev.map((p) =>
            p.id === pf.id
              ? { ...p, majikFile: null, encryptError: (e as Error).message }
              : p,
          ),
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik, participants],
  );

  // ── Scan helper ───────────────────────────────────────────────────────────────
  // Runs YARA scan then, on pass, triggers encryption. On block, marks the file
  // and surfaces a toast — mirroring the identical flow in UserFiles.tsx.

  const scanPendingFile = useCallback(
    async (pf: PendingAttachment) => {
      // Mark as scanning
      setPendingFiles((prev) =>
        prev.map((p) =>
          p.id === pf.id
            ? { ...p, scanPhase: "scanning", scanResult: null }
            : p,
        ),
      );

      try {
        await ensureScanner();
        const result = await scanner.scan(pf.raw);

        const phase: FileScanPhase =
          result.status === "clean"
            ? "clean"
            : result.status === "flagged"
              ? "flagged"
              : "error";

        const scanPasses = result.score >= SCAN_PASS_THRESHOLD;

        setPendingFiles((prev) =>
          prev.map((p) =>
            p.id === pf.id
              ? {
                  ...p,
                  scanPhase: phase,
                  scanResult: result,
                  encryptError: scanPasses ? p.encryptError : undefined,
                }
              : p,
          ),
        );

        if (!scanPasses) {
          if (phase === "flagged") {
            toast.error(`"${pf.raw.name}" blocked — YARA threat detected`, {
              description: `Score: ${result.score}/100 · ${result.remarks.length} rule(s) matched`,
              id: `toast-scan-blocked-${pf.id}`,
              duration: 8000,
            });
          } else if (result.score < SCAN_PASS_THRESHOLD) {
            toast.warning(`"${pf.raw.name}" blocked — scan score too low`, {
              description: `Score ${result.score}/100 is below the minimum of ${SCAN_PASS_THRESHOLD}. Remove the file or choose a different one.`,
              id: `toast-scan-score-${pf.id}`,
              duration: 6000,
            });
          }
          return;
        }

        // Scan passed — proceed to encryption using the latest snapshot of the
        // pending file to avoid stale closure over any async-mutated fields.
        setPendingFiles((prev) => {
          const latest = prev.find((p) => p.id === pf.id);
          if (latest) {
            Promise.resolve().then(() => encryptPendingFile(latest));
          }
          return prev;
        });
      } catch (err) {
        console.error("[ThreadAttachments] scan error:", err);
        setPendingFiles((prev) =>
          prev.map((p) =>
            p.id === pf.id ? { ...p, scanPhase: "error", scanResult: null } : p,
          ),
        );
        toast.warning(`Scan failed for "${pf.raw.name}" — upload blocked`, {
          description:
            "A scan error occurred. Remove and re-add the file to retry.",
          id: `toast-scan-err-${pf.id}`,
        });
      }
    },
    [encryptPendingFile],
  );

  // ── Add files ────────────────────────────────────────────────────────────────

  const addRawFiles = useCallback(
    async (rawFiles: File[]) => {
      const validFiles: File[] = [];

      for (const f of rawFiles) {
        // Block .mjkb files — re-encrypting an already-encrypted file is not permitted
        const isMjkb =
          f.name.toLowerCase().endsWith(".mjkb") || (await looksLikeMjkb(f));

        if (isMjkb) {
          toast.error(`"${f.name}" is already encrypted`, {
            description:
              "Encrypted .mjkb files cannot be attached — use the File Vault to decrypt them.",
            id: `toast-mjkb-rejected-${f.name}`,
            duration: 6000,
          });
          continue;
        }

        validFiles.push(f);
      }

      if (!validFiles.length) return;

      // Build pending entries with scan in "idle" state; encryption is deferred
      // until scan completes and passes.
      const batch: PendingAttachment[] = validFiles.map((f) => ({
        id: crypto.randomUUID(),
        raw: f,
        majikFile: undefined,
        scanPhase: "idle" as FileScanPhase,
        scanResult: null,
      }));

      setPendingFiles((prev) => [...prev, ...batch]);

      // Kick off scan for each file immediately after adding to state
      batch.forEach((pf) => scanPendingFile(pf));
    },
    [scanPendingFile],
  );

  const removePending = (id: string): void =>
    setPendingFiles((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      const readyFiles = filtered
        .map((p) => p.majikFile)
        .filter((f): f is MajikFile => f instanceof MajikFile);
      onAttachmentsChange?.(readyFiles);
      return filtered;
    });

  // ── Upload ────────────────────────────────────────────────────────────────────

  const handleConfirmUpload = async (pf: PendingAttachment): Promise<void> => {
    if (!pf.majikFile || uploadingIds.has(pf.id)) return;
    setUploadingIds((prev) => new Set(prev).add(pf.id));

    const doUpload = async (): Promise<string> => {
      const fileJSON = pf.majikFile!.toJSON();
      const intent: UploadIntentBody = {
        fileHash: fileJSON.file_hash,
        sizeOriginal: fileJSON.size_original,
        mimeType: fileJSON.mime_type,
        context: "thread_attachment",
        isTemporary: false,
        expiresAt: undefined,
        originalName: fileJSON.original_name,
      };
      const confirmed = await majik.uploadFile(intent, pf.majikFile!);
      setExistingFiles((prev) => [confirmed, ...prev]);
      removePending(pf.id);
      return `"${pf.raw.name}" attached successfully`;
    };

    toast.promise(doUpload(), {
      loading: `Uploading "${pf.raw.name}"…`,
      success: (msg) => msg,
      error: (err) => err.message,
    });

    setUploadingIds((prev) => {
      const n = new Set(prev);
      n.delete(pf.id);
      return n;
    });
  };

  // ── Delete existing ───────────────────────────────────────────────────────────

  const handleDeleteExisting = (fileId: string): void => {
    toast.promise(
      majik.deleteFile(fileId).then(() => {
        setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
      }),
      {
        loading: "Removing attachment…",
        success: "Attachment removed",
        error: (err) => err.message,
      },
    );
  };

  // ── Download ──────────────────────────────────────────────────────────────────

  const handleDownload = (file: MajikFileJSON): void => {
    toast.promise(
      (async () => {
        const binary = await majik.downloadFileBinary(file.id);
        const blob = new Blob([binary as BlobPart], {
          type: "application/octet-stream",
        });
        const instance = await MajikFile.fromJSONWithBlob(file, blob);
        instance.validate();
        const mjkb = instance.toMJKB();
        const url = URL.createObjectURL(mjkb);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(instance.originalName ?? file.original_name ?? "file").replace(/\.[^/.]+$/, "")}.mjkb`;
        a.click();
        URL.revokeObjectURL(url);
        return `Downloaded "${file.original_name}"`;
      })(),
      {
        loading: `Downloading…`,
        success: (msg) => msg,
        error: (err) => err.message,
      },
    );
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const participantChips = participants.slice(0, 3);
  const participantRest = participants.length - 3;

  return (
    <Root>
      {/* Recipients lock notice */}
      <RecipientsNotice>
        <LockKeyIcon
          size={13}
          weight="fill"
          color="var(--color-primary, #7c6af7)"
        />
        <NoticeText>Encrypted for thread participants only</NoticeText>
        {participantChips.map((p) => (
          <RecipientChip key={p.id} data-private>
            {p.meta?.label || p.id.slice(0, 5) + "…" + p.id.slice(-3)}
          </RecipientChip>
        ))}
        {participantRest > 0 && (
          <RecipientChip>+{participantRest}</RecipientChip>
        )}
      </RecipientsNotice>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) addRawFiles(picked);
          e.target.value = "";
        }}
      />

      {/* Drop zone */}
      <DropZone
        $active={isDragging}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const dropped = Array.from(e.dataTransfer.files);
          if (dropped.length) addRawFiles(dropped);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <PaperclipIcon
          size={20}
          style={{ opacity: 0.35, margin: "0 auto", display: "block" }}
        />
        <DropText>
          <strong>Drop files here</strong> or click to browse
        </DropText>
        <DropHint>
          YARA-scanned · always encrypted · permanent · max 100 MB · .mjkb not
          accepted
        </DropHint>
      </DropZone>

      <ScrollArea>
        {/* Pending (to-be-uploaded) files */}
        {pendingFiles.length > 0 && (
          <>
            <SectionRow>
              <SectionLabel>Pending · {pendingFiles.length}</SectionLabel>
              <SectionDivider />
            </SectionRow>

            {pendingFiles.map((pf) => {
              const isScanning =
                pf.scanPhase === "scanning" || pf.scanPhase === "idle";

              const scanBlocked =
                (pf.scanPhase === "flagged" &&
                  pf.scanResult !== null &&
                  pf.scanResult.score < SCAN_PASS_THRESHOLD) ||
                pf.scanPhase === "error" ||
                (pf.scanPhase === "clean" &&
                  pf.scanResult !== null &&
                  pf.scanResult.score < SCAN_PASS_THRESHOLD);

              const scanPassed =
                pf.scanResult !== null &&
                pf.scanResult.score >= SCAN_PASS_THRESHOLD;

              const isEncrypting = scanPassed && pf.majikFile === undefined;
              const isError = scanPassed && pf.majikFile === null;
              const isUploading = uploadingIds.has(pf.id);

              // Confirm is only active when: scan passed, encryption done, not uploading
              const ready =
                scanPassed &&
                !isEncrypting &&
                !isError &&
                !isUploading &&
                pf.majikFile instanceof MajikFile;

              const { label, cls } = extInfo(pf.raw.name);

              return (
                <PendingRowWrap key={pf.id}>
                  <FileRow $scanBlocked={scanBlocked}>
                    <FileBadge $cls={cls} data-private>
                      {label}
                    </FileBadge>
                    <FileInfo>
                      <FileName data-private>{pf.raw.name}</FileName>
                      <FileMeta>
                        <FileMetaText data-private>
                          {formatBytes(pf.raw.size)}
                        </FileMetaText>
                        <PermTag>Permanent</PermTag>

                        {/* ── Scan status badges ── */}
                        {isScanning && (
                          <ScanBadge $scanning>
                            <Spinner />
                            Scanning…
                          </ScanBadge>
                        )}

                        {pf.scanPhase === "flagged" && (
                          <ScanBadge $error>
                            <ProhibitIcon size={9} />
                            Threat detected
                          </ScanBadge>
                        )}

                        {pf.scanPhase === "error" && (
                          <ScanBadge $warn>
                            <WarningIcon size={9} />
                            Scan failed
                          </ScanBadge>
                        )}

                        {/* Clean but below threshold */}
                        {pf.scanPhase === "clean" &&
                          pf.scanResult !== null &&
                          pf.scanResult.score < SCAN_PASS_THRESHOLD && (
                            <ScanBadge $warn>
                              <ShieldWarningIcon size={9} />
                              Score too low
                            </ScanBadge>
                          )}

                        {/* Scan passed — show score pill */}
                        {scanPassed && pf.scanResult !== null && (
                          <>
                            <ScanBadge $success>
                              <ShieldCheckIcon size={9} />
                              Scan clean
                            </ScanBadge>
                            <ScanScorePill $pass>
                              {pf.scanResult.score}/100
                            </ScanScorePill>
                          </>
                        )}

                        {/* ── Encrypt / upload status (only shown after scan pass) ── */}
                        {isEncrypting && (
                          <StatusBadge>
                            <Spinner />
                            <LockKeyIcon size={9} />
                            Encrypting…
                          </StatusBadge>
                        )}
                        {isError && (
                          <StatusBadge $error>
                            <WarningIcon size={9} />
                            {pf.encryptError ?? "Encrypt failed"}
                          </StatusBadge>
                        )}
                        {isUploading && (
                          <StatusBadge>
                            <Spinner />
                            Uploading…
                          </StatusBadge>
                        )}
                      </FileMeta>
                    </FileInfo>

                    {/* Upload / Ready indicators */}
                    {!composeMode && (
                      <ConfirmBtn
                        $ready={ready}
                        disabled={!ready}
                        onClick={() => handleConfirmUpload(pf)}
                        title={
                          !scanPassed
                            ? "Upload blocked — file must pass the YARA scan"
                            : isEncrypting
                              ? "Encrypting…"
                              : undefined
                        }
                      >
                        {isUploading ? "…" : "Upload"}
                      </ConfirmBtn>
                    )}
                    {composeMode && ready && (
                      <StatusBadge $success>
                        <CheckCircleIcon size={9} weight="fill" />
                        Ready
                      </StatusBadge>
                    )}

                    <IconBtn
                      $variant="red"
                      onClick={() => removePending(pf.id)}
                    >
                      <XIcon size={11} />
                    </IconBtn>
                  </FileRow>

                  {/* ── Scan blocked notice ── */}
                  {scanBlocked && pf.scanResult !== null && (
                    <ScanBlockedNotice>
                      <span style={{ flexShrink: 0, marginTop: 1 }}>
                        <ProhibitIcon size={11} />
                      </span>
                      <span>
                        {pf.scanPhase === "flagged"
                          ? `Upload blocked — ${pf.scanResult.remarks.length} YARA rule(s) matched. Score: ${pf.scanResult.score}/100.`
                          : `Upload blocked — scan score ${pf.scanResult.score}/100 is below the minimum of ${SCAN_PASS_THRESHOLD}.`}{" "}
                        Remove this file to continue.
                      </span>
                    </ScanBlockedNotice>
                  )}

                  {pf.scanPhase === "error" && (
                    <ScanBlockedNotice>
                      <span style={{ flexShrink: 0, marginTop: 1 }}>
                        <WarningIcon size={11} />
                      </span>
                      <span>
                        YARA scan could not complete. Upload is blocked until
                        the file is removed and re-added.
                      </span>
                    </ScanBlockedNotice>
                  )}
                </PendingRowWrap>
              );
            })}
          </>
        )}

        {/* Existing thread files */}
        <SectionRow style={{ marginTop: pendingFiles.length > 0 ? 14 : 0 }}>
          <SectionLabel>Thread Attachments</SectionLabel>
          <SectionDivider />
        </SectionRow>

        {loadingExisting ? (
          <>
            {[...Array(3)].map((_, i) => (
              <SkeletonRow key={i} style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </>
        ) : existingFiles.length === 0 ? (
          <EmptyState>
            <PuzzlePieceIcon
              size={28}
              style={{ opacity: 0.2, margin: "0 auto", display: "block" }}
            />
            <EmptyTitle>No attachments yet</EmptyTitle>
            <EmptySub>Drop files above to add them to this thread</EmptySub>
          </EmptyState>
        ) : (
          existingFiles.map((file) => {
            const { label, cls } = extInfo(file.original_name);
            return (
              <FileRow key={file.id}>
                <FileBadge $cls={cls}>{label}</FileBadge>
                <FileInfo>
                  <FileName data-private>
                    {file.original_name ?? file.file_hash.slice(0, 16) + "…"}
                  </FileName>
                  <FileMeta>
                    <FileMetaText data-private>
                      {formatBytes(file.size_original)}
                    </FileMetaText>
                    <FileMetaText data-private>·</FileMetaText>
                    <FileMetaText data-private>
                      {formatDate(file.timestamp)}
                    </FileMetaText>
                    <PermTag>Permanent</PermTag>
                    <StatusBadge $success>
                      <CheckCircleIcon size={9} weight="fill" />
                      Uploaded
                    </StatusBadge>
                  </FileMeta>
                </FileInfo>
                <IconBtn
                  $variant="green"
                  onClick={() => handleDownload(file)}
                  title="Download"
                >
                  <DownloadSimpleIcon size={12} />
                </IconBtn>
                <IconBtn
                  $variant="red"
                  onClick={() => handleDeleteExisting(file.id)}
                  title="Remove"
                >
                  <TrashIcon size={12} />
                </IconBtn>
              </FileRow>
            );
          })
        )}
      </ScrollArea>
    </Root>
  );
};

export default ThreadAttachments;
