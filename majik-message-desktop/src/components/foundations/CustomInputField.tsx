import React, { useState, type ChangeEvent, type KeyboardEvent, type JSX, useId } from 'react'
import styled from 'styled-components'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'

import { FileJsonIcon } from 'lucide-react'
import { ClipboardIcon, TextAaIcon } from '@phosphor-icons/react'

import { Tooltip } from 'react-tooltip'
import { dangerousSites, disposableEmailDomains } from '../../utils/globalDropdownOptions'
import { extractEmailDomain, isDevEnvironment, isPasswordValidSafe } from '@/utils/utils'

// Styled components
const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`

const LabelRowContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: inherit;
  gap: 5px;
  align-items: flex-start;
  justify-content: flex-start;

  p {
    margin: 0;
  }
`

const RequiredAsterisk = styled.p`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.error};
  text-align: left;
  user-select: none;
`

const Label = styled.label<{ $ishelper: boolean }>`
  display: block;
  font-size: ${({ theme }) => theme.typography.sizes.label};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 0.5rem;

  @media (max-width: 768px) {
    font-size: ${({ $ishelper }) => ($ishelper ? '16px' : '18px')};
  }
`

const InputField = styled.input<{ $haserror: boolean }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.textPrimary};
  background-color: ${({ theme }) => theme.colors.primaryBackground};

  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(234, 172, 102, 0.1);
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary || '#9ca3af'};
    opacity: 0.6;
  }
`

const HelperText = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.sizes.helper};
  margin-top: ${({ theme }) => theme.spacing.small};
  text-align: right;
  align-self: flex-end;
  user-select: none;

  width: 100%;
`

const ToggleIcon = styled.button<{ disabled: boolean }>`
  width: 50px;
  background: none;
  border: none;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.sizes.body};
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  padding-right: 15px;
`

const CharacterCount = styled.div<{ $isexceeded: boolean }>`
  align-self: flex-end;
  font-size: ${({ theme }) => theme.typography.sizes.helper};
  color: ${({ theme, $isexceeded }) =>
    $isexceeded ? theme.colors.error : theme.colors.textSecondary};
  margin-top: ${({ theme }) => theme.spacing.small};
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

const HintText = styled.span`
  font-size: 12px;
  text-align: right;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: right;
  user-select: none;
  margin-top: ${({ theme }) => theme.spacing.medium};
`

type PasswordRequirement =
  | 'NONE'
  | 'DEFAULT'
  | 'LETTERS-DIGITS'
  | 'CASED-DIGITS'
  | 'CASED-DIGITS-SYMBOLS'

const sanitizeURL = (url: string): boolean => {
  if (!url) return true

  try {
    const urlObject = new URL(url)
    return dangerousSites.every((site: string) => !urlObject.hostname.includes(site))
  } catch (error) {
    if (isDevEnvironment()) console.warn(error)
    return true
  }
}

const checkSourceURL = (url: string, whitelist: string[]): boolean => {
  if (!url) return true

  try {
    const urlObject = new URL(url)
    return whitelist.some(
      (site) => urlObject.hostname === site || urlObject.hostname.endsWith(`.${site}`)
    )
  } catch (error) {
    if (isDevEnvironment()) console.warn(error)
    return false
  }
}

const validateURL = (url: string): boolean => {
  const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i
  return urlPattern.test(url) && sanitizeURL(url)
}

// Type definitions for props
interface CustomInputFieldProps {
  label: string
  required?: boolean
  isLabelHint?: boolean
  type?: 'email' | 'password' | 'url' | null | undefined
  passwordType?: PasswordRequirement
  overwidth?: boolean
  currentValue?: string
  regex?: 'alphanumeric' | 'alphanumeric-code' | 'numbers' | 'letters' | 'all'
  onChange?: (value: string) => void
  onBlur?: () => void
  maxChar?: number
  minChar?: number
  allcaps?: boolean
  onValidated?: (valid: boolean) => void
  className?: string
  disabled?: boolean
  capitalize?: 'word' | 'character' | 'sentence' | 'first' | null
  whitelist?: string[]
  importProp?: {
    type: 'json' | 'txt' | 'clipboard' | 'all'
    jsonAccessor?: string
  }
  helper?: string
  autofocus?: boolean
  sensitive?: boolean
  placeholder?: string
}

const CustomInputField: React.FC<CustomInputFieldProps> = ({
  label,
  required = false,
  isLabelHint = false,
  type,
  passwordType = 'DEFAULT',
  currentValue = '',
  regex = 'all',
  onChange,
  onBlur,
  maxChar = 0,
  minChar,
  allcaps = false,
  onValidated,
  className,
  disabled = false,
  capitalize = null,
  whitelist,
  importProp,
  helper,
  autofocus = false,
  sensitive = false,
  placeholder
}) => {
  const tooltipId = useId()

  const inputValue = currentValue ?? ''
  const [hasError, setHasError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [charCount, setCharCount] = useState<number>(currentValue.length)

  const validateInput = (value: string): boolean => {
    let regexPattern: RegExp

    switch (regex) {
      case 'alphanumeric':
        regexPattern = /^[a-zA-Z0-9]*$/
        break
      case 'alphanumeric-code':
        regexPattern = /^[a-zA-Z0-9-_]*$/ // Allows letters, numbers, dashes, and underscores
        break
      case 'numbers':
        regexPattern = /^\d*\.?\d{0,2}$/
        break
      case 'letters':
        regexPattern = /^[a-zA-Z\s]*$/
        break
      case 'all':
        return true
      default:
        regexPattern = /.*/
        break
    }

    return regexPattern.test(value) && (value.match(/\s/g) || []).length <= 3
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { value } = event.target
    let error = false
    let errorText = ''
    const processedValue = allcaps ? value.toUpperCase() : value

    // 🔐 XSS / HTML guard
    if (checkForHTMLTags(processedValue)) {
      setHasError(true)
      setErrorMessage('HTML or script-like content is not allowed.')
      onValidated?.(false)
      return // ⛔ stop here
    }

    const characterCount = processedValue.length
    setCharCount(characterCount)

    if (maxChar > 0 && processedValue.length > maxChar) {
      return
    }

    if (required && !processedValue.trim()) {
      error = true
      errorText = 'This field is required'
      onValidated?.(false)
    } else if (type === 'email') {
      if (!validateEmail(processedValue)) {
        error = true
        errorText = 'Please enter a valid email address'
        onValidated?.(false)
      } else if (isDisposableEmail(processedValue)) {
        error = true
        errorText = 'Temporary or disposable email addresses are not allowed.'
        onValidated?.(false)
      } else {
        onValidated?.(true)
      }
    } else if (type === 'url') {
      if (processedValue.trim() !== '') {
        const urlIsValidFormat = validateURL(processedValue)
        const urlIsSafe = sanitizeURL(processedValue)
        const urlIsInWhitelist =
          whitelist && whitelist.length > 0 ? checkSourceURL(processedValue, whitelist) : true

        if (!urlIsValidFormat) {
          error = true
          errorText = 'Enter a valid URL starting with http:// or https://'
          onValidated?.(false)
        } else if (!urlIsSafe) {
          error = true
          errorText = 'This URL is unsafe. Please enter a different URL.'
          onValidated?.(false)
        } else if (!urlIsInWhitelist) {
          error = true
          errorText = 'This URL is not allowed. Please use a link from an approved source.'
          onValidated?.(false)
        } else {
          onValidated?.(true) // ✅ URL passes all checks
        }
      } else {
        onValidated?.(false)
      }
    } else if (type === 'password' && !isPasswordValidSafe(processedValue, minChar, passwordType)) {
      error = true

      switch (passwordType) {
        case 'DEFAULT': {
          errorText = `Please enter a valid password with at least ${
            !!minChar && minChar > 0 ? minChar : 8
          } characters.`
          break
        }
        case 'LETTERS-DIGITS': {
          errorText = `Please enter a valid password with at least ${
            !!minChar && minChar > 0 ? minChar : 8
          } characters and numbers.`
          break
        }
        case 'CASED-DIGITS': {
          errorText = `Please enter a valid password with at least ${
            !!minChar && minChar > 0 ? minChar : 8
          } characters and a combination of uppercase-lowercase letters and numbers.`
          break
        }
        case 'CASED-DIGITS-SYMBOLS': {
          errorText = `Please enter a valid password with at least ${
            !!minChar && minChar > 0 ? minChar : 8
          } characters and a combination of uppercase-lowercase letters, numbers, and symbols.`
          break
        }
        default: {
          errorText = `Please enter a valid password with at least ${
            !!minChar && minChar > 0 ? minChar : 8
          } characters.`
          break
        }
      }

      onValidated?.(true)
    } else if (!validateInput(processedValue)) {
      error = true
      errorText = 'Invalid input'
      onValidated?.(true)
    }

    setHasError(error)
    setErrorMessage(errorText)

    if (capitalize) {
      const capitalizedWord = autocapitalize(processedValue, capitalize)

      onChange?.(capitalizedWord)
    } else {
      onChange?.(processedValue)
    }
  }

  const togglePasswordVisibility = (): void => {
    setShowPassword(!showPassword)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const char = event.key

    // Prevent invalid input
    if (!validateInput(char) && char.length === 1) {
      event.preventDefault()
      return
    }

    // Trigger blur when Enter is pressed
    if (char === 'Enter') {
      event.preventDefault() // optional, prevents form submission
      onBlur?.() // call the onBlur handler
    }
  }

  const handleBlurSafe = (): void => {
    if (checkForHTMLTags(inputValue)) {
      setHasError(true)
      setErrorMessage('Invalid content detected.')
      onValidated?.(false)
      return
    }

    onBlur?.()
  }

  // --- IMPORT HANDLERS ---
  const handleJsonImport = async (): Promise<void> => {
    if (!importProp?.jsonAccessor) {
      setHasError(true)
      setErrorMessage('JSON accessor is required for JSON import.')
      return
    }

    try {
      const file = await selectFile('.json')
      const text = await file.text()
      const json = JSON.parse(text)

      const value = importProp.jsonAccessor
        .split('.')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((obj: any, key) => obj?.[key], json)

      if (value === undefined) {
        setHasError(true)
        setErrorMessage(`Accessor "${importProp.jsonAccessor}" not found in JSON.`)
        return
      }

      applyValue(value.toString())
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

      const trimmed = maxChar > 0 ? text.slice(0, maxChar) : text
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
    const cleaned = sanitizeInput(value)
    const processed = capitalize ? autocapitalize(cleaned, capitalize) : cleaned

    setCharCount(processed.length)
    onChange?.(processed)
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

  const renderImportIcons = (): JSX.Element | null => {
    if (!importProp) return null

    const icons: JSX.Element[] = []

    const pushIcon = (tooltip: string, icon: JSX.Element, onClick: () => void): number =>
      icons.push(
        <ImportButton
          key={tooltip}
          type="button"
          onClick={onClick}
          disabled={disabled}
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

    return (
      <div style={{ display: 'flex', gap: '6px', marginLeft: '5px' }}>
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

  const isExceeded = charCount > 2500

  return (
    <InputWrapper>
      {!isLabelHint && (
        <LabelRowContainer>
          <Label htmlFor="custom-input" $ishelper={isLabelHint}>
            {label}
          </Label>
          {required ? <RequiredAsterisk>*</RequiredAsterisk> : null}
          {renderImportIcons()}
        </LabelRowContainer>
      )}
      <div style={{ position: 'relative' }}>
        <InputField
          type={type === 'password' && !showPassword ? 'password' : 'text'}
          value={inputValue}
          onChange={handleChange}
          $haserror={hasError}
          placeholder={placeholder?.trim() ? placeholder : isLabelHint ? label : ''}
          className={className}
          disabled={disabled}
          onBlur={handleBlurSafe}
          onKeyDown={handleKeyDown}
          autoFocus={autofocus}
          data-private={sensitive ? true : undefined}
        />
        {type === 'password' && (
          <ToggleIcon onClick={togglePasswordVisibility} disabled={disabled}>
            {!showPassword ? <EyeSlashIcon width={20} /> : <EyeIcon width={20} />}
          </ToggleIcon>
        )}
      </div>
      {maxChar !== 0 && (
        <CharacterCount $isexceeded={isExceeded}>
          {charCount}/{maxChar}
        </CharacterCount>
      )}
      {helper && <HintText>{helper}</HintText>}
      {hasError && <HelperText>{errorMessage}</HelperText>}
    </InputWrapper>
  )
}

export default CustomInputField

/**
 * Transforms the input text based on the specified capitalization mode.
 *
 * @param text - The input string to be transformed.
 * @param mode - The capitalization mode to apply. Can be one of the following:
 *   - "word": Capitalizes the first letter of every word separated by whitespace.
 *   - "character": Converts the entire string to uppercase.
 *   - "sentence": Capitalizes the first letter of every sentence, defined as text following a period and a space.
 *   - "first": (Default) Capitalizes only the first character of the entire string.
 * @returns The transformed string based on the selected mode.
 */
function autocapitalize(
  text: string,
  mode: 'word' | 'character' | 'sentence' | 'first' = 'first'
): string {
  if (!text) return ''

  switch (mode) {
    case 'word':
      return text
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    case 'character':
      return text.toUpperCase()

    case 'sentence':
      return text
        .split(/(?<=\.)\s+/) // Splits text by sentences (after a period and a space)
        .map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
        .join(' ')

    case 'first':
    default:
      return text.charAt(0).toUpperCase() + text.slice(1)
  }
}

/**
 * Detects whether a string contains HTML-like or XSS-related patterns.
 * This is a heuristic check, not a full HTML parser.
 */
function checkForHTMLTags(input: string): boolean {
  if (!input) return false

  const normalized = input.toLowerCase()

  // Common HTML / SVG / XSS entry points
  const dangerousPatterns = [
    '<svg',
    '<img',
    '<script',
    '<iframe',
    '<object',
    '<embed',
    '<link',
    '<meta',
    '<style',
    '<base',
    'onload=',
    'onerror=',
    'onclick=',
    'javascript:',
    'data:'
  ]

  return dangerousPatterns.some((pattern) => normalized.includes(pattern))
}

/**
 * Sanitizes a string by removing HTML tags and dangerous constructs
 * if HTML-like content is detected.
 */
function sanitizeInput(input: string): string {
  if (!input) return ''

  if (!checkForHTMLTags(input)) {
    return input
  }

  let sanitized = input

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '')

  // Remove event handlers (onload=, onclick=, etc.)
  sanitized = sanitized.replace(/\bon\w+\s*=\s*["']?[^"']*["']?/gi, '')

  // Remove javascript: and data: protocols
  sanitized = sanitized.replace(/\b(javascript|data)\s*:/gi, '')

  // Remove stray angle brackets & quotes
  sanitized = sanitized.replace(/[<>"]/g, '')

  return sanitized.trim()
}

/**
 * Checks whether an email belongs to a known disposable or temporary provider.
 */
function isDisposableEmail(email: string): boolean {
  if (!email) return false

  const domain = extractEmailDomain(email)
  if (!domain) return false

  return disposableEmailDomains.some(
    (blocked) => domain === blocked || domain.endsWith(`.${blocked}`)
  )
}
