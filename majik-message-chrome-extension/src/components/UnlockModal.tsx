import styled from "styled-components";
import { useRef, useState } from "react";

import DuoButton from "./foundations/DuoButton";
import CustomInputField from "./foundations/CustomInputField";

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "../globals/styled-dialogs";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
// import { useMajikah } from "./majikah-session-wrapper/use-majikah";
import type { MajikMessageDatabase } from "./majik-context-wrapper/majik-message-database";

// import { ChoiceButton } from "../globals/buttons";
import ConfirmationButton from "./foundations/ConfirmationButton";
import { MajikMessageAccountSelector } from "./MajikMessageAccountSelector";
import type { MajikContact } from "@majikah/majik-message";

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: ${({ theme }) => theme.colors.textPrimary};
  padding: 1rem 50px;
`;

const ExtraButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;

  flex: 1;
  gap: 15px;

  padding: 1rem 50px;
`;

// const SignOutButton = styled(ChoiceButton)`
//   min-width: 100px;
//   width: inherit;
// `;

interface UnlockModalProps {
  majik: MajikMessageDatabase;
  identityId: string | null;
  onCancel: () => void;
  onSubmit: (passphrase: string) => void;
  onSignout: () => void;
  strict?: boolean;
  onSwitchAccount: (account: MajikContact) => void;
  onReset?: () => void;
  isUnlocking?: boolean;
}

// ======== Main Component ========

const UnlockModal: React.FC<UnlockModalProps> = ({
  majik,
  identityId,
  onCancel,
  onSubmit,
  // onSignout,
  strict = false,
  onSwitchAccount,
  onReset,
  isUnlocking = false,
}) => {
  // const navigate = useNavigate();
  // const { majikah } = useMajikah();
  const [pass, setPass] = useState("");

  const [, setRefreshKey] = useState<number>(0);

  // prevents multiple auto-unlocks
  const hasUnlockedRef = useRef(false);

  const handleCancel = (): void => {
    onCancel();
    setPass("");
  };

  // const handleSignOut = async (): Promise<void> => {
  //   await majikah.signOut();
  //   majik.clearAllCaches();
  //   navigate("/majikah");
  //   onSignout?.();
  // };

  const handleSwitchAccount = async (account: MajikContact): Promise<void> => {
    await majik.setActiveAccount(account.id, true);
    onSwitchAccount(account);
    // navigate("/accounts");
    setRefreshKey((prev) => prev + 1);
  };

  const handleReset = async (): Promise<void> => {
    const userProfile: string = import.meta.env.VITE_USER_PROFILE;
    await majik.resetData(userProfile);
    onReset?.();
    // navigate("/accounts");
  };

  if (!identityId) return null;

  return (
    <AlertDialog.Root open={identityId !== null && !!identityId?.trim()}>
      <DialogOverlay>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Identity</DialogTitle>
            <DialogDescription>
              Enter passphrase for{" "}
              <strong data-private>
                {majik
                  ? majik.getContactByID(identityId)?.meta?.label || identityId
                  : identityId}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <ModalContainer>
            <MajikMessageAccountSelector
              currentAccountId={identityId}
              onChange={handleSwitchAccount}
            />
            <CustomInputField
              currentValue={pass}
              label="Enter Password"
              onChange={(value) => {
                hasUnlockedRef.current = false; // reset if user edits
                setPass(value);
                setRefreshKey((prev) => prev + 1);
              }}
              type={"password"}
              passwordType="NONE"
              key={identityId}
              autofocus
            />
            Majik Message uses Argon2. This may take several seconds, and your
            screen may temporarily freeze. Please do not close or refresh.
          </ModalContainer>

          <DuoButton
            textButtonA="Cancel"
            textButtonB={isUnlocking ? "Unlocking..." : "Unlock"}
            onClickButtonA={handleCancel}
            onClickButtonB={() => onSubmit(pass.trim())}
            isDisabledButtonB={!pass.trim() || isUnlocking}
            isDisabledButtonA={strict}
            enableColumn
            direction="column"
          />
          <Divider>or</Divider>
          <ExtraButtonContainer>
            <ConfirmationButton
              requiredText="CLEAR MY DATA"
              text="Reset Local Accounts"
              strict
              alertTextTitle="Reset Local Accounts"
              descriptionText="This will permanently remove all locally stored accounts, identities, and contacts on this device. You will be signed out and this action cannot be undone.

However, you can re-import your accounts at any time using your saved JSON files containing the seed phrases."
              onClick={handleReset}
            />

            {/* <SignOutButton
              $variant="secondary"
              onClick={handleSignOut}
              disabled={!majikah.isAuthenticated}
            >
              Sign Out
            </SignOutButton> */}
          </ExtraButtonContainer>
        </DialogContent>
      </DialogOverlay>
    </AlertDialog.Root>
  );
};

export default UnlockModal;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;

  &::before,
  &::after {
    content: "";
    flex: 1;
    border-bottom: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  }

  &::before {
    margin-right: 0.75rem;
  }

  &::after {
    margin-left: 0.75rem;
  }
`;
