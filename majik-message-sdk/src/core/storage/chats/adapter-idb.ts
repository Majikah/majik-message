import { MajikMessageChatJSON } from "../../database/chat/types";
import { IDBGenericAdapter } from "../idb-adapter";

const IDB_DB_NAME = "majik-message-chats";
const IDB_STORE_NAME = "chats";
const IDB_VERSION = 1;

export const IDB_ADAPTER_INVOICE = new IDBGenericAdapter<MajikMessageChatJSON>(
  IDB_DB_NAME,
  IDB_STORE_NAME,
  IDB_VERSION,
);
