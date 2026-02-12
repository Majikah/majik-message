import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { downloadBlob } from '../../utils/utils'
import { ActionButton, ButtonPrimaryConfirm } from '../../globals/buttons'
import { toast } from 'sonner'
import { SectionSubTitle } from '@renderer/globals/styled-components'

/* ---------------------------------------------
 * Types
 * ------------------------------------------- */
type Mode = 'encrypt' | 'decrypt'

/* ---------------------------------------------
 * Styled Components
 * ------------------------------------------- */
const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  color: ${({ theme }) => theme.colors.textPrimary};

  overflow: hidden;
`

const Toggle = styled(ActionButton)<{ mode: Mode }>`
  background: ${({ mode, theme }) => (mode === 'encrypt' ? theme.gradients.primary : '#16a34a')};
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
  }
`

const Body = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 25px;
`

const Section = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
`

const SubtitleHeaderText = styled(SectionSubTitle)`
  justify-content: space-between;
  align-items: center;
  padding: 12px 0px;
  display: flex;
  flex-direction: row;
`

const Label = styled.div`
  padding: 8px 16px;
  font-size: 12px;
  opacity: 0.6;
`

const TextArea = styled.textarea<{ readOnly?: boolean }>`
  flex: 1;
  border-radius: 12px;
  resize: none;
  padding: 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: ${({ theme }) => theme.typography.sizes.label};
  line-height: 1.5;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  outline: none;
  min-height: 240px;
  color: ${({ readOnly, theme }) =>
    readOnly ? theme.colors.textSecondary : theme.colors.textPrimary};
  background: ${({ readOnly, theme }) =>
    readOnly ? theme.colors.secondaryBackground : theme.colors.semitransparent};

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

const ButtonRowA = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 0px;
  justify-content: flex-start;
  flex-direction: row;
  width: 100%;
`
const ButtonRowB = styled(ButtonRowA)`
  display: flex;
  gap: 8px;
  padding: 8px 0px;
  justify-content: flex-end;
  flex-direction: row;
  width: 100%;
`

const ExportButton = styled(ButtonPrimaryConfirm)`
  padding: 6px 20px;
  width: 100%;
`

interface TextEditPreviewInputProps {
  onEncrypt: (input: string) => Promise<string>
  onDecrypt: (input: string) => Promise<string>
  downloadName?: string
}

/* ---------------------------------------------
 * Component
 * ------------------------------------------- */
const TextEditPreviewInput: React.FC<TextEditPreviewInputProps> = ({
  onEncrypt,
  onDecrypt,
  downloadName
}) => {
  const [mode, setMode] = useState<Mode>('encrypt')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [, setIsProcessing] = useState(false)

  useEffect(() => {
    let cancelled = false

    const process = async (): Promise<void> => {
      if (!input.trim()) {
        setOutput('')
        return
      }

      setIsProcessing(true)

      try {
        const result = mode === 'encrypt' ? await onEncrypt(input) : await onDecrypt(input)

        if (!cancelled) {
          setOutput(result)
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setOutput('⚠️ Failed to process text')
        }
      } finally {
        if (!cancelled) {
          setIsProcessing(false)
        }
      }
    }

    process()

    return () => {
      cancelled = true
    }
  }, [input, mode, onEncrypt, onDecrypt])

  const handleToggle = (): void => {
    setMode((prev) => (prev === 'encrypt' ? 'decrypt' : 'encrypt'))
    setInput('')
    setOutput('')
  }

  // --- IMPORT HANDLERS ---
  const handleJsonImport = async (): Promise<void> => {
    try {
      const file = await selectFile('.json')
      const text = await file.text()
      const json = JSON.parse(text)

      const value = 'encrypted'
        .split('.')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((obj: any, key) => obj?.[key], json)

      if (value === undefined) {
        toast.error('Failed to import JSON', {
          description: 'Accessor "encrypted" not found in JSON',
          id: `toast-error-import-json`
        })
        return
      }

      applyValue(value.toString())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Failed to import JSON', {
        description: err.message || 'Failed to import JSON',
        id: `toast-error-import-json`
      })
    }
  }

  const handleTextImport = async (): Promise<void> => {
    try {
      const file = await selectFile('.txt')
      const text = await file.text()

      if (!text.trim()) {
        toast.error('Failed to import text', {
          description: 'Text file is empty.',
          id: `toast-error-import-text`
        })
        return
      }

      applyValue(text)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Failed to import text', {
        description: err.message || 'Failed to import text',
        id: `toast-error-import-text`
      })
    }
  }

  const handleClipboardImport = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      applyValue(text)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error('Failed to import text', {
        description: `Failed to read from clipboard: ${err}`,
        id: `toast-error-import-text`
      })
    }
  }

  const applyValue = (value: string): void => {
    setInput(value)
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

  const handleCopy = useCallback(() => {
    if (!output?.trim()) {
      toast.error('Failed to copy to clipboard', {
        description: 'No text to copy.',
        id: `toast-error-copy-${output}`
      })
      return
    }
    try {
      navigator.clipboard.writeText(output)
      toast.success('Copied to clipboard', {
        description: output.length > 200 ? output.slice(0, 200) + '…' : output,
        id: `toast-success-copy-${output}`
      })

      // Native Notification
      window.electron.notify(
        'Copied to clipboard',
        output.length > 200 ? output.slice(0, 200) + '…' : output
      )
    } catch (e) {
      // fallback: show in prompt
      toast.error('Failed to copy to clipboard', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-copy-${output}`
      })
    }
  }, [output])

  const handleDownloadTxt = (): void => {
    try {
      const blob = new Blob([output], {
        type: 'application/octet-stream'
      })
      downloadBlob(blob, 'txt', downloadName || 'Encoded')
      // Native Notification
      window.electron.notify(
        'Message Downloaded',
        downloadName || 'This message has been saved as a TXT file.'
      )
    } catch (e) {
      toast.error('Failed to download message as TXT', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-txt-${output}`
      })
    }
  }

  const handleDownloadJson = (): void => {
    const messageJSON = {
      original: input,
      encrypted: output
    }

    try {
      const jsonString = JSON.stringify(messageJSON)

      const blob = new Blob([jsonString], {
        type: 'application/json;charset=utf-8'
      })
      downloadBlob(blob, 'json', downloadName || 'Encoded')

      toast.success('Message Downloaded', {
        description: 'This message has been saved as a JSON file.',
        id: `toast-success-json-${output}`
      })
      // Native Notification
      window.electron.notify(
        'Message Downloaded',
        downloadName || 'This message has been saved as a JSON file.'
      )
    } catch (e) {
      toast.error('Failed to download message as JSON', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: `toast-error-json-${output}`
      })
    }
  }

  const labels = useMemo(
    () => ({
      input: mode === 'encrypt' ? 'Plain Text Input' : 'Encrypted Text Input',
      output: mode === 'encrypt' ? 'Encrypted Preview' : 'Decrypted Preview'
    }),
    [mode]
  )

  return (
    <Root>
      <SubtitleHeaderText>
        <span>Message Content</span>

        <Toggle
          mode={mode}
          onClick={handleToggle}
          title="Click to toggle between Encrypt and Decrypt"
          id="button-toggle-mode"
        >
          {mode === 'encrypt' ? 'Encrypt Mode' : 'Decrypt Mode'}
        </Toggle>
      </SubtitleHeaderText>

      <Body>
        <Section>
          <Label>{labels.input}</Label>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'encrypt' ? 'Type any message here…' : 'Paste encrypted text here…'
            }
            data-private="lipsum"
            id="panel-input-text"
          />
          <ButtonRowA id="panel-input-actions">
            <ExportButton onClick={handleClipboardImport}>Paste</ExportButton>
            <ExportButton onClick={handleTextImport}>Import .txt</ExportButton>
            <ExportButton onClick={handleJsonImport}>Import .json</ExportButton>
          </ButtonRowA>
        </Section>

        <Section>
          <Label>{labels.output}</Label>
          <TextArea readOnly value={output} data-private="lipsum" id="panel-output-text" />
          <ButtonRowB id="panel-output-actions">
            <ExportButton onClick={handleCopy}>Copy</ExportButton>
            <ExportButton onClick={handleDownloadTxt}>Download .txt</ExportButton>
            <ExportButton onClick={handleDownloadJson}>Download .json</ExportButton>
          </ButtonRowB>
        </Section>
      </Body>
    </Root>
  )
}

export default TextEditPreviewInput
