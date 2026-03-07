import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  TextBolderIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  TextHOneIcon,
  TextHTwoIcon,
  TextHThreeIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  // LinkIcon,
  // LinkBreakIcon,
  // TextAlignLeftIcon,
  // TextAlignCenterIcon,
  // TextAlignRightIcon,
  MinusIcon,
  TextIndentIcon,
  TextOutdentIcon,
  // ImageIcon,
  SmileyIcon,
  HighlighterIcon
} from '@phosphor-icons/react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { Markdown } from '@tiptap/markdown'

// ─── NOTE ─────────────────────────────────────────────────────────────────────
// TipTap doesn't ship a markdown serializer. Install `tiptap-markdown` or
// `@tiptap/extension-markdown` and wire it in. Example with tiptap-markdown:
//
//   import { Markdown } from 'tiptap-markdown'
//   // add to extensions array
//   // replace generateMarkdown with: editor.storage.markdown.getMarkdown()
//
// The `generateMarkdown` import above is a placeholder — replace it with your
// chosen serializer. The simplest drop-in:
//
//   import TurndownService from 'turndown'
//   const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' })
//   const markdown = td.turndown(editor.getHTML())
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── Styled components ────────────────────────────────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.primaryBackground};
  transition: border-color 150ms ease;

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary}66;
  }
`

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.secondaryBackground}55;
  flex-wrap: wrap;
  flex-shrink: 0;
`

const ToolDivider = styled.div`
  width: 1px;
  height: 16px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  margin: 0 3px;
  flex-shrink: 0;
`

const ToolBtn = styled.button<{ $active?: boolean; $danger?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  transition:
    background 120ms ease,
    color 120ms ease,
    border-color 120ms ease;
  flex-shrink: 0;

  ${({ $active, theme }) =>
    $active &&
    css`
      background: ${theme.colors.primary}18;
      border-color: ${theme.colors.primary}33;
    `}

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`

// ─── Editor area ──────────────────────────────────────────────────────────────

const EditorWrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.secondaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }

  /* TipTap reset + style */
  .ProseMirror {
    outline: none;
    font-size: 13px;
    line-height: 1.7;
    color: ${({ theme }) => theme.colors.textPrimary};
    min-height: 120px;

    p {
      margin: 0 0 8px;
    }
    p:last-child {
      margin-bottom: 0;
    }

    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 10px;
      letter-spacing: -0.02em;
    }
    h2 {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 8px;
      letter-spacing: -0.01em;
    }
    h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 6px;
    }

    strong {
      font-weight: 700;
    }
    em {
      font-style: italic;
    }
    u {
      text-decoration: underline;
    }
    s {
      text-decoration: line-through;
    }

    mark {
      background: ${({ theme }) => theme.colors.primary}33;
      color: ${({ theme }) => theme.colors.textPrimary};
      border-radius: 3px;
      padding: 0 2px;
    }

    a {
      color: ${({ theme }) => theme.colors.primary};
      text-decoration: underline;
      cursor: pointer;
    }

    ul {
      list-style: disc;
      padding-left: 20px;
      margin: 0 0 8px;
    }
    ol {
      list-style: decimal;
      padding-left: 20px;
      margin: 0 0 8px;
    }
    li {
      margin: 2px 0;
    }

    blockquote {
      border-left: 3px solid ${({ theme }) => theme.colors.primary}55;
      padding-left: 12px;
      margin: 8px 0;
      color: ${({ theme }) => theme.colors.textSecondary};
      font-style: italic;
    }

    hr {
      border: none;
      border-top: 1px solid ${({ theme }) => theme.colors.textSecondary};
      margin: 12px 0;
    }

    img {
      max-width: 100%;
      border-radius: 8px;
      margin: 4px 0;
    }

    /* Placeholder */
    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: ${({ theme }) => theme.colors.textSecondary};
      opacity: 0.4;
      pointer-events: none;
      height: 0;
    }

    /* text-align */
    [style*='text-align: center'] {
      text-align: center;
    }
    [style*='text-align: right'] {
      text-align: right;
    }
    [style*='text-align: left'] {
      text-align: left;
    }
  }
`

// ─── Emoji popover ────────────────────────────────────────────────────────────

const EmojiPopoverWrap = styled.div`
  position: relative;
`

const EmojiPopover = styled.div`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: ${({ theme }) => theme.zIndex.topmost};
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
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
    height: 340px;
    width: 340px;
  }
`

// ─── Footer meta ──────────────────────────────────────────────────────────────

const FooterMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 4px 12px 6px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground}55;
  flex-shrink: 0;
`

const CharCount = styled.span<{ $nearLimit: boolean }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  letter-spacing: 0.06em;
  color: ${({ $nearLimit, theme }) =>
    $nearLimit ? (theme.colors.error ?? '#f06449') : theme.colors.textSecondary};
  opacity: ${({ $nearLimit }) => ($nearLimit ? 1 : 0.4)};
`

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MailInputBoxProps {
  /** Called on every keystroke with the current markdown output */
  onChange?: (markdown: string) => void
  placeholder?: string
  disabled?: boolean
  /** Optionally pass a markdown-to-HTML converter if you need to seed initial content */
  initialContent?: string
}

// ─── Toolbar menu bar ─────────────────────────────────────────────────────────

interface MenuBarProps {
  editor: Editor
  onToggleEmoji: () => void
  emojiOpen: boolean
  onInsertImage: () => void
}

const MenuBar: React.FC<MenuBarProps> = ({ editor, onToggleEmoji, emojiOpen }) => {
  // const handleSetLink = (): void => {
  //   const prev = editor.getAttributes('link').href as string | undefined
  //   const url = window.prompt('Enter URL', prev ?? 'https://')
  //   if (url === null) return
  //   if (url === '') {
  //     editor.chain().focus().extendMarkRange('link').unsetLink().run()
  //     return
  //   }
  //   editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  // }

  return (
    <Toolbar>
      {/* Headings */}
      <ToolBtn
        $active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
        type="button"
      >
        <TextHOneIcon size={14} />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
        type="button"
      >
        <TextHTwoIcon size={14} />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
        type="button"
      >
        <TextHThreeIcon size={14} />
      </ToolBtn>

      <ToolDivider />

      {/* Inline marks */}
      <ToolBtn
        $active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
        type="button"
      >
        <TextBolderIcon size={14} weight="bold" />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
        type="button"
      >
        <TextItalicIcon size={14} />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
        type="button"
      >
        <TextUnderlineIcon size={14} />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
        type="button"
      >
        <TextStrikethroughIcon size={14} />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
        type="button"
      >
        <HighlighterIcon size={14} />
      </ToolBtn>

      {/* <ToolDivider />


      <ToolBtn
        $active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        title="Align Left"
        type="button"
      >
        <TextAlignLeftIcon size={14} />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        title="Align Center"
        type="button"
      >
        <TextAlignCenterIcon size={14} />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        title="Align Right"
        type="button"
      >
        <TextAlignRightIcon size={14} />
      </ToolBtn> */}

      <ToolDivider />

      {/* Lists */}
      <ToolBtn
        $active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
        type="button"
      >
        <ListBulletsIcon size={14} />
      </ToolBtn>
      <ToolBtn
        $active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered List"
        type="button"
      >
        <ListNumbersIcon size={14} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
        disabled={!editor.can().sinkListItem('listItem')}
        title="Indent"
        type="button"
      >
        <TextIndentIcon size={14} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().liftListItem('listItem').run()}
        disabled={!editor.can().liftListItem('listItem')}
        title="Outdent"
        type="button"
      >
        <TextOutdentIcon size={14} />
      </ToolBtn>

      <ToolDivider />

      {/* Blockquote + HR */}
      <ToolBtn
        $active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
        type="button"
      >
        <QuotesIcon size={14} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
        type="button"
      >
        <MinusIcon size={14} />
      </ToolBtn>

      {/* 
      <ToolDivider />


      <ToolBtn
        $active={editor.isActive('link')}
        onClick={handleSetLink}
        title="Insert / Edit Link"
        type="button"
      >
        <LinkIcon size={14} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
        title="Remove Link"
        type="button"
      >
        <LinkBreakIcon size={14} />
      </ToolBtn>


      <ToolBtn onClick={onInsertImage} title="Insert Image URL" type="button">
        <ImageIcon size={14} />
      </ToolBtn> */}

      <ToolDivider />

      {/* Emoji */}
      <EmojiPopoverWrap>
        <ToolBtn $active={emojiOpen} onClick={onToggleEmoji} title="Emoji" type="button">
          <SmileyIcon size={14} weight={emojiOpen ? 'fill' : 'regular'} />
        </ToolBtn>
      </EmojiPopoverWrap>
    </Toolbar>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const MailInputBox: React.FC<MailInputBoxProps> = ({
  onChange,
  placeholder = 'Write your message…',
  disabled = false,
  initialContent = ''
}) => {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const emojiPopoverRef = useRef<HTMLDivElement | null>(null)
  const emojiTriggerRef = useRef<HTMLDivElement | null>(null)
  const charCountRef = useRef(0)

  const editor = useEditor({
    extensions: [
      Markdown.configure({
        indentation: {
          style: 'tab', // 'space' or 'tab'
          size: 2 // Number of spaces or tabs
        },
        markedOptions: {
          gfm: true,
          pedantic: false
        }
      }),
      StarterKit.configure({
        bulletList: { HTMLAttributes: { class: 'mm-bullet-list' } },
        orderedList: { HTMLAttributes: { class: 'mm-ordered-list' } }
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Underline,
      Image,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https'
      }),
      Placeholder.configure({ placeholder })
    ],
    content: initialContent,
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      charCountRef.current = e.getText().length
      const markdown = e.getMarkdown()
      onChange?.(markdown)
    },
    immediatelyRender: false
  })

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiOpen) return
    const handleOutside = (e: MouseEvent): void => {
      if (
        emojiPopoverRef.current &&
        !emojiPopoverRef.current.contains(e.target as Node) &&
        emojiTriggerRef.current &&
        !emojiTriggerRef.current.contains(e.target as Node)
      ) {
        setEmojiOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [emojiOpen])

  const insertEmoji = useCallback(
    (emoji: { native: string }) => {
      if (!editor || !emoji.native) return
      editor.chain().focus().insertContent(emoji.native).run()
    },
    [editor]
  )

  const handleInsertImage = (): void => {
    if (!editor) return
    const url = window.prompt('Image URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const charCount = editor?.getText().length ?? 0
  const nearLimit = charCount > 8000

  if (!editor) return null

  return (
    <>
      <Root>
        <MenuBar
          editor={editor}
          onToggleEmoji={() => setEmojiOpen((v) => !v)}
          emojiOpen={emojiOpen}
          onInsertImage={handleInsertImage}
        />

        <EditorWrap data-private="lipsum">
          <EditorContent editor={editor} />
        </EditorWrap>

        <FooterMeta>
          <CharCount $nearLimit={nearLimit}>{charCount.toLocaleString()} chars</CharCount>
        </FooterMeta>
      </Root>
      {/* Emoji popover — rendered outside toolbar so it floats above editor */}
      {emojiOpen && (
        <div ref={emojiPopoverRef} style={{ position: 'relative' }}>
          <EmojiPopover data-private>
            <Picker
              data={data}
              theme="dark"
              set="native"
              previewPosition="none"
              skinTonePosition="none"
              onEmojiSelect={(emoji: { native: string }) => {
                insertEmoji(emoji)
                setEmojiOpen(false)
              }}
            />
          </EmojiPopover>
        </div>
      )}
    </>
  )
}

export { MailInputBox }
export default MailInputBox
