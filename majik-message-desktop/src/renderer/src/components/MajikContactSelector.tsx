import { useEffect, useMemo, useState, type JSX } from 'react'
import styled from 'styled-components'
import { Tooltip } from 'react-tooltip'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { DotsThreeIcon, EraserIcon, PlusIcon } from '@phosphor-icons/react'
import theme from '@/globals/theme'

import { MajikContact } from '@majikah/majik-message'

// ---------------- Styled Components ---------------- //

const OptionContainer = styled.div`
  display: flex;
  position: relative;
  width: 100%;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  padding: 3px 10px;
  transition: background 0.1s ease-in-out;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
  }
`

const CenteredTextWrapper = styled.div`
  flex: 1;
  text-align: center;
  pointer-events: none;
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
`

const UnsetOptionItem = styled(OptionItem)`
  opacity: 0.6;
`

const StyledDropdownMenuContent = styled(DropdownMenuContent)`
  max-height: 400px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.primaryBackground};
  z-index: 9999;
  min-width: 300px;
`

// ---------------- Component ---------------- //

interface MajikContactSelectorProps {
  id?: string
  contacts: MajikContact[]
  value?: MajikContact
  tooltip: string
  onUpdate?: (value: MajikContact) => void
  onClear?: (refKey?: string) => void
  emptyActionButton?: () => void
  emptyActionText?: string
}

export function MajikContactSelector({
  id,
  contacts,
  value,
  tooltip,
  onUpdate,
  onClear,
  emptyActionButton,
  emptyActionText = 'Add New Contact'
}: MajikContactSelectorProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const [contactKeys, setContactKeys] = useState<Record<string, string>>({})

  // ---------------- Load public keys ---------------- //
  useEffect(() => {
    let cancelled = false

    async function loadKeys(): Promise<void> {
      const keys: Record<string, string> = {}
      for (const contact of contacts) {
        try {
          const key = await contact.getPublicKeyBase64()
          keys[contact.id] = key
        } catch (err) {
          console.error('Failed to get public key for contact', contact.id, err)
          keys[contact.id] = 'Error'
        }
      }
      if (!cancelled) setContactKeys(keys)
    }

    loadKeys()
    return () => {
      cancelled = true
    }
  }, [contacts])

  // ---------------- Display helpers ---------------- //
  const displayValue = (): string => {
    if (!value?.id) return ''
    const match = contacts.find((c) => c.id === value.id)
    if (match) {
      const label = match.meta?.label?.trim() || 'Unnamed Contact'
      const keyText = contactKeys[match.id]
        ? contactKeys[match.id].slice(0, 16) + '...'
        : 'Loading...'
      return `${label} (${keyText})`
    } else {
      return 'Not Found'
    }
  }

  const handleClose = (): void => setMenuOpen(false)

  const handleIconClick = (e: React.MouseEvent): void => {
    if (!contacts || contacts.length === 0) {
      toast.error('No Contacts Available', {
        description: 'You currently do not have available contacts to choose from.',
        id: `toast-error-${id}`,
        action: emptyActionButton
          ? { label: emptyActionText, onClick: emptyActionButton }
          : undefined
      })
      return
    }

    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }

  const handleSelect = (contact: MajikContact): void => {
    onUpdate?.(contact)
    handleClose()
  }

  const availableContacts = useMemo(
    () => contacts.filter((c) => c.id !== value?.id),
    [contacts, value]
  )

  const currentTooltip =
    !value?.id || value.id === ''
      ? tooltip
      : displayValue() === 'Not Found'
        ? 'Click Here to Change/Update'
        : tooltip

  return (
    <>
      <OptionContainer
        onClick={handleIconClick}
        data-tooltip-id={`rtip-contact-${id}`}
        data-tooltip-content={currentTooltip}
        id={id}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <CenteredTextWrapper>
              {displayValue() ? (
                displayValue() === 'Not Found' ? (
                  <UnsetOptionItem>{displayValue()}</UnsetOptionItem>
                ) : (
                  <OptionItem>{displayValue()}</OptionItem>
                )
              ) : (
                <UnsetOptionItem>{tooltip}</UnsetOptionItem>
              )}
            </CenteredTextWrapper>
          </DropdownMenuTrigger>

          <DotsWrapper>
            <DotsThreeIcon size={20} />
          </DotsWrapper>

          <StyledDropdownMenuContent>
            {availableContacts.map((contact) => {
              const label = contact.meta?.label?.trim() || 'Unnamed Contact'
              const keyText = contactKeys[contact.id] ? contactKeys[contact.id] : 'Loading...'
              return (
                <DropdownMenuItem
                  key={contact.id}
                  onSelect={() => handleSelect(contact)}
                  className="!px-4 !py-2 data-[highlighted]:bg-[#f2e0cb]"
                  data-private
                >
                  {label} ({keyText})
                </DropdownMenuItem>
              )
            })}

            {!!onClear && !!displayValue()?.trim() && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    onClear()
                    handleClose()
                  }}
                  className="!px-4 !py-2 data-[highlighted]:bg-[#f2e0cb]"
                >
                  <EraserIcon size={24} />
                  Clear
                </DropdownMenuItem>
              </>
            )}

            {!!emptyActionButton && (
              <DropdownMenuItem
                onSelect={() => {
                  emptyActionButton()
                  setMenuOpen(false)
                }}
                className="!px-4 !py-2 data-[highlighted]:bg-[#f2e0cb]"
              >
                <PlusIcon size={24} />
                {emptyActionText}
              </DropdownMenuItem>
            )}
          </StyledDropdownMenuContent>
        </DropdownMenu>
      </OptionContainer>

      <Tooltip
        id={`rtip-contact-${id}`}
        style={{
          fontSize: 12,
          fontWeight: 400,
          backgroundColor: theme.colors.primary
        }}
      />
    </>
  )
}
