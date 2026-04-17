import { useCallback, useRef, useState } from "react";
import styled from "styled-components";
import { toast } from "sonner";
import {
  ChatInputBox,
  type SelectedImageState,
  type SelectedAttachmentState,
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
import { MajikFile } from "@majikah/majik-file";

/* ======================================================
 * Upload constants
 * ====================================================== */

/** Minimum YARA score to allow upload (mirrors UserFiles) */
const IMAGE_SCAN_PASS_THRESHOLD = 70;
const ATTACHMENT_SCAN_PASS_THRESHOLD = 70;

/* ======================================================
 * Scanner singleton (shared across image + attachment paths)
 * ====================================================== */

const fileScanner = new MajikFileScanner();
let fileScannerReady = false;

async function ensureFileScanner(): Promise<void> {
  if (!fileScannerReady) {
    await fileScanner.initialize();
    fileScannerReady = true;
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
 * Types
 * ====================================================== */

interface UploadedFileRef {
  file: MajikFile;
  context: "chat_image" | "chat_attachment";
}

/* ======================================================
 * Component
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

  // ── Image upload state ────────────────────────────────────────────────────
  const [imageUploadState, setImageUploadState] =
    useState<SelectedImageState | null>(null);
  const uploadedImageRef = useRef<UploadedFileRef | null>(null);

  // ── Attachment upload state ───────────────────────────────────────────────
  const [attachmentUploadState, setAttachmentUploadState] =
    useState<SelectedAttachmentState | null>(null);
  const uploadedAttachmentRef = useRef<UploadedFileRef | null>(null);

  /* ====================================================================
   * Shared pipeline helpers
   * ==================================================================== */

  /** Resolves non-self participant public keys from fingerprints. */
  const resolveRecipientPubKeys = useCallback(
    async (selfFp: string): Promise<string[]> => {
      return (
        await Promise.all(
          participants.filter((fp) => fp !== selfFp).map(async (fp) => fp), // extend with pubkey resolution if needed
        )
      ).filter(Boolean) as string[];
    },
    [participants],
  );

  /* ====================================================================
   * Text + file message composition + send
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

    // ── Append image tag if image is ready ──────────────────────────────
    if (uploadedImageRef.current) {
      const intentBody: UploadIntentBody = {
        fileHash: uploadedImageRef.current.file.toJSON().file_hash,
        sizeOriginal: uploadedImageRef.current.file.toJSON().size_original,
        mimeType: uploadedImageRef.current.file.toJSON().mime_type,
        context: uploadedImageRef.current.context,
        isTemporary: true,
        expiresAt: uploadedImageRef.current.file.toJSON().expires_at,
        originalName: uploadedImageRef.current.file.toJSON().original_name,
        conversationId: conversationID,
        chatMessageId: null,
      };

      const confirmedImage = await majik.uploadFile(
        intentBody,
        uploadedImageRef.current.file,
      );

      if (confirmedImage.id) {
        composed = composed
          ? `${composed}\n[img:${confirmedImage.id}]`
          : `[img:${confirmedImage.id}]`;
      }
    }

    // ── Append file tag if attachment is ready ──────────────────────────
    if (uploadedAttachmentRef.current) {
      const fileJSON = uploadedAttachmentRef.current.file.toJSON();

      const intentBody: UploadIntentBody = {
        fileHash: fileJSON.file_hash,
        sizeOriginal: fileJSON.size_original,
        mimeType: fileJSON.mime_type,
        context: uploadedAttachmentRef.current.context,
        isTemporary: true,
        expiresAt: fileJSON.expires_at,
        originalName: fileJSON.original_name,
        conversationId: conversationID,
        chatMessageId: null,
      };

      const confirmedFile = await majik.uploadFile(
        intentBody,
        uploadedAttachmentRef.current.file,
      );

      if (confirmedFile.id) {
        composed = composed
          ? `${composed}\n[file:${confirmedFile.id}]`
          : `[file:${confirmedFile.id}]`;
      }
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
      uploadedAttachmentRef.current;

    if (!hasContent) return;

    toast.promise(processSend(currentUserPublicKey, finalText), {
      loading: "Sending message...",
      success: (outputMessage) => {
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

        // Clear image state
        if (imageUploadState?.previewUrl) {
          URL.revokeObjectURL(imageUploadState.previewUrl);
        }
        setImageUploadState(null);
        uploadedImageRef.current = null;

        // Clear attachment state
        setAttachmentUploadState(null);
        uploadedAttachmentRef.current = null;

        return outputMessage;
      },
      error: (error) => `${error.message}`,
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
   * Image upload pipeline: scan → encrypt → ready
   * ==================================================================== */

  const handleSelectImage = useCallback(
    async (file: File) => {
      const previewUrl = URL.createObjectURL(file);

      setImageUploadState({ file, previewUrl, status: "scanning" });
      uploadedImageRef.current = null;

      try {
        // ── YARA scan ────────────────────────────────────────────────────
        await ensureFileScanner();
        const scanResult: FileScanResult = await fileScanner.scan(file);

        if (scanResult.score < IMAGE_SCAN_PASS_THRESHOLD) {
          const reason =
            scanResult.status === "flagged"
              ? `YARA threat detected (${scanResult.remarks.length} rule(s) matched)`
              : `Scan score too low (${scanResult.score}/100, minimum ${IMAGE_SCAN_PASS_THRESHOLD})`;

          setImageUploadState((prev) =>
            prev ? { ...prev, status: "error", errorMessage: reason } : null,
          );
          toast.error(`Image blocked — ${reason}`, {
            id: "toast-img-scan-blocked",
            duration: 8000,
          });
          return;
        }

        // ── Encrypt ──────────────────────────────────────────────────────
        setImageUploadState((prev) =>
          prev ? { ...prev, status: "uploading" } : null,
        );

        if (!majik.currentIdentity)
          throw new Error("No active identity — please log in.");

        const recipientPubKeys = await resolveRecipientPubKeys(
          majik.currentIdentity.id,
        );

        const bytes = new Uint8Array(await file.arrayBuffer());

        const encryptedResult = await majik.encryptFile({
          data: bytes,
          mimeType: file.type || "image/jpeg",
          originalName: file.name,
          context: "chat_image",
          isTemporary: true,
          userId: majik?.user?.id,
          expiresAt: 15,
          recipients: recipientPubKeys,
          compressionLevel: 6,
          conversationId: conversationID,
        });

        uploadedImageRef.current = {
          file: encryptedResult.file,
          context: "chat_image",
        };

        setImageUploadState((prev) =>
          prev ? { ...prev, status: "ready" } : null,
        );

        toast.success("Image ready", {
          description: "Press send to attach it to your message.",
          id: "toast-img-ready",
          duration: 3000,
        });
      } catch (err) {
        console.error("[RealtimeChatInput] image upload error:", err);
        const msg = err instanceof Error ? err.message : "Upload failed";
        setImageUploadState((prev) =>
          prev ? { ...prev, status: "error", errorMessage: msg } : null,
        );
        toast.error("Image upload failed", {
          description: msg,
          id: "toast-img-upload-error",
          duration: 6000,
        });
      }
    },
    [majik, conversationID, resolveRecipientPubKeys],
  );

  const handleDismissImage = useCallback(() => {
    if (imageUploadState?.previewUrl) {
      URL.revokeObjectURL(imageUploadState.previewUrl);
    }
    setImageUploadState(null);
    uploadedImageRef.current = null;
  }, [imageUploadState]);

  /* ====================================================================
   * Attachment upload pipeline: scan → encrypt → ready
   * ==================================================================== */

  const handleSelectAttachment = useCallback(
    async (file: File) => {
      setAttachmentUploadState({ file, status: "scanning" });
      uploadedAttachmentRef.current = null;

      try {
        // ── YARA scan ────────────────────────────────────────────────────
        await ensureFileScanner();
        const scanResult: FileScanResult = await fileScanner.scan(file);

        if (scanResult.score < ATTACHMENT_SCAN_PASS_THRESHOLD) {
          const reason =
            scanResult.status === "flagged"
              ? `YARA threat detected (${scanResult.remarks.length} rule(s) matched)`
              : `Scan score too low (${scanResult.score}/100, minimum ${ATTACHMENT_SCAN_PASS_THRESHOLD})`;

          setAttachmentUploadState((prev) =>
            prev ? { ...prev, status: "error", errorMessage: reason } : null,
          );
          toast.error(`File blocked — ${reason}`, {
            id: "toast-attachment-scan-blocked",
            duration: 8000,
          });
          return;
        }

        // ── Encrypt ──────────────────────────────────────────────────────
        setAttachmentUploadState((prev) =>
          prev ? { ...prev, status: "uploading" } : null,
        );

        if (!majik.currentIdentity)
          throw new Error("No active identity — please log in.");

        const recipientPubKeys = await resolveRecipientPubKeys(
          majik.currentIdentity.id,
        );

        const bytes = new Uint8Array(await file.arrayBuffer());

        const encryptedResult = await majik.encryptFile({
          data: bytes,
          mimeType: file.type || "application/octet-stream",
          originalName: file.name,
          context: "chat_attachment",
          isTemporary: true,
          userId: majik?.user?.id,
          expiresAt: 1,
          recipients: recipientPubKeys,
          compressionLevel: 6,
          conversationId: conversationID,
        });

        uploadedAttachmentRef.current = {
          file: encryptedResult.file,
          context: "chat_attachment",
        };

        setAttachmentUploadState((prev) =>
          prev ? { ...prev, status: "ready" } : null,
        );

        toast.success("File ready", {
          description: "Press send to attach it to your message.",
          id: "toast-attachment-ready",
          duration: 3000,
        });
      } catch (err) {
        console.error("[RealtimeChatInput] attachment upload error:", err);
        const msg = err instanceof Error ? err.message : "Upload failed";
        setAttachmentUploadState((prev) =>
          prev ? { ...prev, status: "error", errorMessage: msg } : null,
        );
        toast.error("File upload failed", {
          description: msg,
          id: "toast-attachment-upload-error",
          duration: 6000,
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
        onSelectImage={handleSelectImage}
        imageUploadState={imageUploadState}
        onDismissImage={handleDismissImage}
        onSelectAttachment={handleSelectAttachment}
        attachmentUploadState={attachmentUploadState}
        onDismissAttachment={handleDismissAttachment}
      />
    </InputWrapper>
  );
};
