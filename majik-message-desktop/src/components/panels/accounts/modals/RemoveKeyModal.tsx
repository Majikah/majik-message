import React, { useCallback, useState } from "react";

import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";

// ─────────────────────────────────────────────────────────────────────────────
// RemoveKeyModal
// ─────────────────────────────────────────────────────────────────────────────

interface RemoveKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export const RemoveKeyModal: React.FC<RemoveKeyModalProps> = React.memo(
  ({ open, onOpenChange, onConfirm }) => {
    const [isRemoving, setIsRemoving] = useState(false);

    const handleConfirm = useCallback(async () => {
      setIsRemoving(true);
      try {
        await onConfirm();
        onOpenChange(false);
      } finally {
        setIsRemoving(false);
      }
    }, [onConfirm, onOpenChange]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Remove Key Account",
          description:
            "This removes your local Majik Key account from this device. Your MUID and online identity remain intact — you can re-import this account at any time using your seed backup.",
        }}
        buttons={{
          cancel: { text: "Cancel", isDisabled: isRemoving },
          confirm: {
            text: isRemoving ? "Removing…" : "Remove Account",
            onClick: handleConfirm,
            isDisabled: isRemoving,
          },
        }}
      >
        <DynamicAlertBanner
          level="danger"
          title="Warning"
          description="Make sure you have your backup ZIP before continuing. Without it you will not be able to re-import this account."
        />
      </DynamicPopUp>
    );
  },
);

RemoveKeyModal.displayName = "RemoveKeyModal";
