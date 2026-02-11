import React, { useState } from "react";
import styled from "styled-components";
import { ChoiceButton } from "../../globals/buttons";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "../../globals/styled-dialogs";

interface RowProps {
  $enableColumn?: boolean;
  $direction?: "row" | "column";
}

const RowContainer = styled.div<RowProps>`
  padding: 1.5rem 2rem;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  flex-direction: ${(props) => props.$direction || "row"};

  @media (max-width: 768px) {
    justify-content: ${(props) =>
      props.$enableColumn ? "space-between" : "flex-end"};
    flex-direction: ${(props) => (props.$enableColumn ? "column" : "row")};
  }
`;

interface DuoButtonProps {
  textButtonA?: string;
  textButtonB?: string;
  onClickButtonA: () => void;
  onClickButtonB: () => void;
  isDisabledButtonA?: boolean;
  isDisabledButtonB?: boolean;
  hideButtonA?: boolean;
  hideButtonB?: boolean;
  enableColumn?: boolean;
  strictMode?: boolean;
  direction?: "row" | "column";
}

const DuoButton: React.FC<DuoButtonProps> = ({
  textButtonA = "Cancel",
  textButtonB = "Proceed",
  onClickButtonA,
  onClickButtonB,
  isDisabledButtonA = false,
  isDisabledButtonB = false,
  hideButtonA = false,
  hideButtonB = false,
  enableColumn = false,
  strictMode = false,
  direction = "row",
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const handleOnConfirm = (): void => {
    onClickButtonB?.();
    setOpen(false); // Close dialog after confirming
  };

  const handleOnCancel = (): void => {
    setOpen(false); // Close dialog after confirming
  };

  const handleOnStrictClick = (): void => {
    setOpen(true); // Close dialog after confirming
  };

  return (
    <>
      <RowContainer $enableColumn={enableColumn} $direction={direction}>
        {!hideButtonA && (
          <ChoiceButton
            variant="secondary"
            onClick={onClickButtonA}
            disabled={isDisabledButtonA}
          >
            {textButtonA}
          </ChoiceButton>
        )}

        {!hideButtonB && (
          <ChoiceButton
            variant="primary"
            onClick={strictMode ? handleOnStrictClick : onClickButtonB}
            disabled={isDisabledButtonB}
          >
            {textButtonB}
          </ChoiceButton>
        )}
      </RowContainer>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <DialogOverlay $zOffset={500} />
          <DialogContent $zOffset={999}>
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
              <DialogDescription>
                Are you sure you want to proceed with this action?
              </DialogDescription>
            </DialogHeader>
            <RowContainer $enableColumn={enableColumn}>
              <ChoiceButton variant="secondary" onClick={handleOnCancel}>
                Cancel
              </ChoiceButton>
              <ChoiceButton variant="primary" onClick={handleOnConfirm}>
                Proceed
              </ChoiceButton>
            </RowContainer>
          </DialogContent>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
};

export default DuoButton;
