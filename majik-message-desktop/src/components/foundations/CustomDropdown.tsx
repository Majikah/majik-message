import React, { type ChangeEvent } from 'react'
import styled from 'styled-components'

// Styled components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  min-height: 40px;
  width: 100%;

  margin: 10px 0px;
`

const Dropdown = styled.select<{ $isunset: boolean }>`
  padding: 10px 15px;
  font-size: ${({ theme }) => theme.typography.sizes.body};
  background-color: ${({ theme }) => theme.colors.secondaryBackground};
  border: 0px;
  min-height: 35px;
  border-radius: 25px;

  width: 100%;
  outline: none;
  color: ${({ theme, $isunset }) =>
    $isunset ? theme.colors.textSecondary : theme.colors.textPrimary};
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.14);
  @media (max-width: 768px) {
    font-size: 16px;
  }
`

const Label = styled.span<{ $iserror: boolean }>`
  font-size: ${({ theme }) => theme.typography.sizes.label};
  color: ${({ theme }) => theme.colors.textPrimary};

  margin-bottom: ${({ theme }) => theme.spacing.small};
  font-weight: 700;
  text-align: left;
  user-select: none;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`

// Type definitions for the component props
interface CustomDropdownProps {
  options: string[] | { [key: string]: string } | { value: string }[] | object
  currentValue: string | undefined
  label?: string | null
  required?: boolean
  title: string
  disabled?: boolean
  onChange?: (value: string) => void
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options = [],
  currentValue,
  label = 'Select an option',
  required = false,
  title,
  disabled = false,
  onChange
}) => {
  const selectedOption = currentValue || ''

  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const { value } = event.target

    onChange?.(value)
  }

  const getOptions = (): string[] => {
    // If options is an object (enum), convert it to an array of strings
    if (typeof options === 'object' && !Array.isArray(options) && options !== null) {
      return Object.values(options)
    }

    // If options is an array of objects with a value property
    if (
      Array.isArray(options) &&
      options.length > 0 &&
      typeof options[0] === 'object' &&
      options[0] !== null
    ) {
      return options.map((option) => ('value' in option ? option.value : option))
    }

    // Otherwise, assume options is an array of strings
    return Array.isArray(options) ? options : []
  }

  const isError = required && !selectedOption
  const isUnset = !selectedOption

  return (
    <Container>
      {!!label && <Label $iserror={isError}>{label}</Label>}

      <Dropdown
        value={selectedOption}
        onChange={handleChange}
        $isunset={isUnset}
        disabled={disabled}
      >
        <option value="" disabled>
          {title}
        </option>
        {getOptions().map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </Dropdown>
    </Container>
  )
}

export default CustomDropdown
