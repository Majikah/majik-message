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

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";
const MAX_CHARS = 10000;

// ─── Image upload constants ───────────────────────────────────────────────────
const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const IMAGE_MAX_DIMENSION = 4000; // px
const IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";
const IMAGE_ACCEPT_EXTS = ["jpg", "jpeg", "png", "webp"];

// ─── GIF compositing helper ───────────────────────────────────────────────────
function composeMessageWithGif(text: string, gifUrl: string | null): string {
  const trimmed = text.trim();
  if (!gifUrl) return trimmed;
  if (!trimmed) return `[gif:${gifUrl}]`;
  return `${trimmed}\n[gif:${gifUrl}]`;
}

// ─── Image validation ─────────────────────────────────────────────────────────

/**
 * Validates a File for chat image upload:
 *   - Must be jpeg/jpg/png/webp
 *   - Must be ≤ 10 MB
 *   - Dimensions must be ≤ 4000 × 4000
 *
 * Returns null on success, or an error message string.
 */
async function validateImageFile(file: File): Promise<string | null> {
  // ── Extension / MIME check ────────────────────────────────────────────────
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!IMAGE_ACCEPT_EXTS.includes(ext)) {
    return `Unsupported format "${ext}". Allowed: ${IMAGE_ACCEPT_EXTS.join(", ")}`;
  }

  // ── Size check ────────────────────────────────────────────────────────────
  if (file.size > IMAGE_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `Image too large (${mb} MB). Maximum is 10 MB.`;
  }

  // ── Dimension check ───────────────────────────────────────────────────────
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (
        img.naturalWidth > IMAGE_MAX_DIMENSION ||
        img.naturalHeight > IMAGE_MAX_DIMENSION
      ) {
        resolve(
          `Image too large (${img.naturalWidth}×${img.naturalHeight}px). Maximum is ${IMAGE_MAX_DIMENSION}×${IMAGE_MAX_DIMENSION}px.`,
        );
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("Could not read image dimensions.");
    };
    img.src = url;
  });
}

// ─── Giphy client fetchers ────────────────────────────────────────────────────

const buildTrendingFetcher =
  () => async (offset: number, majikah: MajikahSession) => {
    const queryKey = `__TRENDING__:${offset}:20`;
    const cached = await loadQueryResult(queryKey);
    if (cached) return cached;
    const result = await majikah.apiClient.get<API_RESPONSE_GIPHY_RESULT>(
      `/giphy/trending?offset=${offset}&limit=20`,
    );
    await saveQueryResult(queryKey, result.data);
    return result.data;
  };

const buildSearchFetcher =
  (query: string) => async (offset: number, majikah: MajikahSession) => {
    const normalized = query.trim().toLowerCase();
    const queryKey = `${normalized}:${offset}:20`;
    const cached = await loadQueryResult(queryKey);
    if (cached) return cached;
    const result = await majikah.apiClient.get<API_RESPONSE_GIPHY_RESULT>(
      `/giphy/search?q=${encodeURIComponent(normalized)}&offset=${offset}&limit=20`,
    );
    await saveQueryResult(queryKey, result.data);
    return result.data;
  };

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

const GifPreviewDismiss = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
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

const GifPreviewLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  text-transform: uppercase;
`;

// ─── Image preview strip ──────────────────────────────────────────────────────

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

const ImagePreviewDismiss = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
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

const ImagePreviewStatus = styled.span<{
  $uploading?: boolean;
  $error?: boolean;
}>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.04em;
  color: ${({ $uploading, $error }) =>
    $error ? "#f06449" : $uploading ? "#f5a623" : "#3ecf8e"};
  opacity: 0.85;
`;

// ─── Reserved input warning banner ───────────────────────────────────────────
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
  min-height: 90px;
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

const SendBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: ${({ theme }) => theme.gradients.strong};
  color: ${({ theme }) => theme.colors.primaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 4px;
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

// ─── Types ────────────────────────────────────────────────────────────────────
type PickerMode = "emoji" | "gif" | null;

/** Status of an image being prepared for upload by the parent */
export type ImageUploadStatus =
  | "validating"
  | "scanning"
  | "uploading"
  | "ready"
  | "error";

export interface SelectedImageState {
  file: File;
  /** Object URL for preview — revoke when done */
  previewUrl: string;
  status: ImageUploadStatus;
  errorMessage?: string;
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
  /** Enable the image upload button */
  enableImageUpload?: boolean;
  /**
   * Called when the user selects a valid image file.
   * The parent is responsible for scanning, encrypting, and uploading.
   * The parent should call back via `imageUploadStatus` to reflect progress.
   */
  onSelectImage?: (file: File) => void;
  /**
   * Current image upload state driven by the parent.
   * When provided and status === "ready", the image is treated as attached
   * (similar to a selected GIF) and is sent with the next message.
   */
  imageUploadState?: SelectedImageState | null;
  /** Called when the user dismisses the selected/uploading image */
  onDismissImage?: () => void;
}

// ─── Reserved warning toast ID (deduplicated) ─────────────────────────────────
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
  onSelectImage,
  imageUploadState,
  onDismissImage,
}) => {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
  const [gifQuery, setGifQuery] = useState("");
  const [debouncedGifQuery, setDebouncedGifQuery] = useState("");
  const [gifGridKey, setGifGridKey] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const onEmojiSelectRef = useRef<(emoji: { native: string }) => void>(
    () => {},
  );

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  // ── Close picker on outside click ─────────────────────────────────────────
  useEffect(() => {
    if (!pickerMode) return;
    const handleOutside = (e: MouseEvent): void => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setPickerMode(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [pickerMode]);

  // ── GIF search debounce ────────────────────────────────────────────────────
  const debouncedSetQuery = useMemo(
    () =>
      debounce((q: string) => {
        setDebouncedGifQuery(q);
        setGifGridKey((k) => k + 1);
      }, 400),
    [],
  );

  useEffect(() => () => debouncedSetQuery.cancel(), [debouncedSetQuery]);

  const handleGifQueryChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const q = e.target.value;
    setGifQuery(q);
    debouncedSetQuery(q);
  };

  // ── Giphy Grid fetch function ──────────────────────────────────────────────
  const fetchGifs = useMemo(
    () =>
      debouncedGifQuery.trim()
        ? buildSearchFetcher(debouncedGifQuery.trim())
        : buildTrendingFetcher(),
    [debouncedGifQuery],
  );

  // ── GIF select ─────────────────────────────────────────────────────────────
  const handleGifSelect = useCallback((gif: IGif, e: React.SyntheticEvent) => {
    e.preventDefault();
    setSelectedGif(gif);
    setPickerMode(null);
    setGifQuery("");
    setDebouncedGifQuery("");
  }, []);

  // ── Emoji insertion ────────────────────────────────────────────────────────
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

  // eslint-disable-next-line react-hooks/refs
  onEmojiSelectRef.current = insertEmoji;

  const togglePicker = (mode: PickerMode): void => {
    setPickerMode((prev) => (prev === mode ? null : mode));
  };

  // ── Image file picker ──────────────────────────────────────────────────────
  const handleImageInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset input so the same file can be re-picked after dismissal
      e.target.value = "";
      if (!file || !onSelectImage) return;

      const validationError = await validateImageFile(file);
      if (validationError) {
        toast.error("Image rejected", {
          description: validationError,
          id: "toast-img-validation",
          duration: 6000,
        });
        return;
      }

      onSelectImage(file);
    },
    [onSelectImage],
  );

  // ── Reserved system message guard ─────────────────────────────────────────
  const inputIsReserved = isReserved(value);

  // ── Derived image state ────────────────────────────────────────────────────
  const imageIsUploading =
    imageUploadState?.status === "validating" ||
    imageUploadState?.status === "scanning" ||
    imageUploadState?.status === "uploading";

  const imageIsReady = imageUploadState?.status === "ready";
  const imageHasError = imageUploadState?.status === "error";

  const imageStatusLabel = (() => {
    switch (imageUploadState?.status) {
      case "validating":
        return "Validating…";
      case "scanning":
        return "Scanning…";
      case "uploading":
        return "Uploading…";
      case "ready":
        return "Ready to send";
      case "error":
        return imageUploadState.errorMessage ?? "Upload failed";
      default:
        return "";
    }
  })();

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async (): Promise<void> => {
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

    const gifUrl = selectedGif?.images?.original?.url ?? null;
    const composed = composeMessageWithGif(value, gifUrl);

    // Block send while image is still processing
    if (imageUploadState && imageIsUploading) {
      toast.info("Please wait — image is still uploading.");
      return;
    }

    if (!composed && !imageIsReady) return;

    try {
      await onSend(composed);
      setValue("");
      setSelectedGif(null);
      onUpdate?.(composed);
      // Note: parent clears imageUploadState after onSend resolves
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (!sendOnEnter) return;
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const charCount = value.length;
  const nearLimit = charCount > MAX_CHARS * 0.9;
  const canSend =
    !inputIsReserved &&
    !imageIsUploading &&
    !imageHasError &&
    (value.trim().length > 0 || selectedGif !== null || imageIsReady);

  const gifPreviewUrl =
    selectedGif?.images?.fixed_height_small?.url ??
    selectedGif?.images?.fixed_height?.url ??
    null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Wrapper ref={wrapperRef}>
      {/* Hidden image file input */}
      {enableImageUpload && (
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          onChange={handleImageInputChange}
        />
      )}

      {/* Popover */}
      {pickerMode && (
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

      {/* GIF preview strip */}
      {selectedGif && gifPreviewUrl && enableGIF && (
        <GifPreviewStrip>
          <GifPreviewThumb>
            <GifPreviewImg
              src={gifPreviewUrl}
              alt={selectedGif.title ?? "GIF"}
              data-private
            />
            <GifPreviewDismiss
              onClick={() => setSelectedGif(null)}
              title="Remove GIF"
              type="button"
            >
              <XIcon size={10} weight="bold" />
            </GifPreviewDismiss>
          </GifPreviewThumb>
          <GifPreviewLabel>GIF attached · tap to replace</GifPreviewLabel>
        </GifPreviewStrip>
      )}

      {/* Image preview strip */}
      {enableImageUpload && imageUploadState && (
        <ImagePreviewStrip>
          <ImagePreviewThumb>
            <ImagePreviewImg
              src={imageUploadState.previewUrl}
              alt="Selected image"
              data-private
            />
            <ImagePreviewDismiss
              onClick={onDismissImage}
              title="Remove image"
              type="button"
            >
              <XIcon size={10} weight="bold" />
            </ImagePreviewDismiss>
          </ImagePreviewThumb>
          <ImagePreviewMeta>
            <ImagePreviewLabel>
              {imageIsReady ? "Image attached" : "Processing image…"}
            </ImagePreviewLabel>
            <ImagePreviewStatus
              $uploading={imageIsUploading}
              $error={imageHasError}
            >
              {imageStatusLabel}
            </ImagePreviewStatus>
          </ImagePreviewMeta>
        </ImagePreviewStrip>
      )}

      {/* Reserved system tag warning banner */}
      {inputIsReserved && (
        <ReservedWarning>
          ⚠ Message contains a reserved system tag and cannot be sent.
        </ReservedWarning>
      )}

      {/* Input row */}
      <InputRow>
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
        </Toolbar>

        <TextareaWrap $focused={focused} $reserved={inputIsReserved}>
          <StyledTextarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              imageUploadState
                ? "Add a caption for your image…"
                : selectedGif
                  ? "Add a message to go with your GIF…"
                  : (placeholder ?? "Message… (Shift+Enter for new line)")
            }
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

        <SendBtn
          onClick={handleSend}
          disabled={!canSend}
          title={
            inputIsReserved
              ? "Message contains a reserved system tag"
              : imageIsUploading
                ? "Image is still uploading…"
                : "Send message"
          }
          type="button"
        >
          <PaperPlaneRightIcon size={16} weight="bold" />
        </SendBtn>
      </InputRow>
    </Wrapper>
  );
};
