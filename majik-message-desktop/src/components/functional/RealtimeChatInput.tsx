import { useCallback, useRef, useState } from "react";
import styled from "styled-components";
import { toast } from "sonner";
import { ChatInputBox } from "./ChatInputBox";
import type { MajikMessagePublicKey } from "@majikah/majik-message";
import { useMajikMessageRealtime } from "../majikah-session-wrapper/messages/use-majik-message-realtime";
import { isDevEnvironment } from "@/utils/utils";
import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import type { MajikahSession } from "../majikah-session-wrapper/majikah-session";

/* ======================================================
 * Styled Components
 * ====================================================== */

const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  padding: 12px 16px;
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

    // const recipients = participants.filter((account) => !account.includes(senderPublicKey))

    const composedChatMessage = await majik.createEncryptedMajikMessageChat(
      majik.currentIdentity,
      participants,
      text,
    );

    console.log("Result: ", composedChatMessage);

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

    toast.promise(processSend(currentUserPublicKey, finalText), {
      loading: `Sending message...`,
      success: (outputMessage) => {
        setTimeout(() => {
          // Clear typing indicator when message is sent
          if (isTypingRef.current) {
            isTypingRef.current = false;
            client.setTyping(false);
          }

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
        }, 1000);

        return outputMessage;
      },
      error: (error) => {
        return `${error.message}`;
      },
    });
  };

  const handleChange = useCallback(
    (input: string) => {
      if (!input?.trim()) {
        setValue("");
        onUpdate?.("");
        return;
      }

      // Send typing indicator when user starts typing
      if (input && !isTypingRef.current) {
        isTypingRef.current = true;
        client.setTyping(true);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Set timeout to stop typing indicator after 2 seconds of inactivity
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

  return (
    <InputWrapper>
      <ChatInputBox
        majikah={majikah}
        onSend={handleSend}
        onUpdate={handleChange}
        disabled={!participants || participants.length <= 0 || disabled}
        maxHeight={maxHeight}
      />
    </InputWrapper>
  );
};
