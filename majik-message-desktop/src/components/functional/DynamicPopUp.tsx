import React, { useState } from 'react'
import styled from 'styled-components'
import * as AlertDialog from '@radix-ui/react-alert-dialog'

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '../../globals/styled-dialogs'
import ScrollableForm from '../foundations/ScrollableForm'
import DuoButton from '../foundations/DuoButton'

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;

  padding: 1rem 50px;
`

interface DynamicPopUpProps {
  children: React.ReactNode
  scrollable?: boolean
  buttons: {
    cancel: {
      text: string
      onClick?: () => void
      isDisabled?: boolean
      hide?: boolean
    }
    confirm: {
      text: string
      onClick?: () => void
      isDisabled?: boolean
      hide?: boolean
    }
  }
  modal: {
    title: string
    description: string
  }
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const DynamicPopUp: React.FC<DynamicPopUpProps> = ({
  children,
  scrollable = false,
  buttons = {
    cancel: {
      text: 'Cancel',
      isDisabled: false,
      hide: false
    },
    confirm: {
      text: 'Confirm',
      isDisabled: false,
      hide: false
    }
  },
  modal = {
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed with this action?'
  },
  isOpen,
  onOpenChange
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false)

  const open = isOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const handleOnConfirm = (): void => {
    buttons?.confirm?.onClick?.()
    setOpen(false) // Close dialog after confirming
  }

  const handleOnCancel = (): void => {
    buttons?.cancel?.onClick?.()
    setOpen(false) // Close dialog after confirming
  }

  return (
    <>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modal.title}</DialogTitle>
              <DialogDescription>{modal.description} </DialogDescription>
            </DialogHeader>

            {scrollable ? (
              <ScrollableForm
                onClickCancel={handleOnCancel}
                onClickProceed={handleOnConfirm}
                isDisabledCancel={buttons.cancel.isDisabled}
                isDisabledProceed={buttons.confirm.isDisabled}
                textCancelButton={buttons.cancel.text}
                textProceedButton={buttons.confirm.text}
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
                />
              </>
            )}
          </DialogContent>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}

export default DynamicPopUp
