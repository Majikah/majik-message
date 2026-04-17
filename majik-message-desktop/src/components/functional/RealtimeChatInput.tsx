import { useCallback, useRef, useState } from "react";
import styled from "styled-components";
import { toast } from "sonner";
import {
  ChatInputBox,
  type SelectedImageState,
  type SelectedAttachmentState,
  type SelectedVoiceState,
} from "./ChatInputBox";
import type { MajikMessagePublicKey } from "@majikah/majik-message";
import { useMajikMessageRealtime } from "../majikah-session-wrapper/messages/use-majik-message-realtime";
import { isDevEnvironment } from "@/utils/utils";
import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import type { MajikahSession } from "../majikah-session-wrapper/majikah-session";
import {
  MajikFileScanner,
  type FileScanResult,
} from "@/SDK/majik-file-scanner/majik-file-scanner";
import type { UploadIntentBody } from "../majikah-session-wrapper/types/files-api";
import { FileContext, MajikFile, TempFileDuration } from "@majikah/majik-file";

/* ======================================================
 * Constants
 * ====================================================== */

const SCAN_PASS_THRESHOLD = 70; // shared across all upload types


/* ======================================================
 * Scanner singleton
 * ====================================================== */

const fileScanner = new MajikFileScanner();
let scannerInitiated = false;

async function ensureFileScanner(): Promise<void> {
  if (!scannerInitiated) {
    await fileScanner.initialize();
    scannerInitiated = true;
  }
}

/* ======================================================
 * Styled Components
 * ====================================================== */

const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: ${({ theme }) => theme.colors.secondaryBackground};
  position: relative;
  flex: 1;
`;

/* ======================================================
 * Shared upload result ref shape
 * ====================================================== */

interface UploadedFileRef {
  file: MajikFile;
  context: FileContext;
}

/* ======================================================
 * Unified file upload pipeline
 * ====================================================== */

/**
 * Options for the shared upload pipeline.
 * Scan is skipped for voice (OGG blobs are safe by construction).
 */
interface UploadPipelineOptions<TStatus extends string> {
  /** Raw bytes to encrypt */
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
  context: FileContext;
  /** Whether to skip the YARA scan (e.g. voice recordings) */
  skipScan?: boolean;
  /** Expiry in minutes for the temporary upload */
  expiresAt: TempFileDuration;
  /** Drives UI feedback */
  setStatus: (
    updater: (
      prev: { status: TStatus; errorMessage?: string } | null,
    ) => { status: TStatus; errorMessage?: string } | null,
  ) => void;
  /** Resolved recipient public keys (non-self) */
  recipientPubKeys: string[];
  majik: MajikMessageDatabase;
  conversationId: string;
}

async function runUploadPipeline<TStatus extends string>(
  opts: UploadPipelineOptions<TStatus>,
): Promise<MajikFile | null> {
  const {
    bytes,
    mimeType,
    originalName,
    context,
    skipScan = false,
    expiresAt,
    setStatus,
    recipientPubKeys,
    majik,
    conversationId,
  } = opts;

  try {
    // ── 1. YARA scan (unless skipped) ────────────────────────────────────
    if (!skipScan) {
      setStatus((prev) =>
        prev ? { ...prev, status: "scanning" as TStatus } : null,
      );
      await ensureFileScanner();
      const blob: File = new File([bytes as BlobPart], originalName, { type: mimeType });
      const scan: FileScanResult = await fileScanner.scan(blob);
      if (scan.score < SCAN_PASS_THRESHOLD) {
        const reason =
          scan.status === "flagged"
            ? `YARA threat detected (${scan.remarks.length} rule(s) matched)`
            : `Scan score too low (${scan.score}/100, minimum ${SCAN_PASS_THRESHOLD})`;
        setStatus((prev) =>
          prev
            ? { ...prev, status: "error" as TStatus, errorMessage: reason }
            : null,
        );
        toast.error(`File blocked — ${reason}`, { duration: 8000 });
        return null;
      }
    }

    // ── 2. Encrypt ────────────────────────────────────────────────────────
    setStatus((prev) =>
      prev ? { ...prev, status: "encrypting" as TStatus } : null,
    );
    if (!majik.currentIdentity)
      throw new Error("No active identity — please log in.");

    const encryptedResult = await majik.encryptFile({
      data: bytes,
      mimeType,
      originalName,
      context,
      isTemporary: true,
      userId: majik?.user?.id,
      expiresAt,
      recipients: recipientPubKeys,
      compressionLevel: 6,
      conversationId,
    });

    setStatus((prev) =>
      prev ? { ...prev, status: "ready" as TStatus } : null,
    );
    return encryptedResult.file;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    setStatus((prev) =>
      prev ? { ...prev, status: "error" as TStatus, errorMessage: msg } : null,
    );
    toast.error("Upload failed", { description: msg, duration: 6000 });
    return null;
  }
}

/* ======================================================
 * Component types
 * ====================================================== */

interface RealtimeChatInputProps {
  majikah: MajikahSession;
  majik: MajikMessageDatabase;
  onUpdate?: (text: string) => void;
  maxHeight?: number;
  disabled?: boolean;
  conversationID: string;
  participants: string[];
}

/* ======================================================
 * Component
 * ====================================================== */

export const RealtimeChatInput: React.FC<RealtimeChatInputProps> = ({
  majikah,
  majik,
  onUpdate,
  maxHeight = 200,
  participants = [],
  conversationID,
  disabled,
}) => {
  const client = useMajikMessageRealtime();
  const [, setValue] = useState("");

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ── Per-type upload state (UI) + ref (send payload) ────────────────────
  const [imageUploadState, setImageUploadState] =
    useState<SelectedImageState | null>(null);
  const [attachmentUploadState, setAttachmentUploadState] =
    useState<SelectedAttachmentState | null>(null);
  const [voiceUploadState, setVoiceUploadState] =
    useState<SelectedVoiceState | null>(null);

  const uploadedImageRef = useRef<UploadedFileRef | null>(null);
  const uploadedAttachmentRef = useRef<UploadedFileRef | null>(null);
  const uploadedVoiceRef = useRef<UploadedFileRef | null>(null);

  /* ====================================================================
   * Shared helpers
   * ==================================================================== */

  const resolveRecipientPubKeys = useCallback(
    async (selfFp: string): Promise<string[]> => {
      return participants.filter((fp) => fp !== selfFp).map((fp) => fp); // extend with pubkey resolution as needed
    },
    [participants],
  );

  /* ====================================================================
   * Send
   * ==================================================================== */

  const processSend = async (
    senderPublicKey: MajikMessagePublicKey,
    text: string,
  ): Promise<string> => {
    if (isDevEnvironment())
      console.log("Sending message from:", senderPublicKey);
    if (!senderPublicKey?.trim())
      throw new Error("A valid sender public key is required.");
    if (!majik.currentIdentity)
      throw new Error("You must have an active identity set.");
    if (!conversationID?.trim())
      throw new Error("Select a conversation first.");

    let composed = text?.trim() ?? "";

    // ── Append image tag ──────────────────────────────────────────────────
    if (uploadedImageRef.current) {
      const f = uploadedImageRef.current.file.toJSON();
      const confirmed = await majik.uploadFile(
        buildIntentBody(f, uploadedImageRef.current.context, conversationID),
        uploadedImageRef.current.file,
      );
      if (confirmed.id)
        composed = composed
          ? `${composed}\n[img:${confirmed.id}]`
          : `[img:${confirmed.id}]`;
    }

    // ── Append attachment tag ─────────────────────────────────────────────
    if (uploadedAttachmentRef.current) {
      const f = uploadedAttachmentRef.current.file.toJSON();
      const confirmed = await majik.uploadFile(
        buildIntentBody(
          f,
          uploadedAttachmentRef.current.context,
          conversationID,
        ),
        uploadedAttachmentRef.current.file,
      );
      if (confirmed.id)
        composed = composed
          ? `${composed}\n[file:${confirmed.id}]`
          : `[file:${confirmed.id}]`;
    }

    // ── Append voice tag ──────────────────────────────────────────────────
    if (uploadedVoiceRef.current) {
      const f = uploadedVoiceRef.current.file.toJSON();
      const confirmed = await majik.uploadFile(
        buildIntentBody(f, uploadedVoiceRef.current.context, conversationID),
        uploadedVoiceRef.current.file,
      );
      if (confirmed.id)
        composed = composed
          ? `${composed}\n[voice:${confirmed.id}]`
          : `[voice:${confirmed.id}]`;
    }

    if (!composed?.trim()) throw new Error("A valid message is required.");

    const composedChatMessage = await majik.createEncryptedMajikMessageChat(
      majik.currentIdentity,
      participants,
      composed,
    );
    client.sendMessage(composedChatMessage.messageChat);
    return "Message sent!";
  };

  const handleSend = async (finalText: string): Promise<void> => {
    const activeAccount = majik.getActiveAccount();
    if (!activeAccount) return;

    const currentUserPublicKey = await activeAccount.getPublicKeyBase64();

    if (!conversationID?.trim()) {
      toast.error("Select a conversation first.");
      return;
    }

    const hasContent =
      finalText?.trim() ||
      uploadedImageRef.current ||
      uploadedAttachmentRef.current ||
      uploadedVoiceRef.current;
    if (!hasContent) return;

    toast.promise(processSend(currentUserPublicKey, finalText), {
      loading: "Sending message...",
      success: (msg) => {
        // Stop typing indicator
        setTimeout(() => {
          if (isTypingRef.current) {
            isTypingRef.current = false;
            client.setTyping(false);
          }
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
        }, 1000);

        // Clear all upload state
        if (imageUploadState?.previewUrl)
          URL.revokeObjectURL(imageUploadState.previewUrl);
        setImageUploadState(null);
        uploadedImageRef.current = null;

        setAttachmentUploadState(null);
        uploadedAttachmentRef.current = null;

        setVoiceUploadState(null);
        uploadedVoiceRef.current = null;

        return msg;
      },
      error: (err) => `${err.message}`,
    });
  };

  /* ====================================================================
   * Typing indicator
   * ==================================================================== */

  const handleChange = useCallback(
    (input: string) => {
      if (!input?.trim()) {
        setValue("");
        onUpdate?.("");
        return;
      }
      if (input && !isTypingRef.current) {
        isTypingRef.current = true;
        client.setTyping(true);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          client.setTyping(false);
        }
      }, 2000);
      setValue(input);
      onUpdate?.(input);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client],
  );

  /* ====================================================================
   * Image upload
   * ==================================================================== */

  const handleSelectImage = useCallback(
    async (file: File) => {
      const previewUrl = URL.createObjectURL(file);
      setImageUploadState({ file, previewUrl, status: "scanning" });
      uploadedImageRef.current = null;

      if (!majik.currentIdentity) return;
      const recipientPubKeys = await resolveRecipientPubKeys(
        majik.currentIdentity.id,
      );
      const bytes = new Uint8Array(await file.arrayBuffer());

      const encryptedFile = await runUploadPipeline<
        SelectedImageState["status"]
      >({
        bytes,
        mimeType: file.type || "image/jpeg",
        originalName: file.name,
        context: "chat_image",
        expiresAt: 15,
        setStatus: setImageUploadState as any,
        recipientPubKeys,
        majik,
        conversationId: conversationID,
      });

      if (encryptedFile) {
        uploadedImageRef.current = {
          file: encryptedFile,
          context: "chat_image",
        };
        toast.success("Image ready", {
          description: "Press send to attach it.",
          id: "toast-img-ready",
          duration: 3000,
        });
      }
    },
    [majik, conversationID, resolveRecipientPubKeys],
  );

  const handleDismissImage = useCallback(() => {
    if (imageUploadState?.previewUrl)
      URL.revokeObjectURL(imageUploadState.previewUrl);
    setImageUploadState(null);
    uploadedImageRef.current = null;
  }, [imageUploadState]);

  /* ====================================================================
   * Attachment upload
   * ==================================================================== */

  const handleSelectAttachment = useCallback(
    async (file: File) => {
      setAttachmentUploadState({ file, status: "scanning" });
      uploadedAttachmentRef.current = null;

      if (!majik.currentIdentity) return;
      const recipientPubKeys = await resolveRecipientPubKeys(
        majik.currentIdentity.id,
      );
      const bytes = new Uint8Array(await file.arrayBuffer());

      const encryptedFile = await runUploadPipeline<
        SelectedAttachmentState["status"]
      >({
        bytes,
        mimeType: file.type || "application/octet-stream",
        originalName: file.name,
        context: "chat_attachment",
        expiresAt: 1,
        setStatus: setAttachmentUploadState as any,
        recipientPubKeys,
        majik,
        conversationId: conversationID,
      });

      if (encryptedFile) {
        uploadedAttachmentRef.current = {
          file: encryptedFile,
          context: "chat_attachment",
        };
        toast.success("File ready", {
          description: "Press send to attach it.",
          id: "toast-attachment-ready",
          duration: 3000,
        });
      }
    },
    [majik, conversationID, resolveRecipientPubKeys],
  );

  const handleDismissAttachment = useCallback(() => {
    setAttachmentUploadState(null);
    uploadedAttachmentRef.current = null;
  }, []);

  /* ====================================================================
   * Voice upload
   * Voice blobs are OGG Opus generated in-browser — skip YARA scan.
   * ==================================================================== */

  const handleSelectVoice = useCallback(
    async (blob: Blob) => {
      setVoiceUploadState({ blob, status: "pending" });
      uploadedVoiceRef.current = null;

      if (!majik.currentIdentity) return;
      const recipientPubKeys = await resolveRecipientPubKeys(
        majik.currentIdentity.id,
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());

      const encryptedFile = await runUploadPipeline<
        SelectedVoiceState["status"]
      >({
        bytes,
        mimeType: blob.type || "audio/ogg; codecs=opus",
        originalName: `voice-${Date.now()}.ogg`,
        context: "chat_voice",
        skipScan: true, // voice blobs are safe by construction
        expiresAt: 1,
        setStatus: setVoiceUploadState as any,
        recipientPubKeys,
        majik,
        conversationId: conversationID,
      });

      if (encryptedFile) {
        uploadedVoiceRef.current = {
          file: encryptedFile,
          context: "chat_voice",
        };
        toast.success("Voice message ready", {
          description: "Press send to deliver it.",
          id: "toast-voice-ready",
          duration: 3000,
        });
      }
    },
    [majik, conversationID, resolveRecipientPubKeys],
  );

  const handleDismissVoice = useCallback(() => {
    setVoiceUploadState(null);
    uploadedVoiceRef.current = null;
  }, []);

  /* ====================================================================
   * Render
   * ==================================================================== */

  return (
    <InputWrapper>
      <ChatInputBox
        majikah={majikah}
        onSend={handleSend}
        onUpdate={handleChange}
        disabled={!participants || participants.length <= 0 || disabled}
        maxHeight={maxHeight}
        enableImageUpload
        enableFileUpload
        enableVoiceMessage
        onSelectImage={handleSelectImage}
        imageUploadState={imageUploadState}
        onDismissImage={handleDismissImage}
        onSelectAttachment={handleSelectAttachment}
        attachmentUploadState={attachmentUploadState}
        onDismissAttachment={handleDismissAttachment}
        onSelectVoice={handleSelectVoice}
        voiceUploadState={voiceUploadState}
        onDismissVoice={handleDismissVoice}
      />
    </InputWrapper>
  );
};

/* ======================================================
 * Helpers
 * ====================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildIntentBody(
  fileJSON: any,
  context: FileContext,
  conversationId: string,
): UploadIntentBody {
  return {
    fileHash: fileJSON.file_hash,
    sizeOriginal: fileJSON.size_original,
    mimeType: fileJSON.mime_type,
    context,
    isTemporary: true,
    expiresAt: fileJSON.expires_at,
    originalName: fileJSON.original_name,
    conversationId,
    chatMessageId: null,
  };
}
