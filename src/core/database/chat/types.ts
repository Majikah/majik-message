import type { MajikKeyAddress, MajikKeyFingerprint } from "@majikah/majik-key";
import type { MajikMessageChatID } from "../../types";

export interface MajikMessageChatJSON {
  id: MajikMessageChatID;
  conversation_id: string;
  account: MajikKeyFingerprint;
  message: string;
  sender: MajikKeyAddress;
  recipients: MajikKeyAddress[];
  timestamp: string;
  expires_at: string;
  read_by: string[];
  permanent: boolean;
}

export type RedisKey = string;
