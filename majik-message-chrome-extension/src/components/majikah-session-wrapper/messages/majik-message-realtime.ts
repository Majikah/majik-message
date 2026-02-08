/* eslint-disable @typescript-eslint/no-explicit-any */
// src/frontend/MajikMessageRealtimeChatClient.ts

import { createSupabaseBrowserClient } from "../../../lib/supabase/supabase";

import { APIKeyManager } from "../../../utils/api-manager";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  EncryptionEngine,
  MajikMessageChat,
  MessageEnvelope,
  type MajikMessageChatJSON,
  type MajikMessageIdentity,
} from "@majikah/majik-message";
import type { API_WEBSOCKET_SEND_MESSAGE_BODY } from "../api-types";

export type ChatEvents = {
  message: (msg: ChatMessagePayload) => void;
  participants: (participants: any[]) => void;
  connected: () => void;
  error: (err: any) => void;
  typing: (data: TypingPayload) => void;
  presence: (user: string, online: boolean) => void;
  message_deleted: (data: MessageDeletedPayload) => void;
  message_delete_error: (error: string) => void;
  user_joined: (data: UserJoinedPayload) => void;
  user_left: (data: UserLeftPayload) => void;
};

export type ChatMessagePayload = {
  type: string;
  payload?: MajikMessageChatJSON;
  sender?: string; // publicKey
  timestamp?: number;
  [key: string]: any;
};

export type MessageDeletedPayload = {
  messageId: string;
  deletedBy?: string; // publicKey
  timestamp?: number;
  deleted?: boolean;
};

export type UserJoinedPayload = {
  user: string; // publicKey
  accountID: string;
  userID: string;
  timestamp?: number;
};

export type UserLeftPayload = {
  user: string; // publicKey
  timestamp?: number;
};

export type TypingPayload = {
  user: string; // publicKey of the user typing
  typing: boolean; // true = started typing, false = stopped
  timestamp?: number; // when the event occurred
};

export class MajikMessageRealtimeChatClient {
  private supabase = createSupabaseBrowserClient();
  private account_data: MajikMessageIdentity;
  private ws?: WebSocket;

  private reconnectTimeout?: ReturnType<typeof setTimeout>;

  private readonly conversationID: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  private lastAuthToken?: string;
  private listeners: {
    [K in keyof ChatEvents]?: Set<ChatEvents[K]>;
  } = {};
  private reconnectInterval = 3000;

  private isConnecting = false;
  private shouldReconnect = true;

  // Add a Ping Loop to prevent DO Hibernation while active
  private pingIntervalId?: ReturnType<typeof setInterval>;

  private authSubscription?: { data: { subscription: any } };

  constructor(
    conversationID: string,
    account: MajikMessageIdentity,
    apiKey?: string,
    baseUrl?: string,
  ) {
    this.conversationID = conversationID;
    this.account_data = account;
    this.apiKey =
      apiKey ??
      APIKeyManager.initialize(import.meta.env.VITE_API_KEY!).encodeAPI();
    this.baseUrl = baseUrl ?? "https://api.majikah.solutions";
  }

  get account(): MajikMessageIdentity {
    return this.account_data;
  }

  set account(data: MajikMessageIdentity) {
    if (!data) {
      throw new Error("Account cannot be null or undefined");
    }

    if (!data.validateIntegrity()) {
      throw new Error("This account is invalid");
    }
    if (data.isRestricted()) {
      throw new Error("This account is restricted");
    }

    this.account_data = data;
  }

  // ======================
  // Connection
  // ======================
  async connect(): Promise<void> {
    this.shouldReconnect = true;

    if (this.isConnecting) return;
    this.isConnecting = true;

    this.clearTimeouts();

    try {
      const token = await this.getAuthToken();
      if (!token) {
        this.isConnecting = false; // Reset state if no token
        return;
      }

      if (
        this.ws?.readyState === WebSocket.OPEN &&
        token === this.lastAuthToken
      ) {
        this.isConnecting = false;
        return;
      }

      this.lastAuthToken = token;
      const wsUrl = this.buildUrl(token);

      this.cleanupSocket();
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false; // Connection successful!
        this.startPingLoop();
        this.setupAuthListener();
        this.emit("connected"); // Use the typed emit
      };

      this.ws.onmessage = (e) => this.handleMessage(e);

      this.ws.onerror = (e) => {
        this.emit("error", e); // Use the typed emit
      };

      this.ws.onclose = (e) => {
        if (e.code === 1006 && this.isConnecting) {
          // Ignore noisy first-close
          return;
        }
        this.isConnecting = false;
        this.handleClose();
      };
    } catch {
      this.isConnecting = false;
      this.handleClose();
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.isConnecting = false;
    this.clearTimeouts();
    this.stopPingLoop();

    // UNSUBSCRIBE is critical for Electron/React cleanup
    if (this.authSubscription) {
      this.authSubscription.data.subscription.unsubscribe();
      this.authSubscription = undefined;
    }

    this.cleanupSocket();
  }

  private handleClose(): void {
    this.stopPingLoop();

    if (!this.shouldReconnect) return;

    if (!this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = undefined;
        this.connect();
      }, this.reconnectInterval);
    }
  }

  private handleMessage(event: MessageEvent): void {
    let data: ChatMessagePayload;

    try {
      data = JSON.parse(event.data);
    } catch {
      console.warn("Received non-JSON WS message:", event.data);
      return;
    }

    if (!data?.type) {
      console.warn("Malformed WS message:", data);
      return;
    }

    switch (data.type) {
      case "message":
        this.emit("message", data);
        break;
      case "typing":
        this.emit("typing", {
          user: String(data.user),
          typing: Boolean(data.typing),
          timestamp: data.timestamp || Date.now(),
        });
        break;
      case "presence":
        this.emit("presence", String(data.user), Boolean(data.online));
        break;
      case "connected":
        this.emit("connected");
        break;
      case "error":
        this.emit("error", data);
        break;
      case "participants":
        this.emit("participants", data.participants ?? []);
        break;

      case "message_deleted":
        console.log("Message deleted:", data);
        this.emit("message_deleted", {
          messageId: data.messageId,
          deletedBy: data.deletedBy,
          timestamp: data.timestamp,
          deleted: data.deleted,
        });
        break;

      case "user_joined":
        console.log("User joined:", data);
        this.emit("user_joined", {
          user: data.user,
          accountID: data.accountID,
          userID: data.userID,
          timestamp: data.timestamp,
        });
        break;

      case "user_left":
        console.log("User left:", data);
        this.emit("user_left", {
          user: data.user,
          timestamp: data.timestamp,
        });
        break;
      default:
        return;
      // console.warn('Unhandled WS event type:', data.type, data)
    }
  }

  // ======================
  // Messaging
  // ======================
  async sendMessage(
    message: string,
    recipients: string[],
    expiresInMs: number = 24 * 60 * 60 * 1000,
  ): Promise<void> {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    // Sanitize message content
    const sanitizedMessage = sanitizeMessage(message);

    // Create message instance (auto-compresses)
    const newChatMessage = await MajikMessageChat.create(
      this.account,
      sanitizedMessage,
      recipients,
      expiresInMs,
    );

    // Get compressed message for encryption
    const compressedMessage = newChatMessage.getCompressedMessage();
    const encryptionRecipients = [...recipients, this.account.publicKey];

    // Encrypt the compressed message using EncryptionEngine

    let encryptedPayload: any;

    if (encryptionRecipients.length <= 1) {
      // Solo encryption
      const publicKeyRaw = new Uint8Array(
        base64ToArrayBuffer(this.account.publicKey),
      );
      const pkey = { raw: publicKeyRaw };
      encryptedPayload = await EncryptionEngine.encryptSoloMessage(
        compressedMessage,
        pkey,
      );
    } else {
      // Group encryption
      const recipientData = encryptionRecipients.map((rpkey) => {
        const publicKeyRaw = new Uint8Array(base64ToArrayBuffer(rpkey));
        const pkey = { raw: publicKeyRaw };
        return {
          id: rpkey,
          publicKey: pkey,
        };
      });

      encryptedPayload = await EncryptionEngine.encryptGroupMessage(
        compressedMessage,
        recipientData,
      );
    }

    // Serialize payload
    const payloadBytes = new TextEncoder().encode(
      JSON.stringify(encryptedPayload),
    );

    // Envelope structure: [version byte][sender fingerprint][payload bytes]
    const versionByte = new Uint8Array([2]);
    const fingerprintBytes = new Uint8Array(
      base64ToArrayBuffer(this.account.publicKey),
    );

    // Combine all parts into a single Uint8Array
    const blob = new Uint8Array(
      versionByte.length + fingerprintBytes.length + payloadBytes.length,
    );
    blob.set(versionByte, 0);
    blob.set(fingerprintBytes, versionByte.length);
    blob.set(payloadBytes, versionByte.length + fingerprintBytes.length);

    // Wrap as MessageEnvelope
    const envelope = new MessageEnvelope(blob.buffer);
    const envelopeBase64 = arrayBufferToBase64(envelope.raw);

    // Create scanner string with MAJIK prefix
    const scannerString = `${MessageEnvelope.PREFIX}:${envelopeBase64}`;
    newChatMessage.setMessage(scannerString); // Store encrypted version

    const body = newChatMessage.toJSON();

    const payload: API_WEBSOCKET_SEND_MESSAGE_BODY = {
      type: "chat_message",
      data: body,
    };

    this.ws.send(JSON.stringify(payload));
  }

  // 🔥 NEW: Delete a message via WebSocket
  /**
   * Delete a message in real-time
   * @param messageId - The message ID to delete
   * @param rkey - Optional Redis key (if you have it)
   */
  deleteMessage(messageId: string, rkey?: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("Cannot delete message: WebSocket not connected");
      return;
    }

    const payload = {
      type: "delete_message",
      messageId,
      ...(rkey && { rkey }),
    };

    this.ws.send(JSON.stringify(payload));
  }

  setTyping(isTyping: boolean): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "typing", typing: isTyping }));
  }

  markRead(messageId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "mark_read", messageId }));
  }

  // ======================
  // Events
  // ======================
  on<K extends keyof ChatEvents>(event: K, callback: ChatEvents[K]): void {
    if (!this.listeners[event]) {
      // @ts-expect-error TS can't infer the mapping here, but we know it's correct
      this.listeners[event] = new Set<ChatEvents[K]>();
    }
    // Type assertion to satisfy TS
    (this.listeners[event] as Set<ChatEvents[K]>).add(callback);
  }

  off<K extends keyof ChatEvents>(event: K, callback?: ChatEvents[K]): void {
    if (!this.listeners[event]) return;

    if (callback) {
      this.listeners[event]!.delete(callback);
    } else {
      this.listeners[event]!.clear();
    }
  }

  // Dispatch an event
  private emit<K extends keyof ChatEvents>(
    event: K,
    ...args: Parameters<ChatEvents[K]>
  ): void {
    const set = this.listeners[event] as Set<ChatEvents[K]> | undefined;
    if (!set) return;
    set.forEach((cb) => {
      // TS now knows this matches the expected function signature
      (cb as (...a: Parameters<ChatEvents[K]>) => void)(...args);
    });
  }

  // ======================
  // Internals
  // ======================

  private async getAuthToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  private cleanupSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "Client cleanup");
      }
      this.ws = undefined;
    }
  }

  private buildUrl(token: string): string {
    const encodedURL = encodeURIComponent(this.conversationID);
    const url = new URL(`${this.baseUrl}/chats/${encodedURL}/ws`);
    url.searchParams.set("account_id", this.account_data.id);
    url.searchParams.set("user_id", this.account_data.userID);
    url.searchParams.set("auth_token", token);
    url.searchParams.set("x_api_key", this.apiKey);
    // Convert https/http to wss/ws for the browser
    return url.toString().replace(/^http/, "ws");
  }

  // ======================
  // Lifecycle & Auth
  // ======================

  private setupAuthListener(): void {
    if (this.authSubscription) return;

    // Replaces the 55s polling loop with a reactive listener
    this.authSubscription = this.supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "TOKEN_REFRESHED" && session?.access_token) {
          if (session.access_token !== this.lastAuthToken) {
            console.log("Token refreshed, updating connection...");
            this.connect();
          }
        }
        if (event === "SIGNED_OUT") {
          this.disconnect();
        }
      },
    );
  }
  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingIntervalId = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 20000); // 20 seconds is safe for DO
  }

  private stopPingLoop(): void {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
  }

  private clearTimeouts(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
  }
}

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

function sanitizeMessage(message: string): string {
  // Basic sanitization - adjust based on your needs
  return message.trim().slice(0, MAX_MESSAGE_SIZE);
}
