import React from 'react'
import styled, { css } from 'styled-components'

import { isDevEnvironment } from '../../utils/utils'
import DeleteButton from '../foundations/DeleteButton'

import StyledIconButton from '../foundations/StyledIconButton'
import { CopyIcon, LockIcon, LockOpenIcon } from '@phosphor-icons/react'

import theme from '../../globals/theme'

import { toast } from 'sonner'
import { ButtonPrimaryConfirm } from '../../globals/buttons'
import moment from 'moment'
import type { EnvelopeCacheItem } from '@majikah/majik-message'

// Styled components
const RootContainer = styled.div`
 
  width: inherit;
  border: 1px solid transparent;
  border-radius: 8px;
   display: flex;
 flex-direction: column;
 gap: 5px;

   user-select: none;
  transition: all 0.3s ease;

     @media (hover: hover) and (pointer: fine) {

   &:hover {
        border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};

  }


`

const BodyContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  display: flex;
  width: 100%;
    padding: 0px;
  transition: all 0.4s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.085);

  @media (hover: hover) and (pointer: fine) {

   &:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.24);
       border-radius: 0px 0px 12px 12px;

  }
`

const ColumnMain = styled.div`
  flex: 2;
  display: flex;
  flex-direction: column;
  justify-content: left;
  text-align: left;
`

const ColumnInfo = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
  gap: 25px;
  width: 100%;
  padding: 15px;
`

const ItemTitle = styled.div<{ $blocked?: boolean }>`
  font-size: 16px;
  font-weight: 500;
  color: ${({ theme, $blocked }) => ($blocked ? theme.colors.error : theme.colors.textPrimary)};
`

const SubColumnContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  margin-bottom: 10px;
`

const ActionButtonRow = styled.div<{ $enableHover?: boolean }>`
  display: flex;
  flex-direction: row;
  gap: 3px;
  align-items: center;
  justify-content: flex-end;
  transition: all 0.2s ease;
  height: 0px;
  opacity: 0;

  ${({ $enableHover }) =>
    $enableHover &&
    css`
      @media (hover: hover) and (pointer: fine) {
        ${RootContainer}:hover & {
          height: 30px;
          opacity: 1;
          padding: 5px;
          margin: 3px;
        }
      }
    `}
`

const UserNameRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: 3px;
  align-items: center;
  justify-content: flex-start;
  transition: all 0.2s ease;
  margin-bottom: 8px;
`

interface CBaseMessageProps {
  itemData: EnvelopeCacheItem
  onPressed?: (itemData: EnvelopeCacheItem) => void
  onDelete?: (data: EnvelopeCacheItem) => void
  onDecrypt?: (itemData: EnvelopeCacheItem) => void
  canDelete?: boolean
  index?: number
}

const CBaseMessage: React.FC<CBaseMessageProps> = ({
  itemData,
  onPressed,
  onDelete,
  onDecrypt,
  canDelete = true
}) => {
  const handleOnPressed = (): void => {
    if (isDevEnvironment()) console.log('Envelope Item Pressed from Base: ', itemData)

    if (!itemData) return
    if (onPressed) onPressed(itemData)
  }

  const handleCopy = async (): Promise<void> => {
    if (!itemData) return
    if (!itemData?.message?.trim()) {
      toast.error('Failed to copy to clipboard', {
        description: 'No message to copy.',
        id: `toast-error-copy-${itemData.id}`
      })
      return
    }
    try {
      await navigator.clipboard.writeText(itemData.message)
      toast.success('Copied to clipboard', {
        description:
          itemData.message.length > 200 ? itemData.message.slice(0, 200) + '…' : itemData.message,
        id: `toast-success-copy-${itemData.id}`
      })
    } catch (e) {
      // fallback: show in prompt
      toast.error('Failed to copy to clipboard', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-copy-${itemData.id}`
      })
    }
  }

  return (
    <RootContainer onClick={handleOnPressed}>
      <ActionButtonRow $enableHover={!!onDelete && canDelete}>
        <StyledIconButton icon={CopyIcon} title="Copy" onClick={() => handleCopy()} size={24} />

        {!!onDelete && onDelete !== undefined && !!canDelete ? (
          <DeleteButton title="contact" onClick={() => onDelete?.(itemData)} />
        ) : null}
      </ActionButtonRow>
      <BodyContainer onClick={handleOnPressed}>
        <ColumnInfo>
          <ColumnMain>
            <UserNameRow>
              <ItemTitle $blocked={!itemData?.message?.trim()}>
                {moment(itemData?.timestamp ?? new Date()).fromNow()}
              </ItemTitle>
              {!itemData?.message?.trim() ? (
                <LockIcon size={18} color={theme.colors.error} />
              ) : (
                <LockOpenIcon size={18} color={theme.colors.textPrimary} />
              )}
            </UserNameRow>

            <SubColumnContainer>
              {!itemData?.message?.trim() ? (
                <ButtonPrimaryConfirm onClick={() => onDecrypt?.(itemData)}>
                  Decrypt
                </ButtonPrimaryConfirm>
              ) : (
                <p>{itemData.message}</p>
              )}
            </SubColumnContainer>
          </ColumnMain>
        </ColumnInfo>
      </BodyContainer>
    </RootContainer>
  )
}

export default CBaseMessage
