import { useEffect, useState } from "react";
import type { MajikMessagePublicKey } from "@majikah/majik-message";
import type {
  MajikMessageRealtimeChatClient,
  TypingPayload,
} from "@/components/majikah-session-wrapper/messages/majik-message-realtime";

interface TypingUser {
  publicKey: MajikMessagePublicKey;
  startedAt: number;
}

export interface UseTypingIndicatorsResult {
  typingUsers: TypingUser[];
  isAnyoneTyping: boolean;
  typingCount: number;
}

export function useTypingIndicators(
  client: MajikMessageRealtimeChatClient | null,
  currentUserPublicKey?: MajikMessagePublicKey,
  timeoutMs = 3000, // Auto-clear after 3 seconds of no updates
): UseTypingIndicatorsResult {
  const [typingUsers, setTypingUsers] = useState<
    Map<MajikMessagePublicKey, TypingUser>
  >(new Map());

  useEffect(() => {
    if (!client) return;

    const handleTyping = (data: TypingPayload): void => {
      // Ignore typing events from current user
      if (data.user === currentUserPublicKey) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);

        if (data.typing) {
          // User started typing
          next.set(data.user, {
            publicKey: data.user,
            startedAt: data.timestamp || Date.now(),
          });
        } else {
          // User stopped typing
          next.delete(data.user);
        }

        return next;
      });
    };

    client.on("typing", handleTyping);

    // Cleanup stale typing indicators (in case stop event is missed)
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next = new Map(prev);
        let changed = false;

        for (const [key, value] of next.entries()) {
          if (now - value.startedAt > timeoutMs) {
            next.delete(key);
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    }, 1000); // Check every second

    return () => {
      client.off("typing", handleTyping);
      clearInterval(cleanupInterval);
    };
  }, [client, currentUserPublicKey, timeoutMs]);

  return {
    typingUsers: Array.from(typingUsers.values()),
    isAnyoneTyping: typingUsers.size > 0,
    typingCount: typingUsers.size,
  };
}
