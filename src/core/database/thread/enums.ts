export const ThreadStatus = {
  ONGOING: "ongoing",
  CLOSED: "closed",
  PENDING_DELETION: "pending_deletion",
  MARKED_FOR_DELETION: "marked_for_deletion",
} as const;

export type ThreadStatus = (typeof ThreadStatus)[keyof typeof ThreadStatus];
