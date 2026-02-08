import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import styled from 'styled-components'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { CaretUpDownIcon, UserIcon } from '@phosphor-icons/react'
import { Tooltip } from 'react-tooltip'
import theme from '../globals/theme'
import { useMajik } from './majik-context-wrapper/use-majik'
import type { MajikContact } from '@majikah/majik-message'
import { toast } from 'sonner'

const OptionContainer = styled.div`
  display: flex;
  position: relative;
  height: auto;
  width: 100%;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  transition: background 0.1s ease-in-out;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  overflow: hidden;
  border-radius: 8px;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
  }
`

const DotsWrapper = styled.div`
  position: absolute;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const OptionItem = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.subject};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: min(${({ theme }) => theme.typography.sizes.subject}, 4vw);
`

const UnsetOptionItem = styled(OptionItem)`
  opacity: 0.6;
`

const StyledDropdownMenuContent = styled(DropdownMenuContent)`
  max-height: 500px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.primaryBackground};
  width: var(--radix-dropdown-menu-trigger-width);
  z-index: 99999;

  &::-webkit-scrollbar {
    width: 1px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0);
    border-radius: 24px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0);
    border-radius: 24px;
    border: 1px solid transparent;
  }
  &::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0);
  }
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.colors.secondaryBackground} rgba(0, 0, 0, 0);
`

const AccountAddressText = styled.p`
  opacity: 0.6;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
`

const AccountLabelText = styled.p`
  color: ${({ theme }) => theme.colors.textPrimary};
`

const UserSelectorRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 10px;
  margin: 10px;
  gap: 10px;
`

const Label = styled.h3`
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: ${({ theme }) => theme.colors.textPrimary};
`

const PublicKey = styled.p`
  font-size: 0.7rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  word-break: break-all;
  text-align: left;
`

const UserInfoColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  width: 100%;
  gap: 5px;
`

const UserIconContainer = styled.div`
  display: flex;
  aspect-ratio: 1 / 1;
  width: 60px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.gradients.strong};

  svg {
    fill: ${({ theme }) => theme.colors.primaryBackground};
  }
`

interface MajikMessageAccountSelectorProps {
  tooltip?: string
  onChange?: (account: MajikContact) => void
  currentAccountId?: string
}

export function MajikMessageAccountSelector({
  tooltip = 'Switch Account',
  onChange,
  currentAccountId
}: MajikMessageAccountSelectorProps): JSX.Element {
  const { majik } = useMajik()

  const [menuOpen, setMenuOpen] = useState(false)

  const displayNamesRef = useRef<Record<string, string>>({})

  const [publicKeys, setPublicKeys] = useState<Record<string, string>>({})

  const userAccounts = useMemo(() => {
    return majik.listOwnAccounts()
  }, [majik])

  const [activeId, setActiveId] = useState<string | null>(
    currentAccountId || userAccounts[0]?.id || null
  )

  const [, setRefreshKey] = useState<number>(0)

  useEffect(() => {
    const fetchAccountData = async (): Promise<void> => {
      const names: Record<string, string> = {}
      const pubkeys: Record<string, string> = {}

      for (const account of userAccounts) {
        const displayName = await account.getDisplayName()
        const pubkey = await account.getPublicKeyBase64()

        if (displayName) names[account.id] = displayName
        if (pubkey) pubkeys[account.id] = pubkey
      }

      displayNamesRef.current = names
      setPublicKeys(pubkeys)
    }

    fetchAccountData()
  }, [userAccounts])

  const handleSelect = async (account: MajikContact): Promise<void> => {
    if (account.id === activeId) {
      toast.error('Already Selected', {
        description: "You're already using this account.",
        id: 'toast-error-account-select'
      })
      return
    }

    try {
      setMenuOpen(false)
      //   await majik.setActiveAccount(account.id)
      setActiveId(account.id)
      onChange?.(account)
    } catch (err) {
      toast.error('Failed to switch account', {
        description: `${err}`,
        id: 'toast-error-account-select'
      })
      return
    } finally {
      setRefreshKey((prev) => prev + 1)
    }

    onChange?.(account)

    setMenuOpen(false)
  }

  const displayLabel = userAccounts.find((i) => i.id === activeId)?.meta.label

  return (
    <>
      <OptionContainer data-tooltip-id={`rtip-account-selector`} data-tooltip-content={tooltip}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <UserSelectorRow>
              <UserIconContainer>
                <UserIcon size={48} />
              </UserIconContainer>
              <UserInfoColumn>
                {displayLabel && activeId?.trim() ? (
                  <>
                    <Label data-private>{displayLabel}</Label>
                    <PublicKey data-private>{publicKeys[activeId || '']}</PublicKey>
                  </>
                ) : (
                  <UnsetOptionItem>{tooltip}</UnsetOptionItem>
                )}
              </UserInfoColumn>
            </UserSelectorRow>
          </DropdownMenuTrigger>
          <DotsWrapper>
            <CaretUpDownIcon size={24} />
          </DotsWrapper>

          <StyledDropdownMenuContent>
            {userAccounts.map((acct) => (
              <DropdownMenuItem
                key={acct.id}
                onSelect={() => handleSelect(acct)}
                className="!px-4 !py-2 data-[highlighted]:bg-[#ea7f05] text-[#272525] data-[highlighted]:text-[#f7f7f7]"
              >
                <AccountLabelText>{acct.meta?.label || acct.id} </AccountLabelText>

                <AccountAddressText data-private>
                  {publicKeys[acct.id] || 'Loading...'}
                </AccountAddressText>
              </DropdownMenuItem>
            ))}
          </StyledDropdownMenuContent>
        </DropdownMenu>
      </OptionContainer>
      <Tooltip
        id={`rtip-account-selector`}
        style={{
          fontSize: 12,
          fontWeight: 400,
          backgroundColor: theme.colors.secondaryBackground,
          color: theme.colors.textPrimary
        }}
      />
    </>
  )
}
