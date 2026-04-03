import React, { JSX, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

import { ChoiceButton } from "@/globals/buttons";
import StyledIconButton from "./StyledIconButton";
import DuoButton from "./DuoButton";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/globals/styled-dialogs";
import CustomInputField from "./CustomInputField";
import { Icon } from "@phosphor-icons/react";

const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

const Button = styled(ChoiceButton)<{ $strict?: boolean }>`
  min-width: 100px;
  width: inherit;

  ${({ $strict }) =>
    $strict &&
    css`
      color: ${({ theme }) => theme.colors.error};
    `}
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
`;

const ActionBtn = styled.button<{
  $variant?: "primary" | "secondary" | "seal" | "download-sealed";
  $loading?: boolean;
}>`
  flex: 1;
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 14px;
  border-radius: 9px;
  font-family: ${FONT_MONO};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: all 120ms ease;
  ${({ $variant, $loading, theme }) => {
    if ($variant === "primary")
      return css`
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
        border-color: rgba(16, 185, 129, 0.25);
        &:hover {
          background: #10b981;
          color: #fff;
        }
      `;
    if ($variant === "seal")
      return css`
        background: ${$loading
          ? "rgba(239,68,68,0.15)"
          : "rgba(239, 68, 68, 0.08)"};
        color: #ef4444;
        border-color: rgba(239, 68, 68, 0.25);
        animation: ${$loading ? pulse : "none"} 1.2s ease infinite;
        &:hover {
          background: #ef4444;
          color: #fff;
        }
      `;
    if ($variant === "download-sealed")
      return css`
        background: rgba(239, 68, 68, 0.07);
        color: #ef4444;
        border-color: rgba(239, 68, 68, 0.2);
        &:hover {
          background: #ef4444;
          color: #fff;
        }
      `;
    return css`
      background: transparent;
      color: ${theme.colors.textSecondary};
      border-color: ${theme.colors.primaryBackground};
      &:hover {
        background: ${theme.colors.primaryBackground};
        color: ${theme.colors.textPrimary};
      }
    `;
  }}
  &:active {
    opacity: 0.75;
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;

  padding: 1rem 50px;
  gap: 15px;
`;

interface ConfirmationButtonProps {
  id?: string;
  onClick?: () => void;
  onCancel?: () => void;
  text?: string;
  disabled?: boolean;
  strict?: boolean;
  icon?: {
    icon: Icon;
    size?: number;
  };
  alertTextTitle?: string;
  requiredText?: string;
  descriptionText?: string;
  children?: React.ReactNode;
  type?: "text" | "icon" | "text-icon" | "action";
}

const ConfirmationButton: React.FC<ConfirmationButtonProps> = ({
  id,
  onClick,
  onCancel,
  text = "Confirm",
  disabled = false,
  strict = true,
  icon,
  alertTextTitle = "Confirm Action",
  requiredText,
  descriptionText,
  children,
  type = "icon",
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

  const renderButton = (): JSX.Element => {
    switch (type) {
      case "text": {
        return (
          <Button
            onClick={() => setOpen(true)}
            disabled={disabled}
            $strict={strict}
            $variant="secondary"
            id={id}
          >
            {text}
          </Button>
        );
      }
      case "text-icon": {
        if (!icon) {
          return (
            <Button
              onClick={() => setOpen(true)}
              disabled={disabled}
              $strict={strict}
              $variant="secondary"
              id={id}
            >
              {text}
            </Button>
          );
        }

        const IconComp = icon.icon;

        return (
          <Button
            onClick={() => setOpen(true)}
            disabled={disabled}
            $strict={strict}
            $variant="secondary"
            id={id}
          >
            <IconComp size={icon.size || 25} />
            {text}
          </Button>
        );
      }
      case "icon": {
        if (!icon) {
          return (
            <Button
              onClick={() => setOpen(true)}
              disabled={disabled}
              $strict={strict}
              $variant="secondary"
              id={id}
            >
              {text}
            </Button>
          );
        }

        return (
          <StyledIconButton
            icon={icon.icon}
            size={25}
            onClick={() => setOpen(true)}
            disabled={disabled}
            title={`${text}: ${descriptionText}`}
            id={id}
          />
        );
      }
      case "action": {
        if (!icon) {
          return (
            <ActionBtn
              $variant="seal"
              onClick={() => setOpen(true)}
              disabled={disabled}
            >
              {text}
            </ActionBtn>
          );
        }

        const IconComp = icon.icon;

        return (
          <ActionBtn
            $variant="seal"
            onClick={() => setOpen(true)}
            disabled={disabled}
          >
            <IconComp size={14} />
            {text}
          </ActionBtn>
        );
      }
    }
  };

  return (
    <>
      {renderButton()}

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

              {(requiredText && !!requiredText.trim()) || children ? (
                <ModalContainer>
                  {requiredText && !!requiredText.trim() && (
                    <CustomInputField
                      label="Confirmation Text"
                      sensitive={true}
                      required
                      currentValue={inputText}
                      onChange={(e) => setInputText(e.toUpperCase() || "")}
                      helper={`Please type "${requiredText.toUpperCase()}" to confirm.`}
                    />
                  )}

                  {children}
                </ModalContainer>
              ) : null}

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
