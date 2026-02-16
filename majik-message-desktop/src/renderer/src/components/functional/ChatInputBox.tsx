import { useState, useRef, useLayoutEffect, useCallback, useMemo, useEffect } from 'react'
import styled, { css } from 'styled-components'
import { PaperPlaneRightIcon, SmileyIcon, XIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

import {
  loadQueryResult,
  saveQueryResult,
  type API_RESPONSE_GIPHY_RESULT
} from '@renderer/lib/idb/giphy-cache'
import type { IGif } from '@giphy/js-types'
import { debounce } from '@renderer/utils/utils'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { Grid } from '@giphy/react-components'
import type { MajikahSession } from '../majikah-session-wrapper/majikah-session'

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"
const MAX_CHARS = 10000

// ─── GIF compositing helper ───────────────────────────────────────────────────
/**
 * The GIF URL is never inserted into the textarea. It lives in a separate
 * `selectedGif` state and is appended to the message only at send time using
 * a sentinel tag: [gif:URL]
 *
 * Format:  "<user text>\n[gif:https://media.giphy.com/media/abc/giphy.gif]"
 * Or:      "[gif:https://media.giphy.com/media/abc/giphy.gif]"  (no text)
 *
 * This makes the URL unambiguous on the receiving side — the bubble just looks
 * for the [gif:…] suffix, strips it from display text, and renders the image.
 * The entire composed string (text + tag) is what gets encrypted.
 */
function composeMessageWithGif(text: string, gifUrl: string | null): string {
  const trimmed = text.trim()
  if (!gifUrl) return trimmed
  if (!trimmed) return `[gif:${gifUrl}]`
  return `${trimmed}\n[gif:${gifUrl}]`
}

// ─── Giphy client fetchers ────────────────────────────────────────────────────

const buildTrendingFetcher = () => async (offset: number, majikah: MajikahSession) => {
  const queryKey = `__TRENDING__:${offset}:20`

  // 1️⃣ Check IDB first
  const cached = await loadQueryResult(queryKey)
  if (cached) return cached

  const result = await majikah.apiClient.get<API_RESPONSE_GIPHY_RESULT>(
    `/giphy/trending?offset=${offset}&limit=20`
  )

  // 3️⃣ Save to IDB
  await saveQueryResult(queryKey, result.data)

  return result.data
}

const buildSearchFetcher = (query: string) => async (offset: number, majikah: MajikahSession) => {
  const normalized = query.trim().toLowerCase()
  const queryKey = `${normalized}:${offset}:20`

  // 1️⃣ Check IDB
  const cached = await loadQueryResult(queryKey)
  if (cached) return cached

  // 2️⃣ Fetch from server
  const result = await majikah.apiClient.get<API_RESPONSE_GIPHY_RESULT>(
    `/giphy/search?q=${encodeURIComponent(normalized)}&offset=${offset}&limit=20`
  )

  // 3️⃣ Save to IDB
  await saveQueryResult(queryKey, result.data)

  return result.data
}

// ─── Styled components ────────────────────────────────────────────────────────

const Wrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
  width: 100%;
`

// ─── GIF preview strip (sits above the input row) ─────────────────────────────
const GifPreviewStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 0;
`

const GifPreviewThumb = styled.div`
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(79, 110, 247, 0.35);
  flex-shrink: 0;
  height: 72px;
  width: auto;
  max-width: 120px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`

const GifPreviewImg = styled.img`
  height: 72px;
  width: auto;
  max-width: 120px;
  display: block;
  object-fit: cover;
`

const GifPreviewDismiss = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.85);
  transition: background 100ms;
  &:hover {
    background: rgba(0, 0, 0, 0.85);
  }
`

const GifPreviewLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  text-transform: uppercase;
`

// ─── Input row ─────────────────────────────────────────────────────────────
const InputRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
`

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 4px;
  flex-shrink: 0;
`

const ToolBtn = styled.button<{ $active?: boolean }>`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition:
    border-color 120ms ease,
    color 120ms ease,
    background 120ms ease;

  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-color: ${({ theme }) => theme.colors.textSecondary};
    color: ${({ theme }) => theme.colors.primary};
  }

  ${({ $active, theme }) =>
    $active &&
    css`
      background: ${theme.colors.secondaryBackground};
      border-color: rgba(79, 110, 247, 0.45);
      color: ${theme.colors.primary};
    `}
`

const GifLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 1;
`

const TextareaWrap = styled.div<{ $focused: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ $focused, theme }) => ($focused ? theme.colors.primary : 'transparent')};
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 150ms ease;
`

const StyledTextarea = styled.textarea<{ $maxHeight: number }>`
  width: 100%;
  padding: 11px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  min-height: 90px;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.secondaryBackground} transparent`};
  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.4;
  }
`

const InputMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 12px 7px;
`

const CharCount = styled.span<{ $nearLimit: boolean }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.06em;
  color: ${({ $nearLimit, theme }) =>
    $nearLimit ? (theme.colors.error ?? theme.colors.primary) : theme.colors.textSecondary};
  opacity: ${({ $nearLimit }) => ($nearLimit ? 1 : 0.4)};
  transition:
    color 150ms ease,
    opacity 150ms ease;
`

const KeyHint = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
`

const SendBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: ${({ theme }) => theme.gradients.strong};
  color: ${({ theme }) => theme.colors.primaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 4px;
  transition:
    opacity 120ms ease,
    transform 120ms ease;
  &:hover:not(:disabled) {
    opacity: 0.85;
    transform: scale(1.05);
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none;
  }
`

// ─── Popover shell ────────────────────────────────────────────────────────────
const Popover = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 10px;
  z-index: 100;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};

  em-emoji-picker {
    --border-radius: 0px;
    --background-rgb: 26, 30, 39;
    --rgb-background: 26, 30, 39;
    --rgb-color: 232, 234, 240;
    --rgb-accent: 79, 110, 247;
    --rgb-input: 20, 23, 32;
    --shadow: none;
    --border-width: 0px;
    height: 360px;
    width: fit-content;
  }
`

const GifPanel = styled.div`
  width: 340px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`

const GifSearchBar = styled.div`
  padding: 10px 12px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
`

const GifSearchInput = styled.input`
  width: 100%;
  padding: 7px 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  outline: none;
  transition: border-color 120ms;
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.5;
  }
  &:focus {
    border-color: rgba(79, 110, 247, 0.5);
  }
`

const GifGrid = styled.div`
  overflow-y: auto;
  padding: 8px;
  height: 312px;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.primaryBackground} transparent`};
  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primaryBackground};
    border-radius: 4px;
  }
  & > div {
    width: 100% !important;
  }
`

const GifAttribution = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 5px 10px 7px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
  letter-spacing: 0.05em;
  border-top: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
`

// ─── Types ────────────────────────────────────────────────────────────────────
type PickerMode = 'emoji' | 'gif' | null

interface ChatInputBoxProps {
  majikah: MajikahSession
  onSend: (text: string) => Promise<void> | void
  onUpdate?: (text: string) => void
  placeholder?: string
  maxHeight?: number
  disabled?: boolean
  sendOnEnter?: boolean
  enableGIF?: boolean
  enableEmoji?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ChatInputBox: React.FC<ChatInputBoxProps> = ({
  majikah,
  onSend,
  onUpdate,
  placeholder,
  maxHeight = 200,
  disabled = false,
  sendOnEnter = true,
  enableGIF = true,
  enableEmoji = true
}) => {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)

  // ── Staged GIF state ───────────────────────────────────────────────────────
  /**
   * `selectedGif` holds the staged IGif object (never put in the textarea).
   * On select → replaces any previous selection.
   * On send   → URL is appended as [gif:URL] suffix then state is cleared.
   * On dismiss → cleared without sending.
   */
  const [selectedGif, setSelectedGif] = useState<IGif | null>(null)

  const [gifQuery, setGifQuery] = useState('')
  const [debouncedGifQuery, setDebouncedGifQuery] = useState('')
  const [gifGridKey, setGifGridKey] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const onEmojiSelectRef = useRef<(emoji: { native: string }) => void>(() => {})

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`
  }, [value, maxHeight])

  // ── Close picker on outside click ─────────────────────────────────────────
  useEffect(() => {
    if (!pickerMode) return
    const handleOutside = (e: MouseEvent): void => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setPickerMode(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [pickerMode])

  // ── GIF search debounce ────────────────────────────────────────────────────
  const debouncedSetQuery = useMemo(
    () =>
      debounce((q: string) => {
        setDebouncedGifQuery(q)
        setGifGridKey((k) => k + 1)
      }, 400),
    []
  )

  useEffect(() => () => debouncedSetQuery.cancel(), [debouncedSetQuery])

  const handleGifQueryChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const q = e.target.value
    setGifQuery(q)
    debouncedSetQuery(q)
  }

  // ── Giphy Grid fetch function ──────────────────────────────────────────────
  const fetchGifs = useMemo(
    () =>
      debouncedGifQuery.trim()
        ? buildSearchFetcher(debouncedGifQuery.trim())
        : buildTrendingFetcher(),
    [debouncedGifQuery]
  )

  // ── GIF select → stage, replace any previous, close picker ───────────────
  const handleGifSelect = useCallback((gif: IGif, e: React.SyntheticEvent) => {
    e.preventDefault()
    // Replaces any previously staged GIF — no accumulation
    setSelectedGif(gif)
    setPickerMode(null)
    setGifQuery('')
    setDebouncedGifQuery('')
  }, [])

  // ── Emoji insertion at cursor ──────────────────────────────────────────────
  const insertEmoji = useCallback(
    (emoji: { native: string }) => {
      const ta = textareaRef.current
      const native = emoji.native
      if (!native) return
      if (ta) {
        const start = ta.selectionStart ?? value.length
        const end = ta.selectionEnd ?? value.length
        const newValue = value.slice(0, start) + native + value.slice(end)
        if (newValue.length <= MAX_CHARS) {
          setValue(newValue)
          onUpdate?.(newValue)
          requestAnimationFrame(() => {
            ta.focus()
            const pos = start + native.length
            ta.setSelectionRange(pos, pos)
          })
        }
      } else {
        const newValue = value + native
        if (newValue.length <= MAX_CHARS) {
          setValue(newValue)
          onUpdate?.(newValue)
        }
      }
    },
    [value, onUpdate]
  )

  // eslint-disable-next-line react-hooks/refs
  onEmojiSelectRef.current = insertEmoji

  const togglePicker = (mode: PickerMode): void => {
    setPickerMode((prev) => (prev === mode ? null : mode))
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  /**
   * Composes the final encrypted string at send time:
   *   text only          → "hey there"
   *   gif only           → "[gif:https://media.giphy.com/...]"
   *   text + gif         → "hey there\n[gif:https://media.giphy.com/...]"
   *
   * The composed string is what gets passed to onSend() and subsequently
   * encrypted. The textarea and staged GIF are both cleared after send.
   */
  const handleSend = async (): Promise<void> => {
    if (disabled) {
      toast.error('Assign recipients first.')
      return
    }

    const gifUrl = selectedGif?.images?.original?.url ?? null

    const composed = composeMessageWithGif(value, gifUrl)

    if (!composed) return

    console.log('Sending', composed)

    try {
      await onSend(composed)
      setValue('')
      setSelectedGif(null)
      onUpdate?.(composed)
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
      const t = text.slice(0, MAX_CHARS)
      setValue(t)
      onUpdate?.(t)
      toast.error('Message too long', {
        description: `Limited to ${MAX_CHARS.toLocaleString()} characters.`
      })
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const charCount = value.length
  const nearLimit = charCount > MAX_CHARS * 0.9
  const canSend = value.trim().length > 0 || selectedGif !== null

  // ── GIF preview thumbnail URL (small, for the strip) ─────────────────────
  const gifPreviewUrl =
    selectedGif?.images?.fixed_height_small?.url ?? selectedGif?.images?.fixed_height?.url ?? null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Wrapper ref={wrapperRef}>
      {/* Popover */}
      {pickerMode && (
        <Popover ref={popoverRef} data-private>
          {pickerMode === 'emoji' && enableEmoji && (
            <Picker
              data={data}
              theme="dark"
              set="native"
              previewPosition="none"
              skinTonePosition="none"
              onEmojiSelect={(emoji: { native: string }) => onEmojiSelectRef.current(emoji)}
            />
          )}

          {pickerMode === 'gif' && enableGIF && (
            <GifPanel>
              <GifSearchBar>
                <GifSearchInput
                  value={gifQuery}
                  onChange={handleGifQueryChange}
                  placeholder="Search GIFs or browse trending…"
                  autoFocus
                  data-private
                />
              </GifSearchBar>
              <GifGrid data-private>
                <Grid
                  key={gifGridKey}
                  fetchGifs={(offset) => fetchGifs(offset, majikah)}
                  width={316}
                  columns={3}
                  gutter={4}
                  onGifClick={handleGifSelect}
                  noLink
                  hideAttribution
                />
              </GifGrid>
              <GifAttribution>Powered by GIPHY</GifAttribution>
            </GifPanel>
          )}
        </Popover>
      )}

      {/* GIF preview strip — shown only when a GIF is staged */}
      {selectedGif && gifPreviewUrl && enableGIF && (
        <GifPreviewStrip>
          <GifPreviewThumb>
            <GifPreviewImg src={gifPreviewUrl} alt={selectedGif.title ?? 'GIF'} data-private />
            <GifPreviewDismiss
              onClick={() => setSelectedGif(null)}
              title="Remove GIF"
              type="button"
            >
              <XIcon size={10} weight="bold" />
            </GifPreviewDismiss>
          </GifPreviewThumb>
          <GifPreviewLabel>GIF attached · tap to replace</GifPreviewLabel>
        </GifPreviewStrip>
      )}

      {/* Input row */}
      <InputRow>
        <Toolbar>
          {enableEmoji && (
            <ToolBtn
              $active={pickerMode === 'emoji'}
              title="Emoji"
              onClick={() => togglePicker('emoji')}
              type="button"
            >
              <SmileyIcon size={15} weight={pickerMode === 'emoji' ? 'fill' : 'regular'} />
            </ToolBtn>
          )}
          {enableGIF && (
            <ToolBtn
              $active={pickerMode === 'gif' || selectedGif !== null}
              title="GIF"
              onClick={() => togglePicker('gif')}
              type="button"
            >
              <GifLabel>GIF</GifLabel>
            </ToolBtn>
          )}
        </Toolbar>

        <TextareaWrap $focused={focused}>
          <StyledTextarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              selectedGif
                ? 'Add a message to go with your GIF…'
                : (placeholder ?? 'Message… (Shift+Enter for new line)')
            }
            rows={1}
            $maxHeight={maxHeight}
            maxLength={MAX_CHARS}
            data-private="lipsum"
          />
          <InputMeta>
            <CharCount $nearLimit={nearLimit}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </CharCount>
            <KeyHint>↵ send · ⇧↵ new line</KeyHint>
          </InputMeta>
        </TextareaWrap>

        <SendBtn onClick={handleSend} disabled={!canSend} title="Send message" type="button">
          <PaperPlaneRightIcon size={16} weight="bold" />
        </SendBtn>
      </InputRow>
    </Wrapper>
  )
}
