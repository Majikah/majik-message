import React, { useState } from 'react'
import styled from 'styled-components'

import {} from '../../globals/styled-dialogs'
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
  align-items: flex-start;
  justify-content: flex-start

  padding: 1rem 50px;
`

interface DynamicSlidingDialogueProps {
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
  width?: number
}

const DynamicSlidingDialogue: React.FC<DynamicSlidingDialogueProps> = ({
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
      <Drawer.Root open={open} onOpenChange={setOpen} direction="right">
        <Drawer.Portal>
          <StyledDialogOverlay className="DialogOverlay" />
          <StyledDialogContent className="DialogContent" $width={width}>
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
