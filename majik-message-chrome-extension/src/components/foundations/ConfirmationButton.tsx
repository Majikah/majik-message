import React, { useState } from "react";
import styled, { css } from "styled-components";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

import StyledIconButton from "./StyledIconButton";
import { ChoiceButton } from "../../globals/buttons";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "../../globals/styled-dialogs";
import DuoButton from "./DuoButton";
import CustomInputField from "./CustomInputField";

const Button = styled(ChoiceButton)<{ $strict?: boolean }>`
  min-width: 100px;
  width: inherit;

  ${({ $strict }) =>
    $strict &&
    css`
      color: ${({ theme }) => theme.colors.error};
    `}
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;

  padding: 1rem 50px;
`;

interface ConfirmationButtonProps {
  onClick?: () => void;
  onCancel?: () => void;
  text?: string;
  disabled?: boolean;
  strict?: boolean;
  icon?: React.ComponentType;
  alertTextTitle?: string;
  requiredText?: string;
  descriptionText?: string;
}

const ConfirmationButton: React.FC<ConfirmationButtonProps> = ({
  onClick,
  onCancel,
  text = "Confirm",
  disabled = false,
  strict = true,
  icon,
  alertTextTitle = "Confirm Action",
  requiredText,
  descriptionText,
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const [inputText, setInputText] = useState<string>("");

  const handleOnConfirm = (): void => {
    onClick?.();
    setOpen(false); // Close dialog after confirming
  };

  const handleOnCancel = (): void => {
    onCancel?.();
    setOpen(false); // Close dialog after confirming
  };

  return (
    <>
      {icon ? (
        <StyledIconButton
          icon={icon}
          size={25}
          onClick={() => setOpen(true)}
          disabled={disabled}
          title={text}
        />
      ) : (
        <Button
          onClick={() => setOpen(true)}
          disabled={disabled}
          $strict={strict}
          variant="secondary"
        >
          {text}
        </Button>
      )}

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <DialogOverlay>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{alertTextTitle}</DialogTitle>
                <DialogDescription>
                  {descriptionText ||
                    (strict
                      ? "Are you sure you want to proceed with this action? This cannot be undone."
                      : "Are you sure you want to proceed with this action?.")}
                </DialogDescription>
              </DialogHeader>

              {requiredText && !!requiredText.trim() && (
                <ModalContainer>
                  <CustomInputField
                    label="Confirmation Text"
                    sensitive={true}
                    required
                    currentValue={inputText}
                    onChange={(e) => setInputText(e.toUpperCase() || "")}
                    helper={`Please type "${requiredText.toUpperCase()}" to confirm.`}
                  />
                </ModalContainer>
              )}

              <DuoButton
                textButtonA="Cancel"
                textButtonB="Confirm"
                onClickButtonA={handleOnCancel}
                onClickButtonB={handleOnConfirm}
                isDisabledButtonB={
                  requiredText && !!requiredText.trim()
                    ? inputText.toUpperCase() !== requiredText.toUpperCase()
                    : false
                }
              />
            </DialogContent>
          </DialogOverlay>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
};

export default ConfirmationButton;
