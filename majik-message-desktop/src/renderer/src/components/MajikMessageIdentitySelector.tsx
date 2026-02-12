import { useEffect, useState, type JSX } from 'react'
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
import type { MajikMessageIdentity } from '@majikah/majik-message'
import { toast } from 'sonner'
import { useMajikah } from './majikah-session-wrapper/use-majikah'

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

interface MajikMessageIdentitySelectorProps {
  tooltip?: string
  onChange?: (identity: MajikMessageIdentity) => void
}

export function MajikMessageIdentitySelector({
  tooltip = 'Switch Account',
  onChange
}: MajikMessageIdentitySelectorProps): JSX.Element {
  const { majik } = useMajik()
  const { majikah } = useMajikah()

  const [identities, setIdentities] = useState<MajikMessageIdentity[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!majikah.isAuthenticated) return
    majik.refreshIdentities().then((list: MajikMessageIdentity[]) => {
      setIdentities(list)
      const current = majik.currentIdentity // or whatever your getter is
      if (current) setActiveId(current.id)
    })
  }, [majik, majikah.isAuthenticated, majikah.user?.id])

  const handleSelect = async (identity: MajikMessageIdentity): Promise<void> => {
    if (identity.id === activeId) {
      toast.error('Already Selected', {
        description: "You're already using this account.",
        id: 'toast-error-identity-select'
      })
      return
    }

    try {
      await majik.setActiveIdentity(identity)
    } catch (err) {
      toast.error('Failed to switch account', {
        description: `${err}`,
        id: 'toast-error-identity-select'
      })
      return
    }

    onChange?.(identity)
    setActiveId(identity.id)
    setMenuOpen(false)
  }

  const displayLabel = identities.find((i) => i.id === activeId)?.label
  const displayPubkey = identities.find((i) => i.id === activeId)?.publicKey

  return (
    <>
      <OptionContainer
        data-tooltip-id={`rtip-identity-selector`}
        data-tooltip-content={tooltip}
        id={'selector-active-identity'}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <UserSelectorRow>
              <UserIconContainer>
                <UserIcon size={48} />
              </UserIconContainer>
              <UserInfoColumn>
                {displayLabel ? (
                  <>
                    <Label data-private>{displayLabel}</Label>
                    <PublicKey data-private>{displayPubkey}</PublicKey>
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
            {identities.map((identity) => (
              <DropdownMenuItem
                key={identity.id}
                onSelect={() => handleSelect(identity)}
                className="!px-4 !py-2 data-[highlighted]:bg-[#ea7f05] text-[#272525] data-[highlighted]:text-[#f7f7f7]"
              >
                {identity.label}{' '}
                <AccountAddressText data-private>{identity.publicKey}</AccountAddressText>
              </DropdownMenuItem>
            ))}
          </StyledDropdownMenuContent>
        </DropdownMenu>
      </OptionContainer>
      <Tooltip
        id={`rtip-identity-selector`}
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
