import React, { useState } from "react";
import styled from "styled-components";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

import StyledIconButton from "./StyledIconButton";
import { ActionButton } from "../../globals/buttons";
import DuoButton from "./DuoButton";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "../../globals/styled-dialogs";
import ScrollableForm from "./ScrollableForm";
import DynamicPlaceholder from "./DynamicPlaceholder";

const Button = styled(ActionButton)`
  min-width: 100px;
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;

  padding: 1rem 50px;
`;

interface PopUpFormButtonProps {
  id?: string;
  text?: string;
  disabled?: boolean;
  icon?: React.ComponentType;
  children: React.ReactNode;
  scrollable?: boolean;
  buttons: {
    cancel: {
      text: string;
      onClick?: () => void;
      isDisabled?: boolean;
      hide?: boolean;
    };
    confirm: {
      text: string;
      onClick?: () => void;
      isDisabled?: boolean;
      hide?: boolean;
      confirmationText?: string;
    };
  };
  modal: {
    title: string;
    description: string;
  };
  loading?: {
    isLoading?: boolean;
    text?: string;
  };
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PopUpFormButton: React.FC<PopUpFormButtonProps> = ({
  id,
  text = "Confirm",
  disabled = false,
  icon,
  children,
  scrollable = false,
  buttons = {
    cancel: {
      text: "Cancel",
      isDisabled: false,
      hide: false,
    },
    confirm: {
      text: "Confirm",
      isDisabled: false,
      hide: false,
      confirmationText: "Are you sure you want to proceed with this action?",
    },
  },
  modal = {
    title: "Confirm Action",
    description: "Are you sure you want to proceed with this action?",
  },
  loading = {
    isLoading: false,
    text: "Loading...",
  },
  isOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);

  const open = isOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const handleOnConfirm = (): void => {
    buttons?.confirm?.onClick?.();
    setOpen(false); // Close dialog after confirming
  };

  const handleOnCancel = (): void => {
    buttons?.cancel?.onClick?.();
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
          title={`${text}: ${modal.description}`}
          id={id}
        />
      ) : (
        <Button onClick={() => setOpen(true)} disabled={disabled} id={id}>
          {text}
        </Button>
      )}

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modal.title}</DialogTitle>
              <DialogDescription>{modal.description} </DialogDescription>
            </DialogHeader>

            {loading.isLoading ? (
              <ModalContainer>
                <DynamicPlaceholder loading>{loading.text} </DynamicPlaceholder>
              </ModalContainer>
            ) : scrollable ? (
              <ScrollableForm
                onClickCancel={handleOnCancel}
                onClickProceed={handleOnConfirm}
                isDisabledCancel={buttons.cancel.isDisabled}
                isDisabledProceed={buttons.confirm.isDisabled}
                textCancelButton={buttons.cancel.text}
                textProceedButton={buttons.confirm.text}
                confirmationText={buttons.confirm.confirmationText}
                hideButtonA={buttons.cancel.hide}
                hideButtonB={buttons.confirm.hide}
              >
                {[children]}
              </ScrollableForm>
            ) : (
              <>
                <ModalContainer>{[children]}</ModalContainer>

                <DuoButton
                  textButtonA={buttons.cancel.text}
                  textButtonB={buttons.confirm.text}
                  onClickButtonA={handleOnCancel}
                  onClickButtonB={handleOnConfirm}
                  isDisabledButtonA={buttons.cancel.isDisabled}
                  isDisabledButtonB={buttons.confirm.isDisabled}
                  hideButtonA={buttons.cancel.hide}
                  hideButtonB={buttons.confirm.hide}
                  confirmationText={buttons.confirm.confirmationText}
                />
              </>
            )}
          </DialogContent>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
};

export default PopUpFormButton;
