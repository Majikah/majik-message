import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import styled, { css, keyframes } from "styled-components";
import {
  MicrophoneIcon,
  StopIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────
const HOLD_DELAY_MS     = 500;
const PREFERRED_MIME    = "audio/ogg; codecs=opus";
const FALLBACK_MIME     = "audio/webm; codecs=opus";
const AUDIO_BITRATE     = 64_000; // 64 kbps — for MediaRecorder
const SAMPLE_RATE       = 16_000; // 16 kHz — fine for voice
const MAX_RECORD_SECS   = 60;     // hard cap — soft stop at 60 s, then trim guarantee

// ─── Types ────────────────────────────────────────────────────────────────────
/** idle      → no recording, textarea visible
 *  recording → actively capturing (hold or hands-free)
 *  trimming  → mic stopped, trimAudioBlob is running (brief async gap)
 *  preview   → recording done, playback controls shown
 */
type RecorderPhase = "idle" | "recording" | "trimming" | "preview";
type RecordingMode = "holding" | "handsfree";

export interface VoiceMessageRecorderProps {
  /** Called when the user confirms the recording (hits send / parent decides) */
  onRecordDone: (blob: Blob) => void;
  /** Called when the user discards and wants to go back to typing */
  onCancel?: () => void;
  /** Called on permission denial or any error */
  onError?: (msg: string) => void;
  /** Waveform accent colour */
  waveColor?: string;
  disabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number): string {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Audio trim helper ────────────────────────────────────────────────────────
/**
 * Decodes `blob` via Web Audio API and re-encodes only the first `maxSecs`
 * seconds as a new OGG/WebM Opus blob. This is the hard-guarantee trim that
 * runs regardless of how recording was stopped.
 *
 * Falls back to the original blob if the browser has no MediaRecorder support
 * for the target MIME (shouldn't happen — we already checked earlier) or if
 * the recording is already within the limit.
 */
async function trimAudioBlob(blob: Blob, maxSecs: number): Promise<Blob> {
  const mimeType = MediaRecorder.isTypeSupported(PREFERRED_MIME)
    ? PREFERRED_MIME
    : FALLBACK_MIME;

  try {
    // ── Fast path: check duration via HTMLAudioElement metadata ─────────────
    // The browser's demuxer reads just the container header to get duration —
    // no full decode, no ArrayBuffer copy. Typically resolves in <5 ms.
    const fastDuration = await new Promise<number>((resolve) => {
      const audio = new Audio();
      const url   = URL.createObjectURL(blob);
      audio.preload        = "metadata";
      audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(audio.duration); };
      audio.onerror          = () => { URL.revokeObjectURL(url); resolve(Infinity); }; // fail-safe: proceed to full decode
      audio.src = url;
    });

    // Under the limit — return immediately, zero AudioContext overhead
    if (isFinite(fastDuration) && fastDuration <= maxSecs) return blob;

    // ── Slow path: only reached when blob genuinely exceeds the limit ────────
    const arrayBuffer  = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const decoded      = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();

    // Double-check after full decode (handles Infinity from onerror above)
    if (decoded.duration <= maxSecs) return blob;

    const sampleRate   = decoded.sampleRate;
    const trimSamples  = Math.floor(maxSecs * sampleRate);
    const numChannels  = decoded.numberOfChannels;

    const trimmed = new AudioContext({ sampleRate }).createBuffer(
      numChannels,
      trimSamples,
      sampleRate,
    );

    for (let ch = 0; ch < numChannels; ch++) {
      trimmed.copyToChannel(
        decoded.getChannelData(ch).slice(0, trimSamples),
        ch,
      );
    }

    // Re-encode via MediaRecorder capturing from an AudioBufferSourceNode
    return await new Promise<Blob>((resolve, reject) => {
      const offlineCtx = new OfflineAudioContext(
        numChannels,
        trimSamples,
        sampleRate,
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = trimmed;
      source.connect(offlineCtx.destination);
      source.start();

      offlineCtx.startRendering().then((renderedBuffer) => {
        // Convert OfflineAudioContext output → MediaStream → MediaRecorder → Blob
        const streamCtx    = new AudioContext({ sampleRate });
        const streamSource = streamCtx.createBufferSource();
        streamSource.buffer = renderedBuffer;
        const dest = streamCtx.createMediaStreamDestination();
        streamSource.connect(dest);
        streamSource.start();

        const recorder = new MediaRecorder(dest.stream, {
          mimeType,
          audioBitsPerSecond: AUDIO_BITRATE,
        });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
          await streamCtx.close();
          resolve(new Blob(chunks, { type: mimeType }));
        };
        recorder.start();

        // Stop recorder just after the audio finishes
        const durationMs = (renderedBuffer.duration + 0.1) * 1000;
        setTimeout(() => { recorder.stop(); streamSource.stop(); }, durationMs);
      }).catch(reject);
    });
  } catch (err) {
    console.warn("[VoiceMessageRecorder] trimAudioBlob failed — using original:", err);
    return blob; // safe fallback
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export const VoiceMessageRecorder: React.FC<VoiceMessageRecorderProps> = ({
  onRecordDone,
  onCancel,
  onError,
  waveColor = "#4F6EF7",
  disabled = false,
}) => {
  const [phase, setPhase]           = useState<RecorderPhase>("idle");
  const [recordMode, setRecordMode] = useState<RecordingMode | null>(null);

  // Playback state (preview phase only)
  const [previewBlob, setPreviewBlob]       = useState<Blob | null>(null);
  const [previewUrl,  setPreviewUrl]        = useState<string | null>(null);
  const [isPlaying,   setIsPlaying]         = useState(false);
  const [duration,    setDuration]          = useState(0);
  const [currentTime, setCurrentTime]       = useState(0);

  // Elapsed recording timer
  const [elapsed, setElapsed] = useState(0);

  // Refs
  const holdTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldIntentRef      = useRef(false);
  const cancelFlagRef        = useRef(false);
  const streamRef            = useRef<MediaStream | null>(null);
  const elapsedIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Two separate waveform containers — recording live waveform & preview waveform
  const recordContainerRef   = useRef<HTMLDivElement>(null);
  const previewContainerRef  = useRef<HTMLDivElement>(null);

  const wavesurferRecRef     = useRef<WaveSurfer | null>(null);
  const recordPluginRef      = useRef<ReturnType<typeof RecordPlugin.create> | null>(null);
  const wavesurferPrevRef    = useRef<WaveSurfer | null>(null);

  // ─── Cleanup helpers ────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (elapsedIntervalRef.current) { clearInterval(elapsedIntervalRef.current); elapsedIntervalRef.current = null; }
    if (limitTimerRef.current)      { clearTimeout(limitTimerRef.current);       limitTimerRef.current = null; }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const destroyRecorder = useCallback(() => {
    try { wavesurferRecRef.current?.destroy(); } catch { /* */ }
    wavesurferRecRef.current  = null;
    recordPluginRef.current   = null;
  }, []);

  const destroyPreview = useCallback(() => {
    try { wavesurferPrevRef.current?.destroy(); } catch { /* */ }
    wavesurferPrevRef.current = null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewBlob(null);
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      clearTimers();
      stopTracks();
      destroyRecorder();
      destroyPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Build preview WaveSurfer once previewUrl is set ────────────────────
  useEffect(() => {
    if (!previewUrl || !previewContainerRef.current) return;

    const ws = WaveSurfer.create({
      container:     previewContainerRef.current,
      waveColor:     "rgba(255,255,255,0.2)",
      progressColor: waveColor,
      cursorColor:   "transparent",
      height:        36,
      barWidth:      2,
      barGap:        2,
      barRadius:     2,
      interact:      true,
      url:           previewUrl,
    });

    ws.on("ready", () => setDuration(ws.getDuration()));
    ws.on("audioprocess", () => setCurrentTime(ws.getCurrentTime()));
    ws.on("seeking", () => setCurrentTime(ws.getCurrentTime()));
    ws.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(ws.getDuration());
    });

    wavesurferPrevRef.current = ws;
    return () => {
      try { ws.destroy(); } catch { /* */ }
    };
  }, [previewUrl, waveColor]);

  // ─── Core recording logic ────────────────────────────────────────────────
  const startRecording = useCallback(async (mode: RecordingMode) => {
    if (phase !== "idle") return;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      const msg = "Microphone access denied";
      toast.error(msg);
      onError?.(msg);
      return;
    }
    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported(PREFERRED_MIME)
      ? PREFERRED_MIME
      : FALLBACK_MIME;

    destroyRecorder();
    if (!recordContainerRef.current) { stopTracks(); return; }

    const ws = WaveSurfer.create({
      container:     recordContainerRef.current,
      waveColor,
      progressColor: "rgba(255,255,255,0.5)",
      height:        36,
      barWidth:      2,
      barGap:        2,
      barRadius:     2,
      interact:      false,
    });

    const record = ws.registerPlugin(
      RecordPlugin.create({
        mimeType,
        audioBitsPerSecond: AUDIO_BITRATE,
        scrollingWaveform:  true,
        renderRecordedAudio: false,
      }),
    );

    record.on("record-end", async (blob: Blob) => {
      // Always clear timers first
      clearTimers();
      setElapsed(0);

      if (cancelFlagRef.current) {
        cancelFlagRef.current = false;
        setPhase("idle");
        setRecordMode(null);
        stopTracks();
        setTimeout(destroyRecorder, 0);
        return;
      }

      // Signal that we're processing — mic is off but preview isn't ready yet
      setPhase("trimming");

      // ── Hard trim guarantee: crop to MAX_RECORD_SECS no matter what ────
      const safeBlob = await trimAudioBlob(blob, MAX_RECORD_SECS);

      // Transition to preview
      const url = URL.createObjectURL(safeBlob);
      setPreviewBlob(safeBlob);
      setPreviewUrl(url);
      setPhase("preview");
      setRecordMode(null);
      stopTracks();
      setTimeout(destroyRecorder, 0);
    });

    wavesurferRecRef.current = ws;
    recordPluginRef.current  = record;

    await record.startRecording({ sampleRate: SAMPLE_RATE });
    setPhase("recording");
    setRecordMode(mode);

    // ── Elapsed counter (ticks every second) ───────────────────────────────
    setElapsed(0);
    elapsedIntervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // ── Soft limit: auto-stop at MAX_RECORD_SECS ───────────────────────────
    limitTimerRef.current = setTimeout(() => {
      if (recordPluginRef.current?.isRecording()) {
        toast.info(`Recording limit reached (${MAX_RECORD_SECS}s).`);
        recordPluginRef.current.stopRecording();
      }
    }, MAX_RECORD_SECS * 1000);

  }, [phase, waveColor, onError, stopTracks, destroyRecorder, clearTimers]);

  const stopRecording = useCallback(() => {
    clearTimers();
    setElapsed(0);
    if (recordPluginRef.current?.isRecording()) {
      recordPluginRef.current.stopRecording();
    } else {
      setPhase("idle");
      setRecordMode(null);
      stopTracks();
    }
  }, [stopTracks, clearTimers]);

  const cancelRecording = useCallback(() => {
    clearTimers();
    setElapsed(0);
    cancelFlagRef.current = true;
    if (recordPluginRef.current?.isRecording()) {
      recordPluginRef.current.stopRecording();
    } else {
      cancelFlagRef.current = false;
      setPhase("idle");
      setRecordMode(null);
      stopTracks();
      destroyRecorder();
    }
  }, [stopTracks, destroyRecorder, clearTimers]);

  // ─── Preview controls ────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (!wavesurferPrevRef.current) return;
    wavesurferPrevRef.current.playPause();
    setIsPlaying((p) => !p);
  }, []);

  /** Clear recording — if reRecord=true, immediately start a new one */
  const handleClear = useCallback(async (reRecord: boolean) => {
    destroyPreview();
    setPhase("idle");
    if (reRecord) {
      // Give React a tick to unmount preview container before starting fresh
      setTimeout(() => startRecording("handsfree"), 50);
    } else {
      onCancel?.();
    }
  }, [destroyPreview, startRecording, onCancel]);

  /** Confirm and hand blob to parent */
  const handleConfirm = useCallback(() => {
    if (previewBlob) {
      onRecordDone(previewBlob);
      destroyPreview();
      setPhase("idle");
    }
  }, [previewBlob, onRecordDone, destroyPreview]);

  // ─── Button interaction ──────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled || phase !== "idle") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isHoldIntentRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldIntentRef.current = true;
      startRecording("holding");
    }, HOLD_DELAY_MS);
  }, [disabled, phase, startRecording]);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (phase === "recording" && recordMode === "holding" && isHoldIntentRef.current) {
      stopRecording();
    }
    isHoldIntentRef.current = false;
  }, [phase, recordMode, stopRecording]);

  const handleClick = useCallback(() => {
    if (phase === "recording" && recordMode === "handsfree") stopRecording();
  }, [phase, recordMode, stopRecording]);

  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (phase === "idle") startRecording("handsfree");
  }, [disabled, phase, startRecording]);

  // ─── Render ──────────────────────────────────────────────────────────────
  const isActivelyRecording = phase === "recording";
  const isTrimming          = phase === "trimming";

  return (
    <Root>
      {/* ── Mic trigger button (always visible) ───────────────────────── */}
      <MicBtn
        $phase={phase}
        disabled={disabled || phase === "preview" || phase === "trimming"}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
        title={
          phase === "preview" || phase === "trimming"
            ? "Recording captured"
            : phase === "recording"
              ? recordMode === "handsfree"
                ? "Click to stop"
                : "Release to stop"
              : "Hold to record · Double-click for hands-free"
        }
      >
        {phase === "recording" && recordMode === "handsfree"
          ? <StopIcon size={16} weight="fill" />
          : <MicrophoneIcon size={16} weight={isActivelyRecording ? "fill" : "regular"} />
        }
      </MicBtn>

      {/* ── Live recording waveform panel ─────────────────────────────── */}
      <Panel $visible={phase === "recording"} aria-hidden={phase !== "recording"}>
        <LiveWave ref={recordContainerRef} />
        <RecordingMeta>
          <ElapsedTimer $nearLimit={elapsed >= MAX_RECORD_SECS - 10}>
            {fmt(elapsed)}
            <ElapsedLimit>/ {fmt(MAX_RECORD_SECS)}</ElapsedLimit>
          </ElapsedTimer>
          <RecordingLabel>
            <PulseDot />
            {recordMode === "handsfree" ? "Click mic to stop" : "Release to stop"}
          </RecordingLabel>
        </RecordingMeta>
        {recordMode === "handsfree" && (
          <IconBtn type="button" $variant="danger" onClick={cancelRecording} title="Discard">
            <TrashIcon size={13} weight="bold" />
          </IconBtn>
        )}
      </Panel>

      {/* ── Trimming / processing panel ────────────────────────────────── */}
      <Panel $visible={isTrimming} aria-hidden={!isTrimming}>
        <TrimmingSpinner />
        <TrimmingLabel>Processing…</TrimmingLabel>
      </Panel>

      {/* ── Preview / playback panel ───────────────────────────────────── */}
      <Panel $visible={phase === "preview"} aria-hidden={phase !== "preview"}>
        <PlaybackControls>
          {/* Play / Pause */}
          <IconBtn type="button" $variant="primary" onClick={handlePlayPause} title={isPlaying ? "Pause" : "Play"}>
            {isPlaying
              ? <PauseIcon size={13} weight="fill" />
              : <PlayIcon  size={13} weight="fill" />
            }
          </IconBtn>

          {/* Waveform seek area */}
          <PreviewWave ref={previewContainerRef} />

          {/* Duration */}
          <TimeBadge>{fmt(isPlaying || currentTime > 0 ? currentTime : duration)}</TimeBadge>
        </PlaybackControls>

        <PreviewActions>
          {/* Re-record */}
          <IconBtn
            type="button"
            $variant="muted"
            onClick={() => handleClear(true)}
            title="Record again"
          >
            <ArrowCounterClockwiseIcon size={13} weight="bold" />
          </IconBtn>
          {/* Discard → back to typing */}
          <IconBtn
            type="button"
            $variant="danger"
            onClick={() => handleClear(false)}
            title="Discard"
          >
            <TrashIcon size={13} weight="bold" />
          </IconBtn>
          {/* Confirm / ready to send */}
          <ConfirmBtn type="button" onClick={handleConfirm} title="Use this recording">
            Use
          </ConfirmBtn>
        </PreviewActions>
      </Panel>
    </Root>
  );
};

// ─── Animations ───────────────────────────────────────────────────────────────
const pulseMic = keyframes`
  0%   { box-shadow: 0 0 0 0   rgba(239,68,68,0.5); }
  70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0   rgba(239,68,68,0); }
`;

const dotBlink = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateX(0)   scale(1); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

// ─── Styled Components ────────────────────────────────────────────────────────
const Root = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

const MicBtn = styled.button<{ $phase: RecorderPhase }>`
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme, $phase }) =>
    $phase === "recording"
      ? "#ef4444"
      : $phase === "preview" || $phase === "trimming"
        ? theme.colors.primary
        : theme.colors.textSecondary};
  cursor: pointer;
  touch-action: none;
  user-select: none;
  transition: background 120ms, border-color 120ms, color 120ms;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme, $phase }) =>
      $phase === "recording" ? "#ef4444" : theme.colors.primary};
  }

  ${({ $phase }) => $phase === "recording" && css`
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.45);
    animation: ${pulseMic} 1.5s ease-out infinite;
  `}

  ${({ $phase, theme }) => ($phase === "preview" || $phase === "trimming") && css`
    background: ${theme.colors.secondaryBackground};
    border-color: rgba(79,110,247,0.35);
    cursor: default;
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TrimmingSpinner = styled.span`
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-top-color: rgba(255, 255, 255, 0.55);
  animation: ${spin} 0.7s linear infinite;
`;

const TrimmingLabel = styled.span`
  font-family: 'Fira Mono', 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`;

const Panel = styled.div<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 48px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  padding: 0 10px;
  overflow: hidden;
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  position: ${({ $visible }) => ($visible ? "relative" : "absolute")};

  ${({ $visible }) => $visible && css`
    animation: ${slideIn} 180ms ease forwards;
  `}
`;

const LiveWave = styled.div`
  flex: 1;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  & > div { height: 100% !important; }
`;

const RecordingLabel = styled.span`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-family: 'Fira Mono', 'JetBrains Mono', monospace;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  white-space: nowrap;
`;

const RecordingMeta = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
`;

const ElapsedTimer = styled.span<{ $nearLimit: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 3px;
  font-family: 'Fira Mono', 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: ${({ $nearLimit }) => ($nearLimit ? "#ef4444" : "rgba(255,255,255,0.75)")};
  transition: color 300ms ease;
`;

const ElapsedLimit = styled.span`
  font-size: 9px;
  font-weight: 400;
  opacity: 0.45;
  letter-spacing: 0.04em;
`;

const PulseDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  animation: ${dotBlink} 1s ease-in-out infinite;
`;

const PlaybackControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;

const PreviewWave = styled.div`
  flex: 1;
  height: 36px;
  min-width: 0;
  overflow: hidden;
  cursor: pointer;
  & > div { height: 100% !important; }
`;

const TimeBadge = styled.span`
  flex-shrink: 0;
  font-family: 'Fira Mono', 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  min-width: 36px;
  text-align: right;
`;

const PreviewActions = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const IconBtn = styled.button<{ $variant: "primary" | "danger" | "muted" }>`
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: ${({ $variant }) =>
    $variant === "primary" ? "rgba(79,110,247,0.15)" :
    $variant === "danger"  ? "rgba(239,68,68,0.12)"  :
                              "rgba(255,255,255,0.06)"};
  color: ${({ $variant, theme }) =>
    $variant === "primary" ? theme.colors.primary :
    $variant === "danger"  ? "#ef4444"             :
                              theme.colors.textSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 120ms, color 120ms;

  &:hover {
    background: ${({ $variant }) =>
      $variant === "primary" ? "rgba(79,110,247,0.28)" :
      $variant === "danger"  ? "rgba(239,68,68,0.24)"  :
                                "rgba(255,255,255,0.12)"};
  }
`;

const ConfirmBtn = styled.button`
  flex-shrink: 0;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  border: none;
  background: ${({ theme }) => theme.gradients?.strong ?? theme.colors.primary};
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: opacity 120ms;
  &:hover { opacity: 0.85; }
`;