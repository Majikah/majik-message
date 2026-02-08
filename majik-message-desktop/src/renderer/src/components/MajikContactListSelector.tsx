import React, { useState, useEffect, useRef, useMemo, type JSX } from 'react'
import styled from 'styled-components'
import { toast } from 'sonner'
import Fuse from 'fuse.js'
import { TrashIcon } from '@phosphor-icons/react'
import type { MajikContact } from '@majikah/majik-message'

type SearchableContact = {
  contact: MajikContact
  label: string
  publicKey: string
  publicKeyPrefix: string
}

interface MajikContactListSelectorProps {
  id?: string
  contacts: MajikContact[]
  value?: MajikContact[]
  onUpdate?: (value: MajikContact[]) => void
  onClearAll?: () => void
  emptyActionButton?: () => void
  emptyActionText?: string
  allowEmpty?: boolean
}

const arraysEqual = (a: MajikContact[], b: MajikContact[]): boolean =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id)

export function MajikContactListSelector({
  id,
  contacts,
  value = [],
  onUpdate,
  onClearAll,
  emptyActionButton,
  emptyActionText = 'Add New Contact',
  allowEmpty = true
}: MajikContactListSelectorProps): JSX.Element {
  const [list, setList] = useState<MajikContact[]>(value)
  const [showDropdown, setShowDropdown] = useState(false)
  const [query, setQuery] = useState('')
  const [contactLabels, setContactLabels] = useState<Record<string, string>>({})
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Resolve contact labels
  useEffect(() => {
    let cancelled = false

    const resolveLabels = async (): Promise<void> => {
      const unresolved = contacts.filter((c) => contactLabels[c.id] == null)
      if (unresolved.length === 0) return

      const entries = await Promise.all(
        unresolved.map(async (contact) => {
          const pk = await contact.getPublicKeyBase64()
          return [contact.id, pk] as const
        })
      )

      if (!cancelled) {
        setContactLabels((prev) => ({
          ...prev,
          ...Object.fromEntries(entries)
        }))
      }
    }

    resolveLabels()
    return () => {
      cancelled = true
    }
  }, [contacts, contactLabels])

  // Sync with external value changes
  useEffect(() => {
    if (value && !arraysEqual(value, list)) setList(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getContactLabelSync = (contact: MajikContact): string => {
    return contact.meta.label || contactLabels[contact.id] || '…'
  }

  const getContactDisplayWithKey = (
    contact: MajikContact
  ): { label: string; showKey: boolean; publicKey: string } => {
    const label = contact.meta.label || contactLabels[contact.id] || '…'
    const publicKey = contactLabels[contact.id] || ''

    // Only show public key if there's a custom label AND it's different from the public key
    const showKey = !!(contact.meta.label && contact.meta.label !== publicKey && publicKey)

    return { label, showKey, publicKey }
  }

  const normalize = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]/g, '')

  const availableContacts = useMemo(
    () => contacts.filter((c) => !list.some((sel) => sel.id === c.id)),
    [contacts, list]
  )

  const searchableContacts = useMemo<SearchableContact[]>(() => {
    return availableContacts.map((contact) => {
      const pk = contactLabels[contact.id] ?? ''
      const normalizedPk = normalize(pk)

      return {
        contact,
        label: contact.meta.label ?? '',
        publicKey: normalizedPk,
        publicKeyPrefix: normalizedPk.slice(0, 32)
      }
    })
  }, [availableContacts, contactLabels])

  const fuse = useMemo(() => {
    return new Fuse(searchableContacts, {
      keys: [
        { name: 'label', weight: 0.7 },
        { name: 'publicKeyPrefix', weight: 0.3 }
      ],
      threshold: 0.45,
      ignoreLocation: true,
      includeScore: true,
      shouldSort: true,
      minMatchCharLength: 1,
      useExtendedSearch: false,
      ignoreFieldNorm: true
    })
  }, [searchableContacts])

  const normalizedQuery = useMemo(() => normalize(query), [query])

  const filteredContacts = useMemo(() => {
    if (!normalizedQuery) {
      return searchableContacts.map((s) => s.contact)
    }

    return fuse.search(normalizedQuery).map((r) => r.item.contact)
  }, [normalizedQuery, fuse, searchableContacts])

  const handleSelect = (contact: MajikContact): void => {
    if (list.some((c) => c.id === contact.id)) {
      toast.error('This contact is already added.')
      return
    }
    const updated = [...list, contact]
    setList(updated)
    onUpdate?.(updated)
    setQuery('')
    setShowDropdown(false)
    setHighlightedIndex(0)
  }

  const handleRemove = (index: number, e: React.MouseEvent): void => {
    e.stopPropagation()
    const updated = list.filter((_, i) => i !== index)
    if (!allowEmpty && updated.length === 0) {
      toast.error('Recipient cannot be empty.')
      return
    }
    setList(updated)
    onUpdate?.(updated)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setQuery(e.target.value)
    setShowDropdown(true)
    setHighlightedIndex(0)
  }

  const handleInputFocus = (): void => {
    if (contacts.length === 0) {
      toast.error('No contacts available.', {
        description: 'You currently do not have available contacts to choose from.',
        action: emptyActionButton
          ? { label: emptyActionText, onClick: emptyActionButton }
          : undefined
      })
      return
    }
    setShowDropdown(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Backspace' && query === '' && list.length > 0) {
      e.preventDefault()
      // Determine if we can remove the last item
      if (allowEmpty || list.length > 1) {
        const updated = list.slice(0, -1) // remove last added contact
        setList(updated)
        onUpdate?.(updated)
      } else {
        // Optional: give feedback if trying to remove the last item when allowEmpty is false
        toast.error('Recipient cannot be empty.', { id: 'toast-error-remove-last' })
      }
      return
    }

    if (!showDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < filteredContacts.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredContacts[highlightedIndex]) {
          handleSelect(filteredContacts[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setQuery('')
        break
    }
  }

  const handleClearAll = (): void => {
    onClearAll?.()
    setList([])
    setQuery('')
    setShowDropdown(false)
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, showDropdown])

  return (
    <SelectorWrapper ref={wrapperRef} id={id}>
      <InputContainer>
        {list.map((contact, index) => (
          <Tag key={contact.id}>
            <span data-private>{getContactLabelSync(contact)}</span>
            <RemoveButton onClick={(e) => handleRemove(index, e)}>✕</RemoveButton>
          </Tag>
        ))}

        <StyledInput
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={
            list.length === 0 ? 'Type to search contacts...' : 'Type name or public key...'
          }
        />
      </InputContainer>

      {showDropdown && (
        <Dropdown ref={dropdownRef}>
          {filteredContacts.length > 0 ? (
            filteredContacts.map((contact, index) => {
              const { label, showKey, publicKey } = getContactDisplayWithKey(contact)
              return (
                <DropdownItem
                  key={contact.id}
                  $highlighted={index === highlightedIndex}
                  onClick={() => handleSelect(contact)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <ContactLabel data-private>{label}</ContactLabel>
                  {showKey && <PublicKey data-private>{publicKey}</PublicKey>}
                </DropdownItem>
              )
            })
          ) : (
            <EmptyState>No contacts found</EmptyState>
          )}

          {onClearAll && list.length > 0 && (
            <>
              <Divider />
              <ActionItem onClick={handleClearAll}>
                <TrashIcon size={16} /> Clear All
              </ActionItem>
            </>
          )}

          {emptyActionButton && (
            <ActionItem
              onClick={() => {
                emptyActionButton()
                setShowDropdown(false)
              }}
            >
              ➕ {emptyActionText}
            </ActionItem>
          )}
        </Dropdown>
      )}
    </SelectorWrapper>
  )
}

export default MajikContactListSelector

// Styled Components
const SelectorWrapper = styled.div`
  position: relative;
  width: 100%;
`

const InputContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  padding: 6px 10px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  cursor: text;
`

const Tag = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: 6px;
  font-size: 0.875rem;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }
`

const RemoveButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  margin: 0;
  line-height: 1;
  transition: color 0.2s ease;

  &:hover {
    color: #e74c3c;
  }
`

const StyledInput = styled.input`
  flex: 1;
  min-width: 120px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: 0.875rem;
  outline: none;
  padding: 4px 0;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
`

const DropdownItem = styled.div<{ $highlighted: boolean }>`
  padding: 10px 16px;
  cursor: pointer;
  background: ${({ theme, $highlighted }) =>
    $highlighted ? theme.gradients.secondary : theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  transition: all 0.15s ease;
  display: flex;
  justify-content: space-between;
  flex-direction: row;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primaryBackground};
  }
`

const EmptyState = styled.div`
  padding: 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
`

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  margin: 4px 0;
`

const ActionItem = styled.div`
  padding: 10px 16px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: 0.875rem;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`

const ContactLabel = styled.span`
  font-weight: 500;
`

const PublicKey = styled.span`
  font-size: 0.8rem;
  opacity: 0.8;
  font-family: monospace;
`
