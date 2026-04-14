import React, { type ReactNode } from "react";
import styled from "styled-components";

import DuoButton from "./DuoButton";
import { isDevEnvironment } from "../../utils/utils";
import { ButtonPrimaryConfirm } from "../../globals/buttons";

// Styled component for the frosted glass effect and full space usage
const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;

  height: auto;
  user-select: none;
`;

const ScrollContainer = styled.div`
  width: inherit;
  -webkit-overflow-scrolling: touch; // IMPORTANT for iOS
  touch-action: pan-y; // Allows drag scroll
  display: flex;
  flex-direction: column;
  height: 100%;

  padding: 1rem 50px;
  max-height: calc(85vh - 120px);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 8px;
  }
`;

// Type definition for the props
interface ScrollableFormProps {
  children: ReactNode;
  textCancelButton?: string;
  textProceedButton?: string;
  onClickCancel: () => void;
  onClickProceed: () => void;
  isDisabledCancel?: boolean;
  isDisabledProceed?: boolean;
  hideButtonA?: boolean;
  hideButtonB?: boolean;
  onDebug?: () => void;
  confirmationText?: string;
}

// Stateless functional component
const ScrollableForm: React.FC<ScrollableFormProps> = ({
  children,
  textCancelButton = "Cancel",
  textProceedButton = "Proceed",
  onClickCancel,
  onClickProceed,
  isDisabledCancel = false,
  isDisabledProceed = false,
  hideButtonA = false,
  hideButtonB = false,
  onDebug,
  confirmationText = "Are you sure you want to proceed with this action?",
}) => {
  return (
    <RootContainer>
      <ScrollContainer>{children}</ScrollContainer>

      <DuoButton
        textButtonA={textCancelButton}
        textButtonB={textProceedButton}
        onClickButtonA={onClickCancel}
        onClickButtonB={onClickProceed}
        isDisabledButtonA={isDisabledCancel}
        isDisabledButtonB={isDisabledProceed}
        strictMode={true}
        hideButtonA={hideButtonA}
        hideButtonB={hideButtonB}
        confirmationText={confirmationText}
      />
      {isDevEnvironment() && !!onDebug && (
        <ButtonPrimaryConfirm onClick={onDebug}>
          View Class Instance
        </ButtonPrimaryConfirm>
      )}
    </RootContainer>
  );
};

export default ScrollableForm;
