import React, { useEffect, useState } from 'react'
import styled, { css } from 'styled-components'
import { MajikContact } from '@majikah/majik-message'
import { isDevEnvironment } from '../../utils/utils'
import DeleteButton from '../foundations/DeleteButton'
import StyledIconButton from '../foundations/StyledIconButton'
import {
  CheckCircleIcon,
  GearIcon,
  KeyIcon,
  LinkIcon,
  PencilIcon,
  ProhibitIcon,
  StarIcon,
  WifiHighIcon,
  WifiSlashIcon
} from '@phosphor-icons/react'
import ConfirmationButton from '../foundations/ConfirmationButton'
import theme from '../../globals/theme'
import PopUpFormButton from '../foundations/PopUpFormButton'
import CustomInputField from '../foundations/CustomInputField'

import { toast } from 'sonner'
import { useMajik } from '../majik-context-wrapper/use-majik'
import { BadgeCheckIcon } from 'lucide-react'
import { useMajikah } from '../majikah-session-wrapper/use-majikah'

// Styled components
const RootContainer = styled.div<{ $isActive?: boolean }>`
  width: inherit;
  height: fit-content;

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
  }

  ${({ $isActive }) =>
    $isActive &&
    css`
      background: ${({ theme }) => theme.gradients.strong};
    `}
`

const BodyContainer = styled.div<{ $isActive?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  background-color: ${({ theme }) => theme.colors.secondaryBackground};

  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
  }
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const Label = styled.h3<{ $blocked?: boolean; $isActive?: boolean }>`
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: ${({ theme, $blocked }) => ($blocked ? theme.colors.error : theme.colors.textPrimary)};
`

const PublicKey = styled.p<{ $isActive?: boolean }>`
  font-size: 0.7rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  word-break: break-all;
  margin-top: 8px;
  text-align: left;
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
  gap: 10px;
  align-items: center;
  justify-content: flex-start;
  transition: all 0.2s ease;
  margin-bottom: 8px;
`

interface PassphraseUpdateParams {
  id: string
  passphrase: { old: string; new: string }
}

interface CBaseUserAccountProps {
  itemData: MajikContact
  onPressed?: (itemData: MajikContact) => void
  onEdit?: (data: MajikContact) => void
  onDelete?: (data: MajikContact) => void
  onShare?: (data: MajikContact) => void
  onCopyPublicKey?: (data: MajikContact) => void
  onSetActive?: (data: MajikContact) => void
  onBlock?: (data: MajikContact) => void
  onUnBlock?: (data: MajikContact) => void
  onUpdatePassphrase?: (params: PassphraseUpdateParams) => void
  onUpdateName?: (name: string) => void
  onRegister?: (data: MajikContact) => void
  canEdit?: boolean
  canDelete?: boolean
  index?: number
}

const CBaseUserAccount: React.FC<CBaseUserAccountProps> = ({
  itemData,
  onPressed,
  onDelete,
  onEdit,
  onShare,
  onCopyPublicKey,
  onSetActive,
  onBlock,
  onUnBlock,
  onUpdatePassphrase,
  onUpdateName,
  onRegister,
  canEdit = true,
  canDelete = true,
  index
}) => {
  const { majik } = useMajik()
  const { majikah } = useMajikah()
  const [passphraseUpdate, setPassphraseUpdate] = useState<PassphraseUpdateParams>({
    id: itemData.id,
    passphrase: {
      old: '',
      new: ''
    }
  })
  const [newName, setNewName] = useState<string | null>(itemData?.meta?.label || null)

  const [isValid, setIsValid] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState<boolean>(false)

  const [publicKey, setPublicKey] = useState<string>('Loading...')

  // fetch public key when itemData changes
  useEffect(() => {
    let cancelled = false

    const fetchKey = async (): Promise<void> => {
      if (!itemData) return
      const key = await itemData.getPublicKeyBase64()
      if (!cancelled) setPublicKey(key)
    }

    fetchKey()

    return () => {
      cancelled = true
    }
  }, [itemData])

  const [isAccountOnline, setIsAccountOnline] = React.useState<boolean | undefined>(
    itemData.isMajikahIdentityChecked() ? itemData.isMajikahRegistered() : undefined
  )

  useEffect(() => {
    let cancelled = false

    const checkOnlineStatus = async (): Promise<void> => {
      try {
        if (!itemData?.id?.trim()) {
          setIsAccountOnline(false)
          return
        }

        if (isAccountOnline !== undefined || majik.isContactMajikahIdentityChecked(itemData.id)) {
          return
        }

        const doesExist = await majik.identityExists(itemData.id)
        majik.setContactMajikahStatus(itemData.id, doesExist)

        if (!cancelled) {
          setIsAccountOnline(doesExist)
        }
      } catch (err) {
        console.error('Decryption failed', err)
        if (!cancelled) {
          setIsAccountOnline(false)
        }
      }
    }

    if (!majikah.isAuthenticated) return

    checkOnlineStatus()

    return () => {
      cancelled = true
    }
  }, [majik, itemData.id, isAccountOnline, majikah.isAuthenticated])

  useEffect(() => {
    if (!majik || !itemData?.id) return

    const trimmed = passphraseUpdate?.passphrase?.old?.trim()

    // reset state when empty
    if (!trimmed) {
      setIsValid(false)
      setIsChecking(false)
      return
    }

    let cancelled = false
    setIsChecking(true)

    // small debounce to avoid crypto spam
    const timeout = setTimeout(async () => {
      try {
        const ok = await majik.isPassphraseValid(trimmed, itemData.id)
        if (!cancelled) setIsValid(ok)
      } finally {
        if (!cancelled) setIsChecking(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [passphraseUpdate?.passphrase?.old, majik, itemData.id])

  const handleOnPressed = (): void => {
    if (isDevEnvironment()) console.log('MajikContact Item Pressed from Base: ', itemData)

    if (!itemData) return
    if (onPressed) onPressed(itemData)
  }

  const handleSubmitPassphraseUpdate = (): void => {
    if (!itemData) return

    if (passphraseUpdate.passphrase.old === passphraseUpdate.passphrase.new) {
      toast.error('Invalid Password', {
        description: 'New password must not be the same as the old password.'
      })
      resetSubmission()
      return
    }

    if (isDevEnvironment()) console.log('Submitting: ', passphraseUpdate)

    onUpdatePassphrase?.(passphraseUpdate)
    resetSubmission()

    if (isDevEnvironment()) console.log('Passphrase Update Submitted')
  }

  const handleSubmitNameUpdate = (): void => {
    if (!itemData) return

    if (isDevEnvironment()) console.log('Submitting: ', passphraseUpdate)

    if (!newName?.trim()) {
      toast.error('Invalid Name', {
        description: 'Display name must not be empty.'
      })
      resetSubmission()
      return
    }

    if (itemData.meta.label === newName) {
      toast.error('No Changes Made', {
        description: 'New display name must not be the same as the old display name.'
      })
      resetSubmission()
      return
    }

    onUpdateName?.(newName)

    if (isDevEnvironment()) console.log('Display Name Update Submitted')
  }

  const resetSubmission = (): void => {
    if (isDevEnvironment()) console.log('Resetting State')
    setPassphraseUpdate({
      id: itemData.id,
      passphrase: {
        old: '',
        new: ''
      }
    })
    setNewName(itemData?.meta?.label || null)
  }

  return (
    <RootContainer onClick={handleOnPressed} $isActive={index === 0}>
      <ActionButtonRow $enableHover={(!!onDelete && canDelete) || (!!onEdit && canEdit)}>
        {!!onSetActive && onSetActive !== undefined && !!onSetActive && !!index && index !== 0 ? (
          <StyledIconButton
            icon={StarIcon}
            title="Set as Active"
            onClick={() => onSetActive?.(itemData)}
            size={24}
          />
        ) : null}

        {!!onRegister && onRegister !== undefined && !itemData?.isMajikahRegistered() ? (
          <ConfirmationButton
            text="Register Online"
            onClick={() => onRegister?.(itemData)}
            icon={WifiHighIcon}
            alertTextTitle="Register Online"
            strict
          />
        ) : null}
        {!!onUpdateName && onUpdateName !== undefined && !!onUpdateName ? (
          <PopUpFormButton
            icon={PencilIcon}
            text="Edit"
            modal={{
              title: 'Edit Label',
              description: 'Update your account label.'
            }}
            buttons={{
              cancel: {
                text: 'Cancel'
              },
              confirm: {
                text: 'Save Changes',
                isDisabled: !newName?.trim(),
                onClick: handleSubmitNameUpdate
              }
            }}
          >
            <CustomInputField
              currentValue={newName ?? undefined}
              onChange={(e) => setNewName(e)}
              maxChar={100}
              regex="letters"
              label="Display Name"
              required
              importProp={{
                type: 'txt'
              }}
              sensitive={true}
            />
          </PopUpFormButton>
        ) : null}
        {!!onUpdatePassphrase && onUpdatePassphrase !== undefined && !!onUpdatePassphrase ? (
          <PopUpFormButton
            icon={GearIcon}
            text="Change Passphrase"
            modal={{
              title: 'Change Passphrase',
              description: 'Update your account passphrase.'
            }}
            buttons={{
              cancel: {
                text: 'Cancel'
              },
              confirm: {
                text: 'Save Changes',
                isDisabled:
                  !passphraseUpdate?.id?.trim() ||
                  !isValid ||
                  !passphraseUpdate?.passphrase?.old?.trim() ||
                  !passphraseUpdate?.passphrase?.new?.trim(),
                onClick: handleSubmitPassphraseUpdate
              }
            }}
          >
            <CustomInputField
              label="Enter Old Password"
              onChange={(value) => {
                setPassphraseUpdate((prev) => ({
                  ...prev,
                  passphrase: {
                    ...prev.passphrase,
                    old: value
                  }
                }))
              }}
              type={'password'}
              passwordType="NONE"
              currentValue={passphraseUpdate.passphrase.old}
            />
            {!isChecking && isValid && (
              <CustomInputField
                label="Enter New Password"
                onChange={(value) => {
                  setPassphraseUpdate((prev) => ({
                    ...prev,
                    passphrase: {
                      ...prev.passphrase,
                      new: value
                    }
                  }))
                }}
                type={'password'}
                passwordType="NONE"
                currentValue={passphraseUpdate.passphrase.new}
                disabled={!isValid}
              />
            )}
          </PopUpFormButton>
        ) : null}
        {!!onShare && onShare !== undefined && !!onShare ? (
          <StyledIconButton
            icon={LinkIcon}
            title="Share"
            onClick={() => onShare?.(itemData)}
            size={24}
          />
        ) : null}
        {!!onCopyPublicKey && onCopyPublicKey !== undefined && !!onCopyPublicKey ? (
          <StyledIconButton
            icon={KeyIcon}
            title="Copy Public Key"
            onClick={() => onCopyPublicKey?.(itemData)}
            size={24}
          />
        ) : null}
        {!!onBlock && onBlock !== undefined && !itemData?.isBlocked() ? (
          <ConfirmationButton
            text="Block"
            onClick={() => onBlock?.(itemData)}
            icon={ProhibitIcon}
            alertTextTitle="Block Contact"
            strict
          />
        ) : null}

        {!!onUnBlock && onUnBlock !== undefined && !!itemData?.isBlocked() ? (
          <ConfirmationButton
            text="Unblock"
            onClick={() => onUnBlock?.(itemData)}
            icon={CheckCircleIcon}
            alertTextTitle="Unblock Contact"
            strict
          />
        ) : null}

        {!!onDelete && onDelete !== undefined && !!canDelete ? (
          <DeleteButton title="contact" onClick={() => onDelete?.(itemData)} />
        ) : null}
      </ActionButtonRow>
      <BodyContainer onClick={handleOnPressed} $isActive={index === 0}>
        <Header>
          <UserNameRow>
            <Label $blocked={itemData?.isBlocked()} $isActive={index === 0} data-private>
              {itemData?.meta?.label || 'User Account'}
            </Label>
            {isAccountOnline ? (
              <BadgeCheckIcon size={18} color={theme.colors.brand.green}>
                <title>Registered Online</title>
              </BadgeCheckIcon>
            ) : (
              <WifiSlashIcon size={18} color={theme.colors.textPrimary}>
                <title>Local Only</title>
              </WifiSlashIcon>
            )}
            {itemData?.isBlocked() && <ProhibitIcon size={18} color={theme.colors.error} />}
          </UserNameRow>
          {/* <OnlineIndicator online={isOnline} /> */}
        </Header>
        <PublicKey $isActive={index === 0} data-private>
          {publicKey}
        </PublicKey>
      </BodyContainer>
    </RootContainer>
  )
}

export default CBaseUserAccount
