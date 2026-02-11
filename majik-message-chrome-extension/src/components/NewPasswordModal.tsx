import styled from "styled-components";
import { useState } from "react";

import DuoButton from "./foundations/DuoButton";
import CustomInputField from "./foundations/CustomInputField";
import { TitleHeader } from "../globals/styled-components";
import { DialogOverlay } from "../globals/styled-dialogs";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

const Panel = styled.div`
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  backdrop-filter: blur(50px);
  border-radius: ${({ theme }) => theme.borders.radius.large};
  padding: 2.5em;
  gap: 15px;
  width: 360px;
  max-width: 90vw;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
`;

interface NewPasswordModalProps {
  open: boolean;
  email?: string;
  onCancel: () => void;
  onSubmit: (newPassword: string) => void;
}

const NewPasswordModal: React.FC<NewPasswordModalProps> = ({
  open,
  email,
  onCancel,
  onSubmit,
}) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  if (!open) return null;

  const isValid =
    password.length >= 8 && confirm.length >= 8 && password === confirm;

  return (
    <AlertDialog.Root open={open}>
      <DialogOverlay>
        <Panel>
          <TitleHeader>Set New Password</TitleHeader>

          {email && (
            <p>
              Updating password for <strong>{email}</strong>
            </p>
          )}

          <CustomInputField
            label="New Password"
            type="password"
            currentValue={password}
            onChange={setPassword}
          />

          <CustomInputField
            label="Confirm Password"
            type="password"
            currentValue={confirm}
            onChange={setConfirm}
          />

          <DuoButton
            textButtonA="Cancel"
            textButtonB="Update Password"
            onClickButtonA={onCancel}
            onClickButtonB={() => onSubmit(password)}
            isDisabledButtonB={!isValid}
          />
        </Panel>
      </DialogOverlay>
    </AlertDialog.Root>
  );
};

export default NewPasswordModal;
