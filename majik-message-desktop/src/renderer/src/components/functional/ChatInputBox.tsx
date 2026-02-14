import { useState, useRef, useLayoutEffect } from 'react'
import styled from 'styled-components'
import { PaperPlaneRightIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

/* ======================================================
 * Styled Components
 * ====================================================== */

const MAX_CHARS = 10000

const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: ${({ theme }) => theme.colors.secondaryBackground};
  position: relative;
  flex: 1;
`

const Input = styled.textarea<{ $maxheight: number }>`
  flex: 1;
  padding: 15px 18px;
  font-size: 14px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  resize: none;
  outline: none;
  overflow-y: auto;
  max-height: ${({ $maxheight }) => $maxheight}px;
  min-height: 90px;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 8px;
  }
`

const SendButton = styled.button`
  position: absolute;
  bottom: 24px;
  right: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: ${({ theme }) => theme.gradients.strong};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: 50%;
  width: 36px;
  height: 36px;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

/* ======================================================
 * Component
 * ====================================================== */

interface ChatInputBoxProps {
  onSend: (text: string) => Promise<void> | void
  onUpdate?: (text: string) => void
  placeholder?: string
  maxHeight?: number
  disabled?: boolean
  sendOnEnter?: boolean
}

export const ChatInputBox: React.FC<ChatInputBoxProps> = ({
  onSend,
  onUpdate,
  placeholder,
  maxHeight = 200,
  disabled = false,
  sendOnEnter = true
}) => {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-expand logic
  useLayoutEffect(() => {
    if (!textareaRef.current) return
    const ta = textareaRef.current
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`
  }, [value, maxHeight])

  const handleSend = async (): Promise<void> => {
    if (disabled) {
      toast.error('Assign recipients first.')
      return
    }

    if (!value.trim()) return
    try {
      await onSend(value)
      setValue('')
    } catch (err) {
      console.error('Failed to send message', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!sendOnEnter) return
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const text = e.target.value
    if (text.length <= MAX_CHARS) {
      setValue(text)
      onUpdate?.(text)
    } else {
      setValue(text.slice(0, MAX_CHARS)) // truncate if pasted content exceeds limit
      onUpdate?.(text.slice(0, MAX_CHARS))
      toast.error('Message Too Long', { description: 'Your message is too long.' })
    }
  }

  return (
    <InputWrapper>
      <Input
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type a message...'}
        rows={1}
        $maxheight={maxHeight}
        maxLength={MAX_CHARS}
        data-private="lipsum"
      />
      <SendButton onClick={handleSend} disabled={!value.trim()}>
        <PaperPlaneRightIcon size={20} weight="bold" />
      </SendButton>
    </InputWrapper>
  )
}
