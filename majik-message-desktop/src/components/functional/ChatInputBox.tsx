import {
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import styled, { css } from "styled-components";
import {
  PaperPlaneRightIcon,
  SmileyIcon,
  XIcon,
  ImageIcon,
  PaperclipIcon,
  MicrophoneIcon,
  ArrowLeftIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  loadQueryResult,
  saveQueryResult,
  type API_RESPONSE_GIPHY_RESULT,
} from "@/lib/idb/giphy-cache";
import type { IGif } from "@giphy/js-types";
import { debounce } from "@/utils/utils";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Grid } from "@giphy/react-components";
import type { MajikahSession } from "../majikah-session-wrapper/majikah-session";
import { isReserved } from "../base/_message_parsers";
import { VoiceMessageRecorder } from "./VoiceMessageRecorder";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";
const MAX_CHARS = 10000;

// ─── Image upload constants ───────────────────────────────────────────────────
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 4000;
const IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";
const IMAGE_ACCEPT_EXTS = ["jpg", "jpeg", "png", "webp"];

// ─── Attachment upload constants ──────────────────────────────────────────────
const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

const ATTACHMENT_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const ATTACHMENT_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const ATTACHMENT_BLOCKED_MIMES = new Set<string>([]);
const ATTACHMENT_BLOCKED_EXTS = new Set([
  "bat",
  "cmd",
  "com",
  "cpl",
  "hta",
  "inf",
  "ins",
  "isp",
  "jse",
  "lnk",
  "msc",
  "msi",
  "msp",
  "pif",
  "scr",
  "shs",
  "vb",
  "vbe",
  "vbs",
  "vxd",
  "wsc",
  "wsf",
  "wsh",
]);

// ─── GIF compositing helper ───────────────────────────────────────────────────
function composeMessageWithGif(text: string, gifUrl: string | null): string {
  const trimmed = text.trim();
  if (!gifUrl) return trimmed;
  if (!trimmed) return `[gif:${gifUrl}]`;
  return `${trimmed}\n[gif:${gifUrl}]`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Validation ───────────────────────────────────────────────────────────────
async function validateImageFile(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!IMAGE_ACCEPT_EXTS.includes(ext))
    return `Unsupported format "${ext}". Allowed: ${IMAGE_ACCEPT_EXTS.join(", ")}`;
  if (file.size > IMAGE_MAX_BYTES)
    return `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(
        img.naturalWidth > IMAGE_MAX_DIMENSION ||
          img.naturalHeight > IMAGE_MAX_DIMENSION
          ? `Image dimensions too large. Max ${IMAGE_MAX_DIMENSION}×${IMAGE_MAX_DIMENSION}px.`
          : null,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("Could not read image dimensions.");
    };
    img.src = url;
  });
}

export const ATTACHMENT_IS_IMAGE = "IS_IMAGE" as const;

export async function validateAttachmentFile(
  file: File,
): Promise<typeof ATTACHMENT_IS_IMAGE | string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type.toLowerCase();
  if (ATTACHMENT_IMAGE_MIMES.has(mime) || ATTACHMENT_IMAGE_EXTS.has(ext))
    return ATTACHMENT_IS_IMAGE;
  if (ATTACHMENT_BLOCKED_EXTS.has(ext))
    return `Files with extension ".${ext}" are not allowed.`;
  if (ATTACHMENT_BLOCKED_MIMES.has(mime))
    return `Files of type "${mime}" are not allowed.`;
  if (file.size > ATTACHMENT_MAX_BYTES)
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 25 MB.`;
  if (file.size === 0) return "Cannot attach an empty file.";
  return null;
}

// ─── Giphy client fetchers ────────────────────────────────────────────────────
const buildTrendingFetcher =
  () => async (offset: number, majikah: MajikahSession) => {
    const key = `__TRENDING__:${offset}:20`;
    const cached = await loadQueryResult(key);
    if (cached) return cached;
    const result = await majikah.apiClient.get<API_RESPONSE_GIPHY_RESULT>(
      `/giphy/trending?offset=${offset}&limit=20`,
    );
    await saveQueryResult(key, result.data);
    return result.data;
  };

const buildSearchFetcher =
  (query: string) => async (offset: number, majikah: MajikahSession) => {
    const norm = query.trim().toLowerCase();
    const key = `${norm}:${offset}:20`;
    const cached = await loadQueryResult(key);
    if (cached) return cached;
    const result = await majikah.apiClient.get<API_RESPONSE_GIPHY_RESULT>(
      `/giphy/search?q=${encodeURIComponent(norm)}&offset=${offset}&limit=20`,
    );
    await saveQueryResult(key, result.data);
    return result.data;
  };

// ─── Types ────────────────────────────────────────────────────────────────────
type PickerMode = "emoji" | "gif" | null;

export type ImageUploadStatus =
  | "validating"
  | "scanning"
  | "encrypting"
  | "uploading"
  | "ready"
  | "error";

export type AttachmentUploadStatus =
  | "validating"
  | "scanning"
  | "encrypting"
  | "uploading"
  | "ready"
  | "error";

export type VoiceUploadStatus =
  | "pending"
  | "encrypting"
  | "uploading"
  | "ready"
  | "error";

export interface SelectedImageState {
  file: File;
  previewUrl: string;
  status: ImageUploadStatus;
  errorMessage?: string;
}

export interface SelectedAttachmentState {
  file: File;
  status: AttachmentUploadStatus;
  errorMessage?: string;
}

export interface SelectedVoiceState {
  blob: Blob;
  status: VoiceUploadStatus;
  errorMessage?: string;
  durationSeconds?: number;
}

interface ChatInputBoxProps {
  majikah: MajikahSession;
  onSend: (text: string) => Promise<void> | void;
  onUpdate?: (text: string) => void;
  placeholder?: string;
  maxHeight?: number;
  disabled?: boolean;
  sendOnEnter?: boolean;
  enableGIF?: boolean;
  enableEmoji?: boolean;
  enableImageUpload?: boolean;
  enableFileUpload?: boolean;
  enableVoiceMessage?: boolean;
  onSelectImage?: (file: File) => void;
  imageUploadState?: SelectedImageState | null;
  onDismissImage?: () => void;
  onSelectAttachment?: (file: File) => void;
  attachmentUploadState?: SelectedAttachmentState | null;
  onDismissAttachment?: () => void;
  /** Called when the user confirms a voice recording */
  onSelectVoice?: (blob: Blob) => void;
  voiceUploadState?: SelectedVoiceState | null;
  onDismissVoice?: () => void;
}

const RESERVED_TOAST_ID = "majik-reserved-input-warning";

// ─── Component ────────────────────────────────────────────────────────────────
export const ChatInputBox: React.FC<ChatInputBoxProps> = ({
  majikah,
  onSend,
  onUpdate,
  placeholder,
  maxHeight = 200,
  disabled = false,
  sendOnEnter = true,
  enableGIF = true,
  enableEmoji = true,
  enableImageUpload = false,
  enableFileUpload = false,
  enableVoiceMessage = true,
  onSelectImage,
  imageUploadState,
  onDismissImage,
  onSelectAttachment,
  attachmentUploadState,
  onDismissAttachment,
  onSelectVoice,
  voiceUploadState,
  onDismissVoice,
}) => {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
  const [gifQuery, setGifQuery] = useState("");
  const [debouncedGifQuery, setDebouncedGifQuery] = useState("");
  const [gifGridKey, setGifGridKey] = useState(0);

  // Voice mode: "idle" = normal text UI; "active" = recorder has taken over
  const [voiceMode, setVoiceMode] = useState<"idle" | "active">("idle");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const onEmojiSelectRef = useRef<(emoji: { native: string }) => void>(
    () => {},
  );

  // ── Auto-resize textarea ────────────────────────────────────────────────
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  // ── Close picker on outside click ───────────────────────────────────────
  useEffect(() => {
    if (!pickerMode) return;
    const handle = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      )
        setPickerMode(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [pickerMode]);

  // ── GIF search debounce ─────────────────────────────────────────────────
  const debouncedSetQuery = useMemo(
    () =>
      debounce((q: string) => {
        setDebouncedGifQuery(q);
        setGifGridKey((k) => k + 1);
      }, 400),
    [],
  );
  useEffect(() => () => debouncedSetQuery.cancel(), [debouncedSetQuery]);

  const handleGifQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setGifQuery(q);
    debouncedSetQuery(q);
  };

  const fetchGifs = useMemo(
    () =>
      debouncedGifQuery.trim()
        ? buildSearchFetcher(debouncedGifQuery.trim())
        : buildTrendingFetcher(),
    [debouncedGifQuery],
  );

  const handleGifSelect = useCallback((gif: IGif, e: React.SyntheticEvent) => {
    e.preventDefault();
    setSelectedGif(gif);
    setPickerMode(null);
    setGifQuery("");
    setDebouncedGifQuery("");
  }, []);

  // ── Emoji insertion ─────────────────────────────────────────────────────
  const insertEmoji = useCallback(
    (emoji: { native: string }) => {
      const ta = textareaRef.current;
      const native = emoji.native;
      if (!native) return;
      if (ta) {
        const start = ta.selectionStart ?? value.length;
        const end = ta.selectionEnd ?? value.length;
        const newValue = value.slice(0, start) + native + value.slice(end);
        if (newValue.length <= MAX_CHARS) {
          setValue(newValue);
          onUpdate?.(newValue);
          requestAnimationFrame(() => {
            ta.focus();
            const pos = start + native.length;
            ta.setSelectionRange(pos, pos);
          });
        }
      } else {
        const newValue = value + native;
        if (newValue.length <= MAX_CHARS) {
          setValue(newValue);
          onUpdate?.(newValue);
        }
      }
    },
    [value, onUpdate],
  );
  onEmojiSelectRef.current = insertEmoji;

  const togglePicker = (mode: PickerMode) =>
    setPickerMode((p) => (p === mode ? null : mode));

  // ── Image file picker ───────────────────────────────────────────────────
  const handleImageInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !onSelectImage) return;
      const err = await validateImageFile(file);
      if (err) {
        toast.error("Image rejected", {
          description: err,
          id: "toast-img-validation",
          duration: 6000,
        });
        return;
      }
      onSelectImage(file);
    },
    [onSelectImage],
  );

  // ── Attachment file picker ──────────────────────────────────────────────
  const handleAttachmentInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const result = await validateAttachmentFile(file);
      if (result === ATTACHMENT_IS_IMAGE) {
        if (!onSelectImage) {
          toast.error("Image uploads not enabled here.", {
            id: "toast-attachment-img-redirect-disabled",
          });
          return;
        }
        const imageErr = await validateImageFile(file);
        if (imageErr) {
          toast.error("Image rejected", {
            description: imageErr,
            id: "toast-img-validation",
            duration: 6000,
          });
          return;
        }
        toast.info("Detected image — handling as image upload.", {
          id: "toast-attachment-img-redirect",
          duration: 3000,
        });
        onSelectImage(file);
        return;
      }
      if (result !== null) {
        toast.error("Attachment rejected", {
          description: result,
          id: "toast-attachment-validation",
          duration: 6000,
        });
        return;
      }
      onSelectAttachment?.(file);
    },
    [onSelectImage, onSelectAttachment],
  );

  // ── Voice handlers ──────────────────────────────────────────────────────
  const handleVoiceRecordDone = useCallback(
    (blob: Blob) => {
      // Recorder moves to preview phase on its own; we notify parent to start processing
      onSelectVoice?.(blob);
      // Keep voice mode "active" so the recorder's preview UI is shown
    },
    [onSelectVoice],
  );

  const handleVoiceCancel = useCallback(() => {
    setVoiceMode("idle");
    onDismissVoice?.();
  }, [onDismissVoice]);

  // When user double-clicks mic (hands-free start) or long-presses, activate voice mode
  // The recorder itself manages its internal phase; we just need to show it
  const handleMicActivate = useCallback(() => {
    if (disabled) return;
    setVoiceMode("active");
  }, [disabled]);

  // ── Reserved system message guard ───────────────────────────────────────
  const inputIsReserved = isReserved(value);

  // ── Derived image/attachment/voice state ────────────────────────────────
  const imageIsUploading = [
    "validating",
    "scanning",
    "encrypting",
    "uploading",
  ].includes(imageUploadState?.status ?? "");
  const imageIsReady = imageUploadState?.status === "ready";
  const imageHasError = imageUploadState?.status === "error";
  const imageStatusLabel = statusLabel(
    imageUploadState?.status,
    imageUploadState?.errorMessage,
  );

  const attachmentIsUploading = [
    "validating",
    "scanning",
    "encrypting",
    "uploading",
  ].includes(attachmentUploadState?.status ?? "");
  const attachmentIsReady = attachmentUploadState?.status === "ready";
  const attachmentHasError = attachmentUploadState?.status === "error";
  const attachmentStatusLabel = statusLabel(
    attachmentUploadState?.status,
    attachmentUploadState?.errorMessage,
  );
  const attachmentExt =
    attachmentUploadState?.file.name.split(".").pop()?.toUpperCase() ?? "FILE";

  const voiceIsUploading = ["encrypting", "uploading"].includes(
    voiceUploadState?.status ?? "",
  );
  const voiceIsReady = voiceUploadState?.status === "ready";
  const voiceHasError = voiceUploadState?.status === "error";
  const voiceStatusLabel = statusLabel(
    voiceUploadState?.status,
    voiceUploadState?.errorMessage,
  );

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (inputIsReserved) {
      toast.error("Message contains reserved content.", {
        description: "System tags cannot be sent manually.",
        id: RESERVED_TOAST_ID,
      });
      return;
    }
    if (disabled) {
      toast.error("Assign recipients first.");
      return;
    }
    if (imageUploadState && imageIsUploading) {
      toast.info("Please wait — image is still uploading.");
      return;
    }
    if (attachmentUploadState && attachmentIsUploading) {
      toast.info("Please wait — file is still uploading.");
      return;
    }
    if (voiceUploadState && voiceIsUploading) {
      toast.info("Please wait — voice message is still uploading.");
      return;
    }

    const gifUrl = selectedGif?.images?.original?.url ?? null;
    const composed = composeMessageWithGif(value, gifUrl);

    if (!composed && !imageIsReady && !attachmentIsReady && !voiceIsReady)
      return;

    try {
      await onSend(composed);
      setValue("");
      setSelectedGif(null);
      onUpdate?.(composed);
      if (voiceIsReady) {
        setVoiceMode("idle");
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (!sendOnEnter) return;
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARS) {
      setValue(text);
      onUpdate?.(text);
    } else {
      const t = text.slice(0, MAX_CHARS);
      setValue(t);
      onUpdate?.(t);
      toast.error("Message too long", {
        description: `Limited to ${MAX_CHARS.toLocaleString()} characters.`,
      });
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const charCount = value.length;
  const nearLimit = charCount > MAX_CHARS * 0.9;
  const canSend =
    !inputIsReserved &&
    !imageIsUploading &&
    !imageHasError &&
    !attachmentIsUploading &&
    !attachmentHasError &&
    !voiceIsUploading &&
    !voiceHasError &&
    (value.trim().length > 0 ||
      selectedGif !== null ||
      imageIsReady ||
      attachmentIsReady ||
      voiceIsReady);

  const gifPreviewUrl =
    selectedGif?.images?.fixed_height_small?.url ??
    selectedGif?.images?.fixed_height?.url ??
    null;

  const derivedPlaceholder = (() => {
    if (imageUploadState) return "Add a caption for your image…";
    if (attachmentUploadState) return "Add a message to go with your file…";
    if (selectedGif) return "Add a message to go with your GIF…";
    return placeholder ?? "Message… (Shift+Enter for new line)";
  })();

  // Activate voice mode when recorder first interaction detected
  // We intercept pointerdown on the mic button via a wrapper
  const isVoiceActive = voiceMode === "active";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Wrapper ref={wrapperRef}>
      {enableImageUpload && (
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          onChange={handleImageInputChange}
        />
      )}
      {enableFileUpload && (
        <input
          ref={attachmentInputRef}
          type="file"
          accept="*/*"
          hidden
          onChange={handleAttachmentInputChange}
        />
      )}

      {/* Popover */}
      {pickerMode && !isVoiceActive && (
        <Popover ref={popoverRef} data-private>
          {pickerMode === "emoji" && enableEmoji && (
            <Picker
              data={data}
              theme="dark"
              set="native"
              previewPosition="none"
              skinTonePosition="none"
              onEmojiSelect={(emoji: { native: string }) =>
                onEmojiSelectRef.current(emoji)
              }
            />
          )}
          {pickerMode === "gif" && enableGIF && (
            <GifPanel>
              <GifSearchBar>
                <GifSearchInput
                  value={gifQuery}
                  onChange={handleGifQueryChange}
                  placeholder="Search GIFs or browse trending…"
                  autoFocus
                  data-private
                />
              </GifSearchBar>
              <GifGrid data-private>
                <Grid
                  key={gifGridKey}
                  fetchGifs={(offset) => fetchGifs(offset, majikah)}
                  width={316}
                  columns={3}
                  gutter={4}
                  onGifClick={handleGifSelect}
                  noLink
                  hideAttribution
                />
              </GifGrid>
              <GifAttribution>Powered by GIPHY</GifAttribution>
            </GifPanel>
          )}
        </Popover>
      )}

      {/* GIF preview */}
      {selectedGif && gifPreviewUrl && enableGIF && !isVoiceActive && (
        <GifPreviewStrip>
          <GifPreviewThumb>
            <GifPreviewImg
              src={gifPreviewUrl}
              alt={selectedGif.title ?? "GIF"}
              data-private
            />
            <DismissBtn
              onClick={() => setSelectedGif(null)}
              title="Remove GIF"
              type="button"
            >
              <XIcon size={10} weight="bold" />
            </DismissBtn>
          </GifPreviewThumb>
          <GifPreviewLabel>GIF attached · tap to replace</GifPreviewLabel>
        </GifPreviewStrip>
      )}

      {/* Image preview */}
      {enableImageUpload && imageUploadState && !isVoiceActive && (
        <ImagePreviewStrip>
          <ImagePreviewThumb>
            <ImagePreviewImg
              src={imageUploadState.previewUrl}
              alt="Selected image"
              data-private
            />
            <DismissBtn
              onClick={onDismissImage}
              title="Remove image"
              type="button"
            >
              <XIcon size={10} weight="bold" />
            </DismissBtn>
          </ImagePreviewThumb>
          <ImagePreviewMeta>
            <ImagePreviewLabel>
              {imageIsReady ? "Image attached" : "Processing image…"}
            </ImagePreviewLabel>
            <UploadStatus $uploading={imageIsUploading} $error={imageHasError}>
              {imageStatusLabel}
            </UploadStatus>
          </ImagePreviewMeta>
        </ImagePreviewStrip>
      )}

      {/* Attachment preview */}
      {enableFileUpload && attachmentUploadState && !isVoiceActive && (
        <AttachmentPreviewStrip>
          <AttachmentPreviewCard>
            <AttachmentPreviewIcon>
              <AttachmentExtBadge>{attachmentExt}</AttachmentExtBadge>
            </AttachmentPreviewIcon>
            <AttachmentPreviewInfo>
              <AttachmentPreviewName title={attachmentUploadState.file.name}>
                {attachmentUploadState.file.name}
              </AttachmentPreviewName>
              <AttachmentPreviewSize>
                {formatBytes(attachmentUploadState.file.size)}
              </AttachmentPreviewSize>
              <UploadStatus
                $uploading={attachmentIsUploading}
                $error={attachmentHasError}
              >
                {attachmentStatusLabel}
              </UploadStatus>
            </AttachmentPreviewInfo>
            <DismissBtn
              onClick={onDismissAttachment}
              title="Remove attachment"
              type="button"
              $absolute
            >
              <XIcon size={10} weight="bold" />
            </DismissBtn>
          </AttachmentPreviewCard>
        </AttachmentPreviewStrip>
      )}

      {/* Voice upload status strip (shown when voice is ready/uploading after confirmation) */}
      {enableVoiceMessage && voiceUploadState && isVoiceActive && (
        <VoiceStatusStrip>
          <VoiceStatusDot
            $uploading={voiceIsUploading}
            $ready={voiceIsReady}
            $error={voiceHasError}
          />
          <VoiceStatusText $uploading={voiceIsUploading} $error={voiceHasError}>
            {voiceStatusLabel}
          </VoiceStatusText>
        </VoiceStatusStrip>
      )}

      {/* Reserved warning */}
      {inputIsReserved && !isVoiceActive && (
        <ReservedWarning>
          ⚠ Message contains a reserved system tag and cannot be sent.
        </ReservedWarning>
      )}

      {/* Input row */}
      <InputRow>
        {/* Toolbar — hidden in voice mode */}
        {!isVoiceActive && (
          <Toolbar>
            {enableEmoji && (
              <ToolBtn
                $active={pickerMode === "emoji"}
                title="Emoji"
                onClick={() => togglePicker("emoji")}
                type="button"
              >
                <SmileyIcon
                  size={15}
                  weight={pickerMode === "emoji" ? "fill" : "regular"}
                />
              </ToolBtn>
            )}
            {enableGIF && (
              <ToolBtn
                $active={pickerMode === "gif" || selectedGif !== null}
                title="GIF"
                onClick={() => togglePicker("gif")}
                type="button"
              >
                <GifLabel>GIF</GifLabel>
              </ToolBtn>
            )}
            {enableImageUpload && (
              <ToolBtn
                $active={!!imageUploadState}
                title="Upload image"
                onClick={() => imageInputRef.current?.click()}
                type="button"
                disabled={!!imageUploadState}
              >
                <ImageIcon
                  size={15}
                  weight={imageUploadState ? "fill" : "regular"}
                />
              </ToolBtn>
            )}
            {enableFileUpload && (
              <ToolBtn
                $active={!!attachmentUploadState}
                title="Attach file"
                onClick={() => attachmentInputRef.current?.click()}
                type="button"
                disabled={!!attachmentUploadState}
              >
                <PaperclipIcon
                  size={15}
                  weight={attachmentUploadState ? "fill" : "regular"}
                />
              </ToolBtn>
            )}
          </Toolbar>
        )}

        {/* Main content area: textarea OR voice recorder */}
        {isVoiceActive ? (
          // Voice recorder takes up the entire middle area
          <VoiceArea>
            <MicToggleBtn
              type="button"
              disabled={disabled}
              title="Record voice message"
              onClick={handleVoiceCancel}
            >
              <ArrowLeftIcon size={16} weight="bold" />
      
            </MicToggleBtn>
            <VoiceMessageRecorder
              onRecordDone={handleVoiceRecordDone}
              onCancel={handleVoiceCancel}
              onError={(msg) => {
                toast.error(msg);
                setVoiceMode("idle");
              }}
              disabled={disabled}
            />
          </VoiceArea>
        ) : (
          <TextareaWrap $focused={focused} $reserved={inputIsReserved}>
            <StyledTextarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={derivedPlaceholder}
              rows={1}
              $maxHeight={maxHeight}
              maxLength={MAX_CHARS}
              data-private="lipsum"
            />
            <InputMeta>
              <CharCount $nearLimit={nearLimit}>
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </CharCount>
              <KeyHint>↵ send · ⇧↵ new line</KeyHint>
            </InputMeta>
          </TextareaWrap>
        )}

        {/* Right-side actions */}
        <RightActions>
          {/* Mic toggle button — activates voice mode. Only shown when not in voice mode yet */}
          {enableVoiceMessage && !isVoiceActive && (
            <MicToggleBtn
              type="button"
              disabled={disabled}
              title="Record voice message"
              onClick={handleMicActivate}
            >
              <MicrophoneIcon size={16} weight="bold" />
              <MicActivateHint>Hold or double-tap to record</MicActivateHint>
            </MicToggleBtn>
          )}

          <SendBtn
            onClick={handleSend}
            disabled={!canSend}
            title={
              inputIsReserved
                ? "Message contains a reserved system tag"
                : imageIsUploading
                  ? "Image is still uploading…"
                  : attachmentIsUploading
                    ? "File is still uploading…"
                    : voiceIsUploading
                      ? "Voice message is still uploading…"
                      : "Send message"
            }
            type="button"
          >
            <PaperPlaneRightIcon size={16} weight="bold" />
          </SendBtn>
        </RightActions>
      </InputRow>
    </Wrapper>
  );
};

// ─── Status label helper ──────────────────────────────────────────────────────
function statusLabel(
  status: string | undefined,
  errorMessage?: string,
): string {
  switch (status) {
    case "validating":
      return "Validating…";
    case "scanning":
      return "Scanning…";
    case "encrypting":
      return "Encrypting…";
    case "uploading":
      return "Uploading…";
    case "pending":
      return "Pending…";
    case "ready":
      return "Ready to send";
    case "error":
      return errorMessage ?? "Upload failed";
    default:
      return "";
  }
}

// ─── Styled components ────────────────────────────────────────────────────────

const Wrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
  width: 100%;
`;

// ── Preview strips ────────────────────────────────────────────────────────────

const GifPreviewStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 0;
`;

const GifPreviewThumb = styled.div`
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(79, 110, 247, 0.35);
  flex-shrink: 0;
  height: 72px;
  width: auto;
  max-width: 120px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const GifPreviewImg = styled.img`
  height: 72px;
  width: auto;
  max-width: 120px;
  display: block;
  object-fit: cover;
`;

const GifPreviewLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  text-transform: uppercase;
`;

const ImagePreviewStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 0;
`;

const ImagePreviewThumb = styled.div`
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(62, 207, 142, 0.35);
  flex-shrink: 0;
  height: 72px;
  width: auto;
  max-width: 120px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const ImagePreviewImg = styled.img`
  height: 72px;
  width: auto;
  max-width: 120px;
  display: block;
  object-fit: cover;
`;

const ImagePreviewMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const ImagePreviewLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  text-transform: uppercase;
`;

/** Unified upload status label (replaces the three separate ones) */
const UploadStatus = styled.span<{ $uploading?: boolean; $error?: boolean }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.04em;
  color: ${({ $uploading, $error }) =>
    $error ? "#f06449" : $uploading ? "#f5a623" : "#3ecf8e"};
  opacity: 0.85;
`;

const AttachmentPreviewStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 0;
`;

const AttachmentPreviewCard = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 32px 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(245, 166, 35, 0.35);
  background: ${({ theme }) => theme.colors.secondaryBackground};
  min-width: 0;
  max-width: 280px;
`;

const AttachmentPreviewIcon = styled.div`
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 7px;
  background: rgba(245, 166, 35, 0.12);
  border: 1px solid rgba(245, 166, 35, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f5a623;
`;

const AttachmentExtBadge = styled.span`
  font-family: ${FONT_MONO};
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #f5a623;
`;

const AttachmentPreviewInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const AttachmentPreviewName = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
`;

const AttachmentPreviewSize = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

/** Shared dismiss button — absolute-positioned variant for card overlays */
const DismissBtn = styled.button<{ $absolute?: boolean }>`
  ${({ $absolute }) =>
    $absolute &&
    `
    position: absolute;
    top: 5px;
    right: 5px;
  `}
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.85);
  transition: background 100ms;
  &:hover {
    background: rgba(0, 0, 0, 0.85);
  }
`;

// ── Voice status strip ────────────────────────────────────────────────────────

const VoiceStatusStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 0;
`;

const VoiceStatusDot = styled.span<{
  $uploading?: boolean;
  $ready?: boolean;
  $error?: boolean;
}>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $uploading, $ready, $error }) =>
    $error
      ? "#f06449"
      : $ready
        ? "#3ecf8e"
        : $uploading
          ? "#f5a623"
          : "rgba(255,255,255,0.2)"};
`;

const VoiceStatusText = styled.span<{ $uploading?: boolean; $error?: boolean }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.05em;
  color: ${({ $uploading, $error }) =>
    $error ? "#f06449" : $uploading ? "#f5a623" : "#3ecf8e"};
  opacity: 0.85;
`;

// ── Input row ─────────────────────────────────────────────────────────────────

const ReservedWarning = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  background: rgba(248, 113, 113, 0.08);
  border-top: 1px solid rgba(248, 113, 113, 0.18);
  font-family: ${FONT_MONO};
  font-size: 10px;
  letter-spacing: 0.04em;
  color: #f87171;
`;

const InputRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
`;

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 4px;
  flex-shrink: 0;
`;

const ToolBtn = styled.button<{ $active?: boolean }>`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition:
    border-color 120ms ease,
    color 120ms ease,
    background 120ms ease;
  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-color: ${({ theme }) => theme.colors.textSecondary};
    color: ${({ theme }) => theme.colors.primary};
  }
  ${({ $active, theme }) =>
    $active &&
    css`
      background: ${theme.colors.secondaryBackground};
      border-color: rgba(79, 110, 247, 0.45);
      color: ${theme.colors.primary};
    `}
`;

const GifLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 1;
`;

const TextareaWrap = styled.div<{ $focused: boolean; $reserved: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid
    ${({ $focused, $reserved, theme }) =>
      $reserved
        ? "rgba(248, 113, 113, 0.45)"
        : $focused
          ? theme.colors.primary
          : "transparent"};
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 150ms ease;
`;

const StyledTextarea = styled.textarea<{ $maxHeight: number }>`
  width: 100%;
  padding: 11px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  min-height: 120px;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
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
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.4;
  }
`;

const InputMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 12px 7px;
`;

const CharCount = styled.span<{ $nearLimit: boolean }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.06em;
  color: ${({ $nearLimit, theme }) =>
    $nearLimit
      ? (theme.colors.error ?? theme.colors.primary)
      : theme.colors.textSecondary};
  opacity: ${({ $nearLimit }) => ($nearLimit ? 1 : 0.4)};
  transition:
    color 150ms ease,
    opacity 150ms ease;
`;

const KeyHint = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
`;

// ── Voice area ────────────────────────────────────────────────────────────────

const VoiceArea = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  min-height: 48px;
  gap: 0.5em;
`;

// ── Right actions column ──────────────────────────────────────────────────────

const RightActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  margin-top: 4px;
`;

const MicToggleBtn = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 10px;
  border: none;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    opacity 120ms,
    transform 120ms;
  position: relative;
  overflow: hidden;
  &:hover:not(:disabled) {
    opacity: 0.85;
    transform: scale(1.05);
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

/** Visually hidden hint — the actual icon comes from VoiceMessageRecorder's mic button */
const MicActivateHint = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  overflow: hidden;
`;

const SendBtn = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 10px;
  border: none;
  background: ${({ theme }) => theme.gradients.strong};
  color: ${({ theme }) => theme.colors.primaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    opacity 120ms ease,
    transform 120ms ease;
  &:hover:not(:disabled) {
    opacity: 0.85;
    transform: scale(1.05);
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none;
  }
`;

// ── Popover ────────────────────────────────────────────────────────────────────

const Popover = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 10px;
  z-index: 100;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};

  em-emoji-picker {
    --border-radius: 0px;
    --background-rgb: 26, 30, 39;
    --rgb-background: 26, 30, 39;
    --rgb-color: 232, 234, 240;
    --rgb-accent: 79, 110, 247;
    --rgb-input: 20, 23, 32;
    --shadow: none;
    --border-width: 0px;
    height: 360px;
    width: fit-content;
  }
`;

const GifPanel = styled.div`
  width: 340px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const GifSearchBar = styled.div`
  padding: 10px 12px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
`;

const GifSearchInput = styled.input`
  width: 100%;
  padding: 7px 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  outline: none;
  transition: border-color 120ms;
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.5;
  }
  &:focus {
    border-color: rgba(79, 110, 247, 0.5);
  }
`;

const GifGrid = styled.div`
  overflow-y: auto;
  padding: 8px;
  height: 312px;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.colors.primaryBackground} transparent`};
  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primaryBackground};
    border-radius: 4px;
  }
  & > div {
    width: 100% !important;
  }
`;

const GifAttribution = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 5px 10px 7px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
  letter-spacing: 0.05em;
  border-top: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
`;
