import React from "react";

import DynamicPopUp from "@/components/functional/DynamicPopUp";

import UserAuth from "@/components/foundations/UserAuth";
import {
  API_RESPONSE_SIGN_IN,
  API_RESPONSE_SIGN_UP,
} from "@/components/majikah-session-wrapper/api-types";

interface MajikahAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccessSignIn?: (response: API_RESPONSE_SIGN_IN) => void;
  onSuccessSignUp?: (response: API_RESPONSE_SIGN_UP) => void;
}

export const MajikahAuthModal: React.FC<MajikahAuthModalProps> = React.memo(
  ({ open, onOpenChange, onSuccessSignIn, onSuccessSignUp }) => {
    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Sign In",
          description:
            "Log in or create a Majikah account to continue creating a Universal ID.",
        }}
        buttons={{
          cancel: { text: "Cancel" },
          confirm: { text: "Close", isDisabled: true, hide: true },
        }}
      >
        <UserAuth
          showLogo={false}
          expand
          onSignIn={onSuccessSignIn}
          onSignUp={onSuccessSignUp}
        />
      </DynamicPopUp>
    );
  },
);

MajikahAuthModal.displayName = "MajikahAuthModal";
