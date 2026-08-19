import { MajikContact, MajikContactGroup } from "@majikah/majik-contact";
import { MajikContactManagerJSON } from "../contacts/types";
import { UserAppPreferences } from "../storage";

import { MajikMessageChat } from "../database/chat/majik-message-chat";

// In your types file or at the top of the client file
export interface ContactManagerSnapshot {
  /** Raw JSON payload — used internally by restoreContacts for bulk writes */
  managerJSON: MajikContactManagerJSON;
  /** Hydrated contact instances — ready for preview/display */
  contacts: MajikContact[];
  /** User-defined groups only — system groups excluded */
  groups: MajikContactGroup[];
}

export interface AppDataSnapshot {
  chats?: MajikMessageChat[];
  contacts: MajikContact[];
  groups: MajikContactGroup[];
  // invoiceDefaults: InvoiceDefaults | null;
  preferences: UserAppPreferences | null;
  /** @internal Raw manager JSON — used by restoreAppDataSelective, not for display */
  _contactsManagerJSON: MajikContactManagerJSON;
}
