import React, { useState } from 'react'
import styled, { css } from 'styled-components'
import * as AlertDialog from '@radix-ui/react-alert-dialog'

import StyledIconButton from './StyledIconButton'
import { ChoiceButton } from '../../globals/buttons'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '@renderer/globals/styled-dialogs'
import DuoButton from './DuoButton'
import CustomInputField from './CustomInputField'

const Button = styled(ChoiceButton)<{ $strict?: boolean }>`
  min-width: 100px;
  width: inherit;

  ${({ $strict }) =>
    $strict &&
    css`
      color: ${({ theme }) => theme.colors.error};
    `}
`

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;

  padding: 1rem 50px;
  gap: 15px;
`

interface ConfirmationButtonProps {
  id?: string
  onClick?: () => void
  onCancel?: () => void
  text?: string
  disabled?: boolean
  strict?: boolean
  icon?: React.ComponentType
  alertTextTitle?: string
  requiredText?: string
  descriptionText?: string
  children?: React.ReactNode
}

const ConfirmationButton: React.FC<ConfirmationButtonProps> = ({
  id,
  onClick,
  onCancel,
  text = 'Confirm',
  disabled = false,
  strict = true,
  icon,
  alertTextTitle = 'Confirm Action',
  requiredText,
  descriptionText,
  children
}) => {
  const [open, setOpen] = useState<boolean>(false)

  const [inputText, setInputText] = useState<string>('')

  const handleOnConfirm = (): void => {
    onClick?.()
    setOpen(false) // Close dialog after confirming
  }

  const handleOnCancel = (): void => {
    onCancel?.()
    setOpen(false) // Close dialog after confirming
  }

  return (
    <>
      {icon ? (
        <StyledIconButton
          icon={icon}
          size={25}
          onClick={() => setOpen(true)}
          disabled={disabled}
          title={`${text}: ${descriptionText}`}
          id={id}
        />
      ) : (
        <Button
          onClick={() => setOpen(true)}
          disabled={disabled}
          $strict={strict}
          variant="secondary"
          id={id}
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
                      ? 'Are you sure you want to proceed with this action? This cannot be undone.'
                      : 'Are you sure you want to proceed with this action?.')}
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
                      onChange={(e) => setInputText(e.toUpperCase() || '')}
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
  )
}

export default ConfirmationButton
