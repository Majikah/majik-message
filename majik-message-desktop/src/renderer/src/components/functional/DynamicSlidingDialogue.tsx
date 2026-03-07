import React, { useState } from 'react'
import styled from 'styled-components'

import ScrollableForm from '../foundations/ScrollableForm'
import DuoButton from '../foundations/DuoButton'
import { Drawer } from 'vaul'
import {
  CloseButton,
  StyledDialogContent,
  StyledDialogDescription,
  StyledDialogOverlay,
  StyledDialogTitle
} from '@renderer/globals/styled-slide-dialogs'

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;

  justify-content: flex-start;
  width: 100%;

  padding: 1rem 50px;
`

interface DynamicSlidingDialogueProps {
  children: React.ReactNode
  scrollable?: boolean
  preventDragClose?: boolean
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
  width?: number
}

const DynamicSlidingDialogue: React.FC<DynamicSlidingDialogueProps> = ({
  children,
  scrollable = false,
  preventDragClose = false,
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
  onOpenChange,
  width = 1200
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
      <Drawer.Root
        open={open}
        onOpenChange={setOpen}
        direction="right"
        dismissible={!preventDragClose}
      >
        <Drawer.Portal>
          <StyledDialogOverlay className="DialogOverlay" />
          <StyledDialogContent
            className="DialogContent"
            $width={width}
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <StyledDialogTitle className="DialogTitle">{modal.title}</StyledDialogTitle>
            <StyledDialogDescription className="DialogDescription">
              {modal.description}
            </StyledDialogDescription>
            <Drawer.Close asChild>
              <CloseButton onClick={handleOnCancel}>Close</CloseButton>
            </Drawer.Close>
            {scrollable ? (
              <ScrollableForm
                onClickCancel={handleOnCancel}
                onClickProceed={handleOnConfirm}
                isDisabledCancel={buttons.cancel.isDisabled}
                isDisabledProceed={buttons.confirm.isDisabled}
                textCancelButton={buttons.cancel.text}
                textProceedButton={buttons.confirm.text}
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
                />
              </>
            )}
          </StyledDialogContent>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}

export default DynamicSlidingDialogue
