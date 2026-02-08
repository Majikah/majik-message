/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MajikUser } from "@thezelijah/majik-user";
import type { Session } from "@supabase/supabase-js";
import type {
  MajikMessageAccountID,
  MajikMessageChatID,
  MajikMessageIdentityJSON,
  MajikMessagePublicKey,
  SerializedMajikContact,
  MajikMessageChatJSON,
} from "@majikah/majik-message";

export interface API_RESPONSE_STANDARD {
  success: boolean;
  response?: Response;
  data?: any;
}

export interface API_RESPONSE_SUCCESS {
  success: boolean;
  message: string;
  data: any;
}

export interface API_RESPONSE_MIDDLEWARE {
  success: boolean;
  rate_limit?: RATE_LIMIT_RESPONSE;
  error?: Response;
}

export interface RATE_LIMIT_RESPONSE {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
}

export interface API_SUPABASE_SIGN_UP_BODY {
  email: string;
  password: string;
  options?: {
    data?: Record<string, any>;
    emailRedirectTo?: string;
  };
}

export interface API_SUPABASE_SIGN_IN_BODY {
  email: string;
  password: string;
}

export interface API_SUPABASE_GOOGLE_SIGN_IN_BODY {
  token: string;
}

export interface API_SUPABASE_VERIFY_OTP_BODY {
  email: string;
  otp: string;
}

export interface API_SUPABASE_RESEND_OTP_BODY {
  email: string;
}

export interface API_SUPABASE_RESET_PASSWORD_BODY {
  email: string;
}

export interface API_SUPABASE_UPDATE_USER_BODY {
  [key: string]: any; // This will be validated by MajikUser
}

// ============================================================================
// RESPONSE INTERFACES
// ============================================================================

export interface API_RESPONSE_SIGN_IN {
  message: string;
  user: ReturnType<typeof MajikUser.prototype.toJSON>;
  session: Session;
}

export interface API_RESPONSE_SIGN_IN_ERROR_EMAIL_NOT_CONFIRMED {
  error: "EMAIL_NOT_CONFIRMED";
  message: string;
  requiresOTP: true;
  email: string;
}

export interface API_RESPONSE_SIGN_UP {
  message: string;
  user: ReturnType<typeof MajikUser.prototype.toJSON>;
  session: Session | null;
  requiresEmailConfirmation?: boolean;
}

export interface API_RESPONSE_GOOGLE_SIGN_IN {
  message: string;
  user: ReturnType<typeof MajikUser.prototype.toJSON>;
  session: Session;
}

export interface API_RESPONSE_VERIFY_OTP {
  message: string;
  user: ReturnType<typeof MajikUser.prototype.toJSON>;
  session: Session;
}

export interface API_RESPONSE_GET_USER {
  // Returns the MajikUser JSON directly
  [key: string]: any;
}

export interface API_RESPONSE_UPDATE_USER {
  success: boolean;
  message: string;
  data: ReturnType<typeof MajikUser.prototype.toJSON>;
}

export interface API_RESPONSE_RESEND_OTP {
  message: string;
}

export interface API_RESPONSE_RESET_PASSWORD {
  message: string;
}

// ============================================================================
// ERROR RESPONSE INTERFACE
// ============================================================================

export interface API_ERROR_RESPONSE {
  error: string;
  message: string;
  code?: string;
  statusCode?: number;
}

// ============================================================================
// ERROR CODE TYPES
// ============================================================================

export type API_ERROR_CODE =
  | "MISSING_FIELDS"
  | "INVALID_EMAIL"
  | "INVALID_PASSWORD"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "SIGN_IN_FAILED"
  | "MISSING_TOKEN"
  | "GOOGLE_SIGN_IN_FAILED"
  | "INVALID_OTP_LENGTH"
  | "OTP_EXPIRED"
  | "INVALID_OTP"
  | "OTP_VERIFICATION_FAILED"
  | "EMAIL_ALREADY_EXISTS"
  | "INTERNAL_ERROR"
  | "USER_NOT_FOUND"
  | "INVALID_USER_DATA"
  | "UPDATE_FAILED"
  | "RESET_PASSWORD_FAILED"
  | "RESEND_OTP_FAILED";

/* ================================
 * Identity Types
 * ================================ */

export interface API_CREATE_IDENTITY_BODY {
  user_id: string;
  account: SerializedMajikContact;
}

export interface API_RESPONSE_CREATE_IDENTITY {
  message: string;
  data: MajikMessageIdentityJSON;
  success: boolean;
}

export interface API_RESPONSE_IDENTITY_EXIST {
  message: string;
  exists: boolean;
}

export interface API_RESPONSE_USER_IDENTITY {
  identities: MajikMessageIdentityJSON[];
  count: number;
}

/* ================================
 * Conversation Types
 * ================================ */

export interface API_RESPONSE_GET_CONVERSATIONS {
  conversations: ConversationSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  canNextPage: boolean;
}

export interface ConversationSummary {
  conversation_id: string;
  participants: MajikMessagePublicKey[];
  participant_count: number;
  latest_message: MajikMessageChatJSON;
  latest_message_timestamp: string;
  total_messages: number;
  unread_count: number;
  has_unread: boolean;
}

export interface ConversationSummaryRPC {
  conversation_id: string;
  participants: string[];
  latest_message: MajikMessageChatJSON;
  total_messages: number;
  unread_count: number;
  latest_timestamp: string;
}

export interface API_GET_CONVERSATIONS_QUERY {
  account_id: MajikMessageAccountID;
  page?: number;
  limit?: number;
}

export interface API_GET_CONVERSATION_PARAMS {
  conversation_id: string;
}

export interface API_GET_CONVERSATION_QUERY {
  account_id: MajikMessageAccountID;
  page?: number;
  limit?: number;
}

export interface API_RESPONSE_GET_CONVERSATION_MESSAGES {
  conversation_id: string;
  participants: MajikMessagePublicKey[];
  participant_count: number;
  messages: MajikMessageChatJSON[];
  total_messages: number;
  page: number;
  limit: number;
  totalPages: number;
  canNextPage: boolean;
}

/* ================================
 * Message Types
 * ================================ */

export interface API_CREATE_MESSAGE_BODY {
  sender_account_id: MajikMessageAccountID;
  message: string;
  recipients: MajikMessagePublicKey[];
  expires_in_ms?: number;
  permanent?: boolean;
}

export interface API_RESPONSE_CREATE_MESSAGE {
  message: string;
  data: MajikMessageChatJSON;
  success: boolean;
}

export interface API_RESPONSE_GET_MESSAGES {
  messages: MajikMessageChatJSON[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  canNextPage: boolean;
}

export interface API_RESPONSE_GET_MESSAGE {
  message: MajikMessageChatJSON;
  plaintext: string;
}

export interface API_MARK_READ_BODY {
  account_id: MajikMessageAccountID;
}

export interface API_RESPONSE_MARK_READ {
  message: string;
  data: MajikMessageChatJSON;
  was_updated: boolean;
}

export interface API_BATCH_MARK_READ_BODY {
  message_ids: string[];
  conversation_id: string;
  account_id: MajikMessageAccountID;
}

export interface API_RESPONSE_BATCH_MARK_READ {
  message: string;
  updated: MajikMessageChatJSON[];
  unchanged: string[];
  errors: { id: string; reason: string }[];
  updated_count: number;
  unchanged_count: number;
  error_count: number;
}

export interface API_RESPONSE_DELETE_MESSAGE {
  message: string;
  deleted: boolean;
  id: MajikMessageChatID;
}

export interface API_RESPONSE_MESSAGE_STATS {
  id: string;
  is_expired: boolean;
  can_be_deleted: boolean;
  read_percentage: number;
  time_until_expiration_ms: number;
  is_read_by_all: boolean;
  unread_recipients: string[];
  total_recipients: number;
  read_count: number;
  is_sender: boolean;
  has_user_read: boolean;
}

export interface API_GET_MESSAGES_QUERY {
  unread_only?: boolean; // "true" | undefined (parsed from string)
  page?: number; // defaults to 1
  limit?: number; // defaults to 50
}

export interface API_GET_MESSAGE_PARAMS {
  id: string;
}

export interface API_GET_MESSAGE_QUERY {
  conversation_id: string;
  account_id: MajikMessageAccountID;
}

export interface API_DELETE_MESSAGE_QUERY {
  account_id: MajikMessageAccountID;
}

export interface API_GET_MESSAGE_STATS_QUERY {
  account_id: MajikMessageAccountID;
}

/* ================================
 * Realtime Chat Types
 * ================================ */

export interface API_BROADCAST_MESSAGE_BODY {
  sender_account_id: MajikMessageAccountID;
  message: string;
  recipients: MajikMessagePublicKey[];
  expires_in_ms?: number;
  permanent?: boolean;
}

export interface API_RESPONSE_BROADCAST_MESSAGE {
  message: string;
  data: MajikMessageChatJSON;
  success: boolean;
}

export interface API_CHAT_PRESENCE_BODY {
  account_id: MajikMessageAccountID;
  typing: boolean;
  online: boolean;
}

export interface API_RESPONSE_CHAT_PRESENCE {
  message: string;
  data: MajikMessageChatJSON;
  success: boolean;
}

export interface API_WEBSOCKET_SEND_MESSAGE_BODY {
  type: "chat_message";
  data: MajikMessageChatJSON;
}
