"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import { toast } from "sonner";

import { ButtonPrimaryConfirm } from "@/globals/buttons";

import { sha256, type MajikMessagePublicKey } from "@majikah/majik-message";
import { MajikContactListSelector } from "./MajikContactListSelector";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";
import {
  ChatInputBox,
  SelectedAttachmentState,
  SelectedImageState,
} from "@/components/functional/ChatInputBox";
import { MajikContact } from "@majikah/majik-contact";
import { MajikFile } from "@majikah/majik-file";
import {
  FileScanResult,
  MajikFileScanner,
} from "@/SDK/majik-file-scanner/majik-file-scanner";
import { downloadBlob, isDevEnvironment } from "@/utils/utils";
import { MajikahSession } from "./majikah-session-wrapper/majikah-session";
import { UploadIntentBody } from "./majikah-session-wrapper/types/files-api";

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
 * Types
 * ====================================================== */

interface UploadedFileRef {
  file: MajikFile;
  context: "chat_image" | "chat_attachment";
}

/* ---------------------------------------------
 * Styled Components
 * ------------------------------------------- */
const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  color: ${({ theme }) => theme.colors.textPrimary};
  gap: 25px;
`;

const Body = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const Section = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const PreviewActions = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

const ExportButton = styled(ButtonPrimaryConfirm)`
  padding: 6px 20px;
`;

interface NewMessageFormProps {
  majikah: MajikahSession;
  majik: MajikMessageDatabase;
  onUpdate?: (message: string) => void;
  onSend?: (message: string) => void;
}

/* ---------------------------------------------
 * Component
 * ------------------------------------------- */
const NewMessageForm: React.FC<NewMessageFormProps> = ({
  majikah,
  majik,
  onUpdate,
  onSend,
}) => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  // ── Image upload state ────────────────────────────────────────────────────
  const [imageUploadState, setImageUploadState] =
    useState<SelectedImageState | null>(null);
  const uploadedImageRef = useRef<UploadedFileRef | null>(null);

  // ── Attachment upload state ───────────────────────────────────────────────
  const [attachmentUploadState, setAttachmentUploadState] =
    useState<SelectedAttachmentState | null>(null);
  const uploadedAttachmentRef = useRef<UploadedFileRef | null>(null);

  const [myAccount] = useState<MajikContact | null>(() => {
    const userAccount = majik.getActiveAccount();
    if (!userAccount) return null;
    return userAccount;
  });

  const [recipients, setRecipients] = useState<MajikContact[]>(() => {
    const myAccount = majik.getActiveAccount();
    if (!myAccount) return [];
    return [myAccount];
  });

  const [isSending, setIsSending] = useState<boolean>(false);

  const handleRecipientsUpdate = (updated: MajikContact[]): void => {
    if (updated.length === 0) {
      if (!myAccount) {
        setRecipients([]);
      } else {
        setRecipients([myAccount]);
      }
    }
    setRecipients(updated);
    handleDismissAttachment();
    handleDismissImage();
  };

  const handleRecipientsClear = (): void => {
    if (!myAccount) {
      setRecipients([]);
    } else {
      setRecipients([myAccount]);
    }
  };

  const handleCopy = useCallback(() => {
    if (!output?.trim()) {
      toast.error("Failed to copy to clipboard", {
        description: "No text to copy.",
        id: `toast-error-copy-${output}`,
      });
      return;
    }
    try {
      navigator.clipboard.writeText(output);
      toast.success("Copied to clipboard", {
        description: output.length > 200 ? output.slice(0, 200) + "…" : output,
        id: `toast-success-copy-${output}`,
      });
    } catch (e) {
      // fallback: show in prompt
      toast.error("Failed to copy to clipboard", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-copy-${output}`,
      });
    }
  }, [output]);

  const handleDownloadTxt = (): void => {
    const blob = new Blob([output], {
      type: "application/octet-stream",
    });
    downloadBlob(
      blob,
      "txt",
      `Message from ${myAccount?.meta?.label || myAccount?.id}`,
    );
  };

  const handleDownloadJson = (): void => {
    const messageJSON = {
      original: input,
      encrypted: output,
    };

    const jsonString = JSON.stringify(messageJSON);

    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    });
    downloadBlob(
      blob,
      "json",
      `Message from ${myAccount?.meta?.label || myAccount?.id}`,
    );
  };

  const handleEncryptMessage = async (input: string): Promise<void> => {
    if (!input?.trim()) {
      setInput("");
      onUpdate?.("");
      return;
    }
    setInput(input);
    onUpdate?.(input);

    if (!myAccount) {
      toast.error("No active account found.", { id: "toast-error-no-account" });
      return;
    }

    if (!recipients || recipients.length === 0) {
      toast.error("No recipients selected.", {
        id: "toast-error-no-recipients",
      });
      return;
    }

    const recipientPubKeys = await Promise.all(
      recipients.map(async (r) => {
        const rBase64 = await r.getPublicKeyBase64();
        return rBase64;
      }),
    );

    const encryptedMessage = await majik.encryptTextForScanner(
      input,
      recipientPubKeys,
      false,
    );
    setOutput(encryptedMessage ?? "");
  };

  const processSend = async (
    senderPublicKey: MajikMessagePublicKey,
    text: string,
  ): Promise<string> => {
    setIsSending(true);
    if (isDevEnvironment())
      console.log("Sending message from: ", senderPublicKey);

    if (!senderPublicKey?.trim()) {
      throw new Error("A valid sender public key is required.");
    }

    if (!recipients || recipients.length <= 1) {
      throw new Error("Assign recipients first.");
    }

    const messageRecipients = await Promise.all(
      recipients
        .filter((r) => r.isMajikahRegistered())
        .map(async (r) => r.getPublicKeyBase64()),
    );

    const participants = [...messageRecipients, senderPublicKey];

    const convID = generateConversationID(participants);

    if (isDevEnvironment())
      console.log("Sending message from:", senderPublicKey);

    if (!senderPublicKey?.trim())
      throw new Error("A valid sender public key is required.");
    if (!majik.currentIdentity)
      throw new Error("You must have an active identity set.");
    if (!convID?.trim()) throw new Error("Select a conversation first.");

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
        conversationId: convID,
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
        conversationId: convID,
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

    const sendMessageResponse = await majik.sendMessage(
      messageRecipients,
      composed,
    );

    if (
      sendMessageResponse !== null &&
      sendMessageResponse.success &&
      sendMessageResponse.message
    ) {
      onSend?.(text);
      return `Message sent successfully! ${sendMessageResponse.message}`;
    } else {
      return `Oh no... There's a problem while sending the message.`;
    }
  };

  const handleSend = async (): Promise<void> => {
    const activeAccount = majik.currentIdentity;
    if (!activeAccount) return;

    const currentUserPublicKey = activeAccount.publicKey;

    if (!recipients || recipients.length <= 1) {
      toast.error("Assign recipients first.");
      return;
    }

    toast.promise(processSend(currentUserPublicKey, input), {
      loading: `Sending message...`,
      success: (outputMessage) => {
        setTimeout(() => {}, 1000);
        setIsSending(false);
        return outputMessage;
      },
      error: (error) => {
        return `${error.message}`;
      },
    });
  };

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

        const recipientPubKeys = await Promise.all(
          recipients.map(async (r) => {
            const rBase64 = await r.getPublicKeyBase64();
            return rBase64;
          }),
        );

        const bytes = new Uint8Array(await file.arrayBuffer());

        const convID = generateConversationID(recipientPubKeys);

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
          conversationId: convID,
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
    [majik, recipients],
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

        const recipientPubKeys = await Promise.all(
          recipients.map(async (r) => {
            const rBase64 = await r.getPublicKeyBase64();
            return rBase64;
          }),
        );

        const convID = generateConversationID(recipientPubKeys);

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
          conversationId: convID,
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
    [majik, recipients],
  );

  const handleDismissAttachment = useCallback(() => {
    setAttachmentUploadState(null);
    uploadedAttachmentRef.current = null;
  }, []);

  const contacts = useMemo(() => {
    if (!majik) return [];

    return majik.listContacts(false, true);
  }, [majik]);

  const groups = useMemo(() => {
    if (!majik) return [];
    return majik.listContactGroups(true);
  }, [majik]);

  return (
    <Root>
      <MajikContactListSelector
        id="message-recipients"
        contacts={contacts}
        value={recipients}
        onUpdate={handleRecipientsUpdate}
        onClearAll={handleRecipientsClear}
        allowEmpty={false}
        groups={groups}
        maxContacts={25}
      />

      <Body>
        <Section>
          <ChatInputBox
            majikah={majikah}
            onSend={handleSend}
            onUpdate={handleEncryptMessage}
            disabled={!recipients || recipients.length <= 1 || isSending}
            enableEmoji
            enableGIF
            enableImageUpload
            enableFileUpload
            onSelectImage={handleSelectImage}
            imageUploadState={imageUploadState}
            onDismissImage={handleDismissImage}
            onSelectAttachment={handleSelectAttachment}
            attachmentUploadState={attachmentUploadState}
            onDismissAttachment={handleDismissAttachment}
          />
          <PreviewActions>
            <ExportButton onClick={handleCopy}>Copy</ExportButton>
            <ExportButton onClick={handleDownloadTxt}>
              Download .txt
            </ExportButton>
            <ExportButton onClick={handleDownloadJson}>
              Download .json
            </ExportButton>
          </PreviewActions>
        </Section>
      </Body>
    </Root>
  );
};

export default NewMessageForm;

function generateConversationID(participants: MajikMessagePublicKey[]): string {
  // Sort alphabetically to ensure same conversation ID regardless of order
  const sorted = Array.from(participants).sort();

  // Join with delimiter
  const combined = sorted.join("|");

  const hashedID = sha256(combined);

  return `conv_${hashedID}`;
}
