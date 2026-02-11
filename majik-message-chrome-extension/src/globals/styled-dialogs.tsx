import * as AlertDialog from "@radix-ui/react-alert-dialog";
import styled from "styled-components";
import { ButtonPrimaryConfirm, ButtonPrimaryConfirmProps } from "./buttons";

// Styled overlay for the dialog
export const DialogOverlay = styled(AlertDialog.Overlay)<{ $zOffset?: number }>`
  background: rgba(1, 30, 75, 0.6);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  backdrop-filter: blur(5px); /* Soft blur effect */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${({ theme, $zOffset }) => theme.zIndex.overlay + ($zOffset || 0)};
`;

// Styled dialog content
export const DialogContent = styled(AlertDialog.Content)<{ $zOffset?: number }>`
  background: ${({ theme }) => theme.colors.primaryBackground};
  backdrop-filter: blur(50px);
  border-radius: 16px;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100vw;
  max-width: 500px;
  max-height: 100vh;
  padding: 25px 0px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
  z-index: ${({ theme, $zOffset }) =>
    theme.zIndex.overlayContent + ($zOffset || 0)};

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translate(-50%, -48%);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }
`;

// Styled dialog title
export const DialogTitle = styled(AlertDialog.Title)`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 0.5rem 0;
`;

// Styled dialog description
export const DialogDescription = styled(AlertDialog.Description)`
  font-size: 0.938rem;
  color: ${({ theme }) => theme.colors.textSecondary || "#6b7280"};
  margin: 0;
`;

export const DialogHeader = styled.div`
  padding: 2rem 2rem 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

export const DialogConfirmButton = styled(
  ButtonPrimaryConfirm,
)<ButtonPrimaryConfirmProps>`
  background: ${({ theme }) => theme.colors.primary};
  border: 1px solid transparent;
  color: white;
  width: 130px;
  transition: background 0.3s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
    border: 1px solid ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

export const DialogCancelButton = styled(
  ButtonPrimaryConfirm,
)<ButtonPrimaryConfirmProps>`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 130px;
`;
