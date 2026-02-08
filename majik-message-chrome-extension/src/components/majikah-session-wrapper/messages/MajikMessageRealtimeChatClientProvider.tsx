// MajikMessageRealtimeChatClientProvider.tsx
import React, { useEffect, useMemo } from "react";
import { MajikMessageRealtimeChatClient } from "./majik-message-realtime";
import { MajikMessageRealtimeChatClientContext } from "./majik-message-realtime-context";
import type { MajikMessageIdentity } from "@majikah/majik-message";

interface ProviderProps {
  conversationID: string;
  account: MajikMessageIdentity;
  apiKey?: string;
  baseUrl?: string;
  children: React.ReactNode;
}

export const MajikMessageRealtimeChatClientProvider: React.FC<
  ProviderProps
> = ({ conversationID, account, apiKey, baseUrl, children }) => {
  const client = useMemo(() => {
    return new MajikMessageRealtimeChatClient(
      conversationID,
      account,
      apiKey,
      baseUrl,
    );
  }, [conversationID, account, apiKey, baseUrl]);

  useEffect(() => {
    try {
      client.connect();
    } catch (error) {
      console.error("Failed to initialize MajikMessageRealtime:", error);
    }

    return () => {
      client.disconnect();
    };
  }, [client]);

  return (
    <MajikMessageRealtimeChatClientContext.Provider
      value={{
        client,
      }}
    >
      {children}
    </MajikMessageRealtimeChatClientContext.Provider>
  );
};
