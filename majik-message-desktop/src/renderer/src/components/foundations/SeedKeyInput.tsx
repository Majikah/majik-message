import { FileJsonIcon } from 'lucide-react'
import { ClipboardIcon, ClockClockwiseIcon, DiceFiveIcon, TextAaIcon } from '@phosphor-icons/react'

import React, { type JSX, useEffect, useId, useState } from 'react'
import styled from 'styled-components'
import { Tooltip } from 'react-tooltip'
import CustomInputField from './CustomInputField'
import { MajikKeyStore } from '@majikah/majik-message'

/* -------------------------------
 * Styled Components
 * ------------------------------- */

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
`

const GridText = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: inherit;
`

const SeedInput = styled.input<{ $haserror: boolean }>`
 padding: 10px 15px;
  background-color: transparent;
  border: 1px solid transparent;
    overflow-hidden;

  font-size: ${({ theme }) => theme.typography.sizes.subject};

  border-bottom: 1px solid
    ${({ $haserror, theme }) =>
      $haserror ? theme.colors.error : theme.colors.secondaryBackground};

  outline: none;
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 90%;
  flex-shrink: 1;
  user-select: none;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.typography.sizes.helper};
  }


`

const HelperText = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.sizes.helper};
  margin-top: ${({ theme }) => theme.spacing.small};
  text-align: right;
  align-self: flex-end;
  user-select: none;
  max-width: 270px;
  width: 100%;
`

// Styled component for the import icon button
const ImportButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid transparent;
  cursor: pointer;
  padding: 0;
  margin-left: 5px;
  transition: all 0.3s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.textSecondary};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

/* -------------------------------
 * Helpers
 * ------------------------------- */

const EMPTY_SEED = Array(12).fill('')

/* -------------------------------
 * Types
 * ------------------------------- */

interface SeedKeyInputProps {
  /** Either a space-separated seed string or MnemonicJSON */
  currentValue?: MnemonicJSON

  /** Always returns MnemonicJSON */
  onChange?: (value: MnemonicJSON) => void

  importProp?: {
    type: 'json' | 'txt' | 'clipboard' | 'all'
  }

  allowGenerate?: boolean
  requireBackupKey?: boolean
  onUpdatePassphrase?: (value: string) => void
}

/* -------------------------------
 * Component
 * ------------------------------- */

export const SeedKeyInput: React.FC<SeedKeyInputProps> = ({
  currentValue,
  onChange,
  onUpdatePassphrase,
  importProp,
  allowGenerate = false,
  requireBackupKey = false
}) => {
  const tooltipId = useId()
  const [words, setWords] = useState<string[]>(() => currentValue?.seed || [...EMPTY_SEED])

  const [hasError, setHasError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const [mnemonicJSON, setMnemonicJSON] = useState<MnemonicJSON>({
    id: currentValue?.id || '',
    seed:
      currentValue?.seed || !!allowGenerate
        ? seedStringToArray(MajikKeyStore.generateMnemonic())
        : [...EMPTY_SEED],
    phrase: currentValue?.phrase
  })

  const [jsonID, setJSONID] = useState<string>('')
  const [passphrase, setPassphrase] = useState<string>('')

  /* Sync if currentValue changes */
  useEffect(() => {
    if (!currentValue) return
    setWords(currentValue?.seed || [...EMPTY_SEED])
    setMnemonicJSON(currentValue)
    setJSONID(currentValue.id)
    setPassphrase(currentValue?.phrase || '')
  }, [currentValue])

  useEffect(() => {
    if (!allowGenerate) return
    handleGenerateMnemonic()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (index: number, value: string): void => {
    const sanitized = value
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 100)
      .toLowerCase()

    const next = [...words]
    next[index] = sanitized

    setWords(next)
    setMnemonicJSON((prev) => ({ ...prev, seed: next }))

    onChange?.(mnemonicJSON)
  }

  const handleClear = (): void => {
    setJSONID('')
    setPassphrase('')
    setWords([...EMPTY_SEED])
    onChange?.({
      id: '',
      seed: [...EMPTY_SEED]
    })
  }

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>): void => {
    if (index !== 0) return

    const pastedText = e.clipboardData.getData('text')
    if (!pastedText) return

    // Detect multi-word paste
    if (!pastedText.includes(' ')) return

    e.preventDefault()

    const parsed = seedStringToArray(pastedText)

    setWords(parsed)

    setMnemonicJSON((prev) => ({ ...prev, seed: parsed }))

    onChange?.(mnemonicJSON)

    setHasError(false)
    setErrorMessage('')
  }

  // --- IMPORT HANDLERS ---
  const handleJsonImport = async (): Promise<void> => {
    try {
      const file = await selectFile('.json')
      const text = await file.text()
      const json = JSON.parse(text) as MnemonicJSON

      setWords(json.seed)
      setJSONID(json.id)
      if (json?.phrase) {
        setPassphrase(json.phrase)
        onUpdatePassphrase?.(json.phrase)
      }

      onChange?.(json)
      setHasError(false)
      setErrorMessage('')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setHasError(true)
      setErrorMessage(err.message || 'Failed to import JSON')
    }
  }

  const handleTextImport = async (): Promise<void> => {
    try {
      const file = await selectFile('.txt')
      const text = await file.text()

      if (!text.trim()) {
        setHasError(true)
        setErrorMessage('Text file is empty.')
        return
      }

      const trimmed = text.length > 100 ? text.slice(0, 100) : text
      applyValue(trimmed)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setHasError(true)
      setErrorMessage(err.message || 'Failed to import text')
    }
  }

  const handleClipboardImport = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()

      applyValue(text)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setHasError(true)
      setErrorMessage(`Failed to read from clipboard: ${err}`)
    }
  }

  const applyValue = (value: string): void => {
    const arraySeed = seedStringToArray(value)
    setWords(arraySeed)
    setMnemonicJSON((prev) => ({ ...prev, seed: arraySeed }))
    onChange?.(mnemonicJSON)
    setHasError(false)
    setErrorMessage('')
  }

  const selectFile = (accept: string): Promise<File> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.onchange = () => {
        if (input.files?.[0]) resolve(input.files[0])
        else reject(new Error('No file selected'))
      }
      input.click()
    })
  }

  const handleUpdateJSONID = (value: string): void => {
    if (!value?.trim()) return
    setJSONID(value)
    setMnemonicJSON((prev) => ({ ...prev, id: value }))

    onChange?.(mnemonicJSON)
    setHasError(false)
  }

  const handleUpdatePassphrase = (value: string): void => {
    if (!value?.trim()) {
      setPassphrase('')
      setMnemonicJSON((prev) => ({ ...prev, phrase: undefined }))
      return
    }

    setMnemonicJSON((prev) => ({ ...prev, phrase: value }))
    setPassphrase(value)
    onChange?.(mnemonicJSON)
    onUpdatePassphrase?.(value)
    setHasError(false)
  }

  const handleGenerateMnemonic = (): void => {
    const m = MajikKeyStore.generateMnemonic()

    const seedArray = seedStringToArray(m)
    setWords(seedArray)
    setMnemonicJSON((prev) => ({ ...prev, seed: seedArray }))
  }

  const renderImportIcons = (): JSX.Element | null => {
    if (!importProp) return null

    const icons: JSX.Element[] = []

    const pushIcon = (tooltip: string, icon: JSX.Element, onClick: () => void): number =>
      icons.push(
        <ImportButton
          key={tooltip}
          type="button"
          onClick={onClick}
          aria-label={tooltip}
          data-tooltip-id={tooltipId}
          data-tooltip-content={tooltip}
        >
          {icon}
        </ImportButton>
      )

    switch (importProp.type) {
      case 'json':
        pushIcon('Import a JSON file', <FileJsonIcon width={16} />, handleJsonImport)
        break

      case 'txt':
        pushIcon('Import a text file', <TextAaIcon width={16} />, handleTextImport)
        break

      case 'clipboard':
        pushIcon('Paste text from clipboard', <ClipboardIcon width={16} />, handleClipboardImport)
        break

      case 'all':
        pushIcon('Import a JSON file', <FileJsonIcon width={16} />, handleJsonImport)
        pushIcon('Import a text file', <TextAaIcon width={16} />, handleTextImport)
        pushIcon('Paste text from clipboard', <ClipboardIcon width={16} />, handleClipboardImport)
        break
    }

    pushIcon('Clear', <ClockClockwiseIcon width={16} />, handleClear)
    allowGenerate && pushIcon('Generate Seed', <DiceFiveIcon width={16} />, handleGenerateMnemonic)
    return (
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginLeft: '5px',
          justifyContent: 'flex-end'
        }}
      >
        {icons}
        <Tooltip
          id={tooltipId}
          place="top"
          delayShow={300}
          style={{
            fontSize: '11px',
            borderRadius: '6px',
            padding: '6px 8px'
          }}
        />
      </div>
    )
  }

  return (
    <Root>
      {hasError && <HelperText>{errorMessage}</HelperText>}

      {!!requireBackupKey && (
        <CustomInputField
          onChange={handleUpdateJSONID}
          maxChar={500}
          label="Backup Key"
          currentValue={jsonID}
          required
          importProp={{
            type: 'txt'
          }}
          key="seed-backup"
          sensitive={true}
        />
      )}

      <CustomInputField
        onChange={handleUpdatePassphrase}
        maxChar={500}
        regex="alphanumeric"
        label="Password"
        currentValue={passphrase}
        importProp={{
          type: 'txt'
        }}
        key="seed-passphrase"
        required
        sensitive={true}
      />
      {renderImportIcons()}
      <GridText>
        {words.map((word, index) => (
          <SeedInput
            key={index}
            value={word}
            placeholder={`${index + 1}`}
            onChange={(e) => handleChange(index, e.target.value)}
            $haserror={hasError}
            onPaste={(e) => handlePaste(index, e)}
            data-private
          />
        ))}
      </GridText>
    </Root>
  )
}

interface MnemonicJSON {
  seed: string[]
  id: string
  phrase?: string
}

function seedStringToArray(seed: string): string[] {
  return seed
    .trim()
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter(Boolean)
}
