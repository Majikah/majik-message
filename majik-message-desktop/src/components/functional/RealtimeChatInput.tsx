import { useCallback, useRef, useState } from "react";
import styled from "styled-components";
import { toast } from "sonner";
import { ChatInputBox, type SelectedImageState } from "./ChatInputBox";
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

/* ======================================================
 * Image upload constants
 * ====================================================== */

/** Minimum YARA score to allow upload (mirrors UserFiles) */
const IMAGE_SCAN_PASS_THRESHOLD = 70;

/* ======================================================
 * Scanner singleton (shared with UserFiles to avoid double-init)
 * ====================================================== */

const imageScanner = new MajikFileScanner();
let imageScannerReady = false;

async function ensureImageScanner(): Promise<void> {
  if (!imageScannerReady) {
    await imageScanner.initialize();
    imageScannerReady = true;
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

  /**
   * Holds the uploaded image URL once the upload completes successfully.
   * This is what gets embedded in the message as [img:${url}].
   */
  const uploadedImageUrlRef = useRef<string | null>(null);

  /* ====================================================================
   * Text message send
   * ==================================================================== */

  const processSend = async (
    senderPublicKey: MajikMessagePublicKey,
    text: string,
  ): Promise<string> => {
    if (isDevEnvironment())
      console.log("Sending message from: ", senderPublicKey);

    if (!text?.trim()) {
      throw new Error("A valid message is required.");
    }

    if (!senderPublicKey?.trim()) {
      throw new Error("A valid sender public key is required.");
    }

    if (!majik.currentIdentity) {
      throw new Error("You must have an active identity set.");
    }

    if (!conversationID?.trim()) {
      throw new Error("Select a conversation first.");
    }

    const composedChatMessage = await majik.createEncryptedMajikMessageChat(
      majik.currentIdentity,
      participants,
      text,
    );

    client.sendMessage(composedChatMessage.messageChat);
    return `Message sent!`;
  };

  const handleSend = async (finalText: string): Promise<void> => {
    const activeAccount = majik.getActiveAccount();
    if (!activeAccount) return;

    const currentUserPublicKey = await activeAccount.getPublicKeyBase64();

    if (!conversationID?.trim()) {
      toast.error("Select a conversation first.");
      return;
    }

    // ── Compose text + image tag ─────────────────────────────────────────
    const imgUrl = uploadedImageUrlRef.current;
    let composed = finalText?.trim() ?? "";

    if (imgUrl) {
      // Append image tag — mirrors how GIFs are embedded
      composed = composed ? `${composed}\n[img:${imgUrl}]` : `[img:${imgUrl}]`;
    }

    if (!composed) return;

    toast.promise(processSend(currentUserPublicKey, composed), {
      loading: `Sending message...`,
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

        // Clear image state after a successful send
        if (imgUrl) {
          if (imageUploadState?.previewUrl) {
            URL.revokeObjectURL(imageUploadState.previewUrl);
          }
          setImageUploadState(null);
          uploadedImageUrlRef.current = null;
        }

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
   * Image upload pipeline: validate → scan → encrypt → upload → ready
   * ==================================================================== */

  /**
   * Called by ChatInputBox when the user picks a valid image file.
   * Runs: YARA scan → MajikFile encrypt → R2 upload → sets uploadedImageUrl.
   */
  const handleSelectImage = useCallback(
    async (file: File) => {
      // Build a preview URL immediately for the thumbnail
      const previewUrl = URL.createObjectURL(file);

      setImageUploadState({
        file,
        previewUrl,
        status: "scanning",
      });
      uploadedImageUrlRef.current = null;

      try {
        // ── Step 1: YARA scan ──────────────────────────────────────────────
        await ensureImageScanner();
        const scanResult: FileScanResult = await imageScanner.scan(file);

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

        // ── Step 2: Encrypt with MajikFile ────────────────────────────────
        setImageUploadState((prev) =>
          prev ? { ...prev, status: "uploading" } : null,
        );

        if (!majik.currentIdentity) {
          throw new Error("No active identity — please log in.");
        }

        // Resolve participant public keys (excluding self)
        const ownFingerprint = majik.currentIdentity.id;
        const recipientPubKeys = (
          await Promise.all(
            participants
              .filter((fp) => fp !== ownFingerprint)
              .map(async (fp) => {
                // participants is string[] of fingerprints; resolve pubkey via contact lookup
                // Fall back to the fingerprint itself if resolution isn't available
                return fp;
              }),
          )
        ).filter(Boolean) as string[];

        const bytes = new Uint8Array(await file.arrayBuffer());

        const encryptedResult = await majik.encryptFile({
          data: bytes,
          mimeType: file.type || "image/jpeg",
          originalName: file.name,
          context: "chat_image",
          isTemporary: true, // chat images are always temporary
          userId: majik?.user?.id,
          expiresAt: 15, // days — R2 lifecycle handles auto-delete
          recipients: recipientPubKeys,
          compressionLevel: 6, // BALANCED — fast enough for chat
          conversationId: conversationID,
        });

        const majikFile = encryptedResult.file;
        const fileJSON = majikFile.toJSON();

        // ── Step 3: Upload intent + PUT to R2 ─────────────────────────────
        const intentBody: UploadIntentBody = {
          fileHash: fileJSON.file_hash,
          sizeOriginal: fileJSON.size_original,
          mimeType: fileJSON.mime_type,
          context: "chat_image",
          isTemporary: true,
          expiresAt: fileJSON.expires_at,
          originalName: fileJSON.original_name,
          conversationId: conversationID,
          // chatMessageId is not yet known at this point — pass null;
          // the server only requires it for chat_attachment context, not chat_image
          chatMessageId: null,
        };
        console.log("Intent Body: ", intentBody);

        const confirmedFile = await majik.uploadFile(intentBody, majikFile);

        // ── Step 4: Store file ID for message embedding ───────────────────
        // The file is private and encrypted — there is no public URL.
        // We embed the fileId in the message as [img:${fileId}].
        // Each recipient's message renderer resolves a fresh presigned
        // download URL at render time via GET /files/:fileId/download,
        // then decrypts the .mjkb binary with their own identity.
        uploadedImageUrlRef.current = confirmedFile.id;

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
    [majik, conversationID, participants],
  );

  const handleDismissImage = useCallback(() => {
    if (imageUploadState?.previewUrl) {
      URL.revokeObjectURL(imageUploadState.previewUrl);
    }
    setImageUploadState(null);
    uploadedImageUrlRef.current = null;
  }, [imageUploadState]);

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
        onSelectImage={handleSelectImage}
        imageUploadState={imageUploadState}
        onDismissImage={handleDismissImage}
      />
    </InputWrapper>
  );
};
