/**
 * VoiceMessageRenderer.tsx
 *
 * Renders a [voice:<uuid>] token embedded in a chat message.
 * Mirrors the FileAttachmentRenderer pattern: lazy-loads via IntersectionObserver,
 * shows a skeleton while fetching, and fires onReady once the record is loaded.
 *
 * Voice messages are always OGG/Opus files stored as encrypted .mjkb binaries.
 *
 * Exposes two download actions:
 *   - Download raw .mjkb  → streams the encrypted binary directly (no decrypt)
 *   - Download original   → decrypts in-memory, builds a Blob, triggers save-as
 *
 * Playback is handled by WaveSurfer.js with a seekable waveform.
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  PlayIcon,
  PauseIcon,
  DownloadSimpleIcon,
  LockSimpleIcon,
  WarningIcon,
  MicrophoneIcon,
} from "@phosphor-icons/react";
import WaveSurfer from "wavesurfer.js";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import { MajikFile, type MajikFileJSON } from "@majikah/majik-file";

import {
  getChatVoiceCache,
  setChatVoiceCache,
} from "@/lib/idb/chat-voice-cache";

// ─── Local tokens ─────────────────────────────────────────────────────────────

const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";
const VOICE_MIME = "audio/ogg; codecs=opus";

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

const VoiceBubble = styled.div<{ $isOwn: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 240px;
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

const PlayerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 8px;
`;

const PlayBtn = styled.button<{ $playing: boolean }>`
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${({ theme, $playing }) =>
    $playing ? theme.colors.primary : `${theme.colors.primary}22`};
  color: ${({ theme, $playing }) => ($playing ? "#fff" : theme.colors.primary)};
  transition:
    background 150ms ease,
    color 150ms ease,
    transform 80ms ease;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    transform: scale(1.06);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const WaveWrap = styled.div`
  flex: 1;
  min-width: 0;
  height: 36px;
  cursor: pointer;
  overflow: hidden;

  & > div {
    height: 100% !important;
  }
`;

const TimeBadge = styled.span`
  flex-shrink: 0;
  font-family: ${FONT_MONO};
  font-size: 10px;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  min-width: 32px;
  text-align: right;
`;

const MicBadge = styled.div`
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  opacity: 0.5;
  margin: 0 12px;
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
  padding: 8px 10px;
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
  min-width: 240px;
  height: 80px;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadPhase = "idle" | "loading" | "ready" | "error";

export interface VoiceMessageReadyInfo {
  fileJSON: MajikFileJSON;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoiceMessageRendererProps {
  majik: MajikMessageDatabase;
  fileId: string;
  conversationId: string;
  isOwn: boolean;
  /** Accent colour for the waveform progress fill */
  waveColor?: string;
  onReady?: (info: VoiceMessageReadyInfo) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const VoiceMessageRenderer: React.FC<VoiceMessageRendererProps> = ({
  majik,
  fileId,
  conversationId,
  isOwn,
  waveColor = "#4F6EF7",
  onReady,
}) => {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [fileJSON, setFileJSON] = useState<MajikFileJSON | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [wsReady, setWsReady] = useState(false);

  // Download states
  const [downloadingRaw, setDownloadingRaw] = useState(false);
  const [downloadingDecrypted, setDownloadingDecrypted] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const hasFetchedRef = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try {
        wavesurferRef.current?.destroy();
      } catch {
        /* */
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // ── Build WaveSurfer once we have a decrypted object URL ──────────────────
  const initWaveSurfer = useCallback(
    (audioUrl: string) => {
      if (!waveContainerRef.current) return;

      try {
        wavesurferRef.current?.destroy();
      } catch {
        /* */
      }

      const ws = WaveSurfer.create({
        container: waveContainerRef.current,
        waveColor: "rgba(255,255,255,0.2)",
        progressColor: waveColor,
        cursorColor: "transparent",
        height: 36,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        interact: true,
        url: audioUrl,
      });

      ws.on("ready", () => {
        setDuration(ws.getDuration());
        setWsReady(true);
      });
      ws.on("audioprocess", () => setCurrentTime(ws.getCurrentTime()));
      ws.on("seeking", () => setCurrentTime(ws.getCurrentTime()));
      ws.on("finish", () => {
        setIsPlaying(false);
        setCurrentTime(ws.getDuration());
      });

      wavesurferRef.current = ws;
    },
    [waveColor],
  );

  // ── Fetch + decrypt pipeline ───────────────────────────────────────────────
  const load = useCallback(async () => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    setPhase("loading");

    try {
      // ── Step 1: fetch fileJSON (cache-aware) ─────────────────────────────
      let fileJSON: MajikFileJSON;
      let binary: Uint8Array;
      const cached = await getChatVoiceCache(fileId);

      if (cached) {
        binary = cached.binary;
        fileJSON = cached.fileJSON;
      } else {
        [binary, fileJSON] = await Promise.all([
          majik.downloadFileBinary(fileId),
          majik.getConversationFile(conversationId, fileId),
        ]);

        if (!fileJSON) {
          setErrorMsg("Voice record not found.");
          setPhase("error");
          return;
        }

        setChatVoiceCache(fileId, binary, fileJSON).catch((e) =>
          console.warn("[VoiceMessageRenderer] cache write failed:", e),
        );
      }

      setFileJSON(fileJSON);

      // ── Step 3: decrypt ──────────────────────────────────────────────────
      const decrypted = await majik.decryptFile({ source: binary });
      const mimeType = decrypted.mimeType ?? VOICE_MIME;
      const blob = new Blob([decrypted.bytes as BlobPart], { type: mimeType });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      setPhase("ready");
      onReadyRef.current?.({ fileJSON });

      // ── Step 4: init waveform (needs DOM ready) ──────────────────────────
      // Small defer so the bubble has rendered its container
      setTimeout(() => initWaveSurfer(url), 0);
    } catch (err) {
      console.warn("[VoiceMessageRenderer] fetch error:", err);
      hasFetchedRef.current = false;
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load voice message.",
      );
      setPhase("error");
    }
  }, [conversationId, fileId, majik, initWaveSurfer]);

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

  // ── Play / Pause ──────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws || !wsReady) return;
    ws.playPause();
    setIsPlaying((p) => !p);
  }, [wsReady]);

  // ── Download raw .mjkb ────────────────────────────────────────────────────
  const handleDownloadRaw = async (): Promise<void> => {
    if (!fileJSON || downloadingRaw) return;
    setDownloadingRaw(true);

    try {
      const cached = await getChatVoiceCache(fileJSON.id);
      let binary: Uint8Array;

      if (cached?.binary) {
        binary = cached.binary;
      } else {
        binary = await majik.downloadFileBinary(fileId);
        setChatVoiceCache(fileId, binary, fileJSON).catch((e) =>
          console.warn("[VoiceMessageRenderer] cache write failed:", e),
        );
      }

      const instance = await MajikFile.fromJSONWithBlob(
        fileJSON,
        new Blob([binary as BlobPart], { type: "application/octet-stream" }),
      );
      instance.validate();

      const defaultName = fileJSON?.original_name?.trim()
        ? `${fileJSON.original_name}.mjkb`
        : `voice-message.mjkb`;

      const mjkbBlob = instance.toMJKB();

      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "Majik File Binary", extensions: ["mjkb"] }],
      });

      if (!filePath) {
        toast.info("File download cancelled", {
          id: `toast-info-download-${instance.id}`,
        });
        return;
      }

      const arrayBuffer = await mjkbBlob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(arrayBuffer));

      toast.success("MJKB downloaded successfully", {
        id: `toast-success-download-${instance.id}`,
      });
    } catch (err) {
      console.error("[VoiceMessageRenderer] raw download error:", err);
    } finally {
      setDownloadingRaw(false);
    }
  };

  // ── Download decrypted .ogg ───────────────────────────────────────────────
  const handleDownloadDecrypted = async (): Promise<void> => {
    if (!fileJSON || downloadingDecrypted) return;
    setDownloadingDecrypted(true);

    try {
      const cached = await getChatVoiceCache(fileJSON.id);
      let binary: Uint8Array;

      if (cached?.binary) {
        binary = cached.binary;
      } else {
        binary = await majik.downloadFileBinary(fileId);
        setChatVoiceCache(fileId, binary, fileJSON).catch((e) =>
          console.warn("[VoiceMessageRenderer] cache write failed:", e),
        );
      }

      const instance = await MajikFile.fromJSONWithBlob(
        fileJSON,
        new Blob([binary as BlobPart], { type: "application/octet-stream" }),
      );
      instance.validate();

      const decrypted = await majik.decryptFile({ source: binary });
      const mimeType = decrypted.mimeType ?? VOICE_MIME;
      const blob = new Blob([decrypted.bytes as BlobPart], { type: mimeType });

      const defaultName =
        fileJSON?.original_name?.trim() || `voice-message.ogg`;

      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "OGG Audio", extensions: ["ogg"] }],
      });

      if (!filePath) {
        toast.info("File download cancelled", {
          id: `toast-info-download-${instance.id}`,
        });
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(arrayBuffer));

      toast.success("Voice message downloaded", {
        id: `toast-success-download-${instance.id}`,
      });
    } catch (err) {
      console.error("[VoiceMessageRenderer] decrypt download error:", err);
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
        {errorMsg ?? "Voice message unavailable."}
      </ErrorBubble>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const displayTime = isPlaying || currentTime > 0 ? currentTime : duration;

  return (
    <VoiceBubble ref={wrapperRef} $isOwn={isOwn}>
      <PlayerRow>
        {/* Mic icon — decorative identity badge */}
        <MicBadge>
          <MicrophoneIcon size={13} weight="fill" />
        </MicBadge>

        {/* Play / Pause */}
        <PlayBtn
          type="button"
          $playing={isPlaying}
          onClick={handlePlayPause}
          disabled={!wsReady}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <PauseIcon size={14} weight="fill" />
          ) : (
            <PlayIcon size={14} weight="fill" />
          )}
        </PlayBtn>

        {/* Seekable waveform */}
        <WaveWrap ref={waveContainerRef} />

        {/* Duration / current time */}
        <TimeBadge>{fmt(displayTime)}</TimeBadge>
      </PlayerRow>

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

        {/* Download decrypted .ogg */}
        <ActionBtn
          type="button"
          onClick={handleDownloadDecrypted}
          disabled={downloadingRaw || downloadingDecrypted}
          $loading={downloadingDecrypted}
          title="Download voice message as .ogg"
        >
          {downloadingDecrypted ? (
            <Spinner />
          ) : (
            <DownloadSimpleIcon size={11} weight="bold" />
          )}
          .ogg
        </ActionBtn>
      </ActionRow>
    </VoiceBubble>
  );
};
