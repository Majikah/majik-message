import React, { useCallback, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { toast } from 'sonner'

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── MIME validation ──────────────────────────────────────────────────────────
/**
 * Full encryption allowlist — mirrors KNOWN_MIME_TYPES in
 * @majikah/majik-file/core/crypto/constants.ts
 *
 * Kept in-component so the UI can validate before even calling encryptFile().
 * Update both this set and constants.ts together when adding new formats.
 */
export const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/x-icon',
  'image/heic',
  'image/heif',
  'image/jxl',
  'image/vnd.adobe.photoshop',
  'image/x-xcf',
  'image/x-raw',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-sony-arw',
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-flv',
  'video/3gpp',
  'video/3gpp2',
  'video/mpeg',
  'video/x-ms-wmv',
  'video/mp2t',
  'video/x-m4v',
  // Audio
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/aac',
  'audio/flac',
  'audio/x-m4a',
  'audio/midi',
  'audio/x-midi',
  'audio/aiff',
  'audio/x-aiff',
  'audio/opus',
  'audio/amr',
  'audio/mp4',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/rtf',
  // Text / Code
  'text/plain',
  'text/html',
  'text/css',
  'text/csv',
  'text/xml',
  'text/markdown',
  'text/javascript',
  'application/javascript',
  'application/typescript',
  'application/json',
  'application/xml',
  'application/yaml',
  'text/yaml',
  'application/toml',
  'application/graphql',
  'text/x-python',
  'text/x-java-source',
  'text/x-c',
  'text/x-c++',
  'text/x-csharp',
  'text/x-go',
  'text/x-rust',
  'text/x-swift',
  'text/x-kotlin',
  'text/x-ruby',
  'text/x-php',
  'text/x-sh',
  'text/x-powershell',
  'application/x-httpd-php',
  'application/x-sql',
  'text/x-lua',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
  'application/x-xz',
  'application/x-lzip',
  'application/x-zstd',
  'application/vnd.rar',
  // Executables & Installers
  'application/x-msdownload',
  'application/vnd.microsoft.portable-executable',
  'application/x-msi',
  'application/x-apple-diskimage',
  'application/x-debian-package',
  'application/x-rpm',
  'application/x-sh',
  'application/x-executable',
  'application/octet-stream',
  // Fonts
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/font-woff',
  'application/vnd.ms-fontobject',
  // 3D & Design
  'model/gltf+json',
  'model/gltf-binary',
  'model/obj',
  'model/stl',
  'application/x-blender',
  'application/vnd.ms-3mfdocument',
  'application/x-fbx',
  // Adobe Creative Suite
  'application/postscript',
  'application/x-indesign',
  'video/x-adobe-premiere',
  'application/x-adobe-after-effects',
  'application/x-xd',
  // Design Tools
  'application/x-figma',
  'application/x-sketch',
  'application/x-affinity-designer',
  'application/x-affinity-photo',
  // IDE / Config
  'application/x-vsix',
  'application/x-ipynb+json',
  'text/x-dockerfile',
  'application/x-env',
  // Database
  'application/x-sqlite3',
  'application/vnd.sqlite3',
  // eBook
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',
  // Productivity
  'application/x-abiword',
  'application/vnd.visio',
  'application/x-iwork-pages-sffpages',
  'application/x-iwork-numbers-sffnumbers',
  'application/x-iwork-keynote-sffkey',
  // Crypto / Certificates
  'application/x-pem-file',
  'application/x-pkcs12',
  'application/pkix-cert',
  'application/x-x509-ca-cert'
])

const MJKB_MAGIC = new Uint8Array([0x4d, 0x4a, 0x4b, 0x42]) // "MJKB"

/** Sniff the first 4 bytes to check if a file is a .mjkb binary */
async function isMjkbFile(file: File): Promise<boolean> {
  try {
    const slice = await file.slice(0, 4).arrayBuffer()
    const bytes = new Uint8Array(slice)
    return MJKB_MAGIC.every((b, i) => bytes[i] === b)
  } catch {
    return false
  }
}

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Derive a reasonable MIME from file extension when browser reports empty */
function inferMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    ico: 'image/x-icon',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    ts: 'application/typescript',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    mp4: 'video/mp4',
    webm: 'video/webm',
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    '7z': 'application/x-7z-compressed',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    sqlite: 'application/x-sqlite3',
    db: 'application/x-sqlite3',
    pem: 'application/x-pem-file',
    p12: 'application/x-pkcs12',
    epub: 'application/epub+zip',
    fig: 'application/x-figma',
    sketch: 'application/x-sketch',
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json'
  }
  return map[ext] || 'application/octet-stream'
}

const FILE_ICONS: Record<string, string> = {
  'image/': '🖼️',
  'video/': '🎬',
  'audio/': '🎵',
  'text/': '📝',
  'application/pdf': '📄',
  'application/json': '📋',
  'application/zip': '🗜️',
  'application/x-7z-compressed': '🗜️',
  'application/x-tar': '🗜️',
  'application/gzip': '🗜️',
  'application/x-rar': '🗜️',
  'application/vnd.openxmlformats-officedocument.wordprocessingml': '📄',
  'application/vnd.openxmlformats-officedocument.spreadsheetml': '📊',
  'application/vnd.openxmlformats-officedocument.presentationml': '📊',
  'model/': '🧊',
  'application/x-sqlite3': '🗄️',
  'application/x-msdownload': '⚙️',
  'application/x-executable': '⚙️',
  'application/epub': '📚',
  'font/': '🔤',
  'application/octet-stream': '📦'
}

function getFileIcon(mime: string): string {
  for (const [prefix, ico] of Object.entries(FILE_ICONS)) {
    if (mime.startsWith(prefix)) return ico
  }
  return '📁'
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = 'encrypt' | 'decrypt'

interface FileState {
  file: File
  mime: string
  valid: boolean
  validationMsg?: string
}

interface ProcessStep {
  label: string
  done: boolean
  active: boolean
}

interface EncryptResult {
  binary: Blob
  originalName: string
  originalSize: number
  encryptedSize: number
  hash: string
}

interface DecryptResult {
  binary: Blob
  originalName: string
  originalSize: number
  mimeType: string
}

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
`

const progressSlide = keyframes`
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
`

// ─── Styled components ────────────────────────────────────────────────────────

const Root = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  color: ${({ theme }) => theme.colors.textPrimary};
`

const ContentHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 10px;
`

const ContentLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
`

const ModeSwitcher = styled.div`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 9px;
  padding: 3px;
  gap: 2px;
`

const ModePill = styled.button<{ $active: boolean; $mode: Mode }>`
  padding: 5px 16px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  border: none;
  transition:
    background 150ms ease,
    color 150ms ease;

  ${({ $active, $mode, theme }) =>
    $active
      ? $mode === 'encrypt'
        ? css`
            background: ${theme.colors.primary};
            color: ${theme.colors.primaryBackground};
          `
        : css`
            background: ${theme.colors.brand.green};
            color: ${theme.colors.primaryBackground};
          `
      : css`
          background: transparent;
          color: ${theme.colors.textSecondary};
          &:hover {
            color: ${theme.colors.textPrimary};
          }
        `}
`

const EditorGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  animation: ${fadeIn} 180ms cubic-bezier(0.4, 0, 0.2, 1) both;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const EditorPane = styled.div<{ $accent?: Mode | 'error' | null }>`
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid
    ${({ $accent, theme }) => {
      if ($accent === 'encrypt') return theme.colors.primary
      if ($accent === 'decrypt') return theme.colors.brand.green
      if ($accent === 'error') return '#ef4444'
      return theme.colors.primaryBackground
    }};
  transition: border-color 200ms ease;
`

const PaneHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primarySoft};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`

const PaneLabel = styled.span<{ $mode?: Mode | null }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ $mode, theme }) => {
    if ($mode === 'encrypt') return theme.colors.primary
    if ($mode === 'decrypt') return theme.colors.brand?.green ?? '#86b910'
    return theme.colors.textSecondary
  }};
  opacity: ${({ $mode }) => ($mode ? 0.8 : 0.4)};
  transition:
    color 200ms ease,
    opacity 200ms ease;
`

const PaneStatusBadge = styled.span<{ $variant: 'encrypt' | 'decrypt' | 'ready' | 'error' | null }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: 1px solid transparent;
  transition: all 200ms ease;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'encrypt':
        return css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border-color: ${theme.colors.primary};
        `
      case 'decrypt':
        return css`
          background: rgba(134, 185, 16, 0.1);
          color: ${theme.colors.brand.green};
          border-color: ${theme.colors.brand.green};
        `
      case 'ready':
        return css`
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.25);
        `
      case 'error':
        return css`
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          border-color: #ef4444;
        `
      default:
        return css`
          background: rgba(255, 255, 255, 0.04);
          color: ${theme.colors.textSecondary};
          border-color: ${theme.colors.primaryBackground};
          opacity: 0.45;
        `
    }
  }}
`

// ─── Progress bar ──────────────────────────────────────────────────────────────

const ProgressBarWrap = styled.div`
  height: 2px;
  width: 100%;
  background: ${({ theme }) => theme.colors.primarySoft};
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
`

const ProgressBarFill = styled.div<{ $progress: number; $mode: Mode }>`
  height: 100%;
  border-radius: 1px;
  width: ${({ $progress }) => $progress}%;
  background: ${({ $mode, theme }) =>
    $mode === 'encrypt'
      ? `linear-gradient(90deg, ${theme.colors.primary}, #818cf8)`
      : `linear-gradient(90deg, ${theme.colors.brand.green}, #bef264)`};
  transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Shimmer while indeterminate */
  ${({ $progress }) =>
    $progress < 100 &&
    css`
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.15) 50%,
          transparent 100%
        );
        animation: ${progressSlide} 1.4s ease infinite;
      }
    `}
`

// ─── Drop zone ────────────────────────────────────────────────────────────────

const DropZone = styled.div<{
  $hasFile: boolean
  $isDragging: boolean
  $mode: Mode
  $isValid?: boolean
}>`
  flex: 1;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: ${({ $hasFile }) => ($hasFile ? 'stretch' : 'center')};
  justify-content: ${({ $hasFile }) => ($hasFile ? 'flex-start' : 'center')};
  gap: 14px;
  padding: ${({ $hasFile }) => ($hasFile ? '14px' : '28px 20px')};
  cursor: pointer;
  background: ${({ $isDragging, $mode, $hasFile, $isValid }) => {
    if ($isValid === false && $hasFile) return 'rgba(239, 68, 68, 0.03)'
    if ($isDragging)
      return $mode === 'encrypt' ? 'rgba(99, 102, 241, 0.07)' : 'rgba(134, 185, 16, 0.07)'
    return 'transparent'
  }};
  transition: background 150ms ease;

  &:hover {
    background: ${({ $mode, $hasFile, $isValid }) => {
      if ($isValid === false && $hasFile) return 'rgba(239, 68, 68, 0.04)'
      return $mode === 'encrypt' ? 'rgba(99, 102, 241, 0.03)' : 'rgba(134, 185, 16, 0.03)'
    }};
  }
`

const DropIconWrap = styled.div<{ $mode: Mode }>`
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  border: 1.5px dashed;
  transition: all 200ms ease;
  border-color: ${({ $mode }) =>
    $mode === 'encrypt' ? 'rgba(99, 102, 241, 0.35)' : 'rgba(134, 185, 16, 0.35)'};
  color: ${({ $mode, theme }) =>
    $mode === 'encrypt' ? theme.colors.primary : theme.colors.brand.green};
  background: ${({ $mode, theme }) =>
    $mode === 'encrypt' ? theme.colors.primarySoft : 'rgba(134, 185, 16, 0.1)'};
`

const DropTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
`

const DropSub = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  text-align: center;
  line-height: 1.55;
`

// ─── File card ────────────────────────────────────────────────────────────────

const FileCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`

const FileRow = styled.div<{ $invalid?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid
    ${({ $invalid }) => ($invalid ? 'rgba(239, 68, 68, 0.3)' : 'var(--border, #1c1c22)')};
  border-radius: 8px;
  transition: border-color 200ms ease;
`

const FileLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

const FileIconEmoji = styled.div`
  font-size: 20px;
  flex-shrink: 0;
`

const FileMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`

const FileName = styled.div`
  font-family: ${FONT_MONO};
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  color: ${({ theme }) => theme.colors.textPrimary};
`

const FileSize = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  letter-spacing: 0.03em;
`

const FileClearBtn = styled.button`
  font-family: ${FONT_MONO};
  font-size: 10px;
  padding: 2px 9px;
  border-radius: 5px;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  flex-shrink: 0;
  transition: all 100ms ease;

  &:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }
`

const MimeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`

const MimeChip = styled.span<{ $variant: 'source' | 'valid' | 'invalid' | 'neutral' | 'mjkb' }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'source':
        return css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border-color: rgba(99, 102, 241, 0.2);
        `
      case 'valid':
        return css`
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.2);
        `
      case 'invalid':
        return css`
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
        `
      case 'mjkb':
        return css`
          background: rgba(134, 185, 16, 0.1);
          color: ${theme.colors.brand.green};
          border-color: rgba(134, 185, 16, 0.2);
        `
      default:
        return css`
          background: rgba(255, 255, 255, 0.04);
          color: ${theme.colors.textSecondary};
          border-color: ${theme.colors.primaryBackground};
        `
    }
  }}
`

const ErrorBar = styled.div`
  padding: 9px 11px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: #ef4444;
  line-height: 1.55;
`

// ─── Output area ──────────────────────────────────────────────────────────────

const OutputArea = styled.div<{ $hasResult: boolean }>`
  flex: 1;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: ${({ $hasResult }) => ($hasResult ? 'stretch' : 'center')};
  justify-content: ${({ $hasResult }) => ($hasResult ? 'flex-start' : 'center')};
  padding: ${({ $hasResult }) => ($hasResult ? '14px' : '20px 16px')};
  gap: ${({ $hasResult }) => ($hasResult ? '6px' : '14px')};
`

const WaitingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  opacity: 0.3;
`

const WaitingIcon = styled.div`
  font-size: 34px;
`

const WaitingText = styled.div`
  font-family: ${FONT_MONO};
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
`

const ProcessStepsWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 4px;
`

const ProcessLabel = styled.div`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  animation: ${pulse} 1.6s ease infinite;
`

const ProcessSteps = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`

const ResultCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const ResultRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 7px;
`

const ResultLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
`

const ResultValue = styled.span<{ $accent?: Mode | 'neutral' }>`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
  color: ${({ $accent, theme }) => {
    if ($accent === 'encrypt') return theme.colors.primary
    if ($accent === 'decrypt') return theme.colors.brand.green
    return theme.colors.textPrimary
  }};
`

// ─── Pane footer / buttons ────────────────────────────────────────────────────

const PaneFooter = styled.div`
  display: flex;
  gap: 5px;
  padding: 7px 10px;
  border-top: 1px solid ${({ theme }) => theme.colors.primarySoft};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`

const PaneBtn = styled.button<{ $variant?: 'encrypt' | 'decrypt' }>`
  flex: 1;
  padding: 6px 0;
  border-radius: 7px;
  font-family: ${FONT_MONO};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: all 100ms ease;

  ${({ $variant, theme }) =>
    $variant === 'encrypt'
      ? css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border-color: rgba(99, 102, 241, 0.25);
          &:hover {
            background: ${theme.colors.primary};
            color: ${theme.colors.primaryBackground};
          }
        `
      : $variant === 'decrypt'
        ? css`
            background: rgba(134, 185, 16, 0.1);
            color: ${theme.colors.brand.green};
            border-color: rgba(134, 185, 16, 0.25);
            &:hover {
              background: ${theme.colors.brand.green};
              color: ${theme.colors.primaryBackground};
            }
          `
        : css`
            background: transparent;
            color: ${theme.colors.textSecondary};
            border-color: ${theme.colors.primaryBackground};
            &:hover {
              background: ${theme.colors.primaryBackground};
              color: ${theme.colors.textPrimary};
              border-color: ${theme.colors.secondaryBackground};
            }
          `}

  &:active {
    opacity: 0.75;
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }
`

// ─── Stats row ────────────────────────────────────────────────────────────────

const StatsRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 2px;
`

const StatChip = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
`

const StatLabel = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`

const StatValue = styled.div<{ $accent?: Mode | 'neutral' }>`
  font-family: ${FONT_MONO};
  font-size: 11px;
  font-weight: 600;
  color: ${({ $accent, theme }) => {
    if ($accent === 'encrypt') return theme.colors.primary
    if ($accent === 'decrypt') return theme.colors.brand.green
    return theme.colors.textPrimary
  }};
`

// ─── Props ────────────────────────────────────────────────────────────────────
export interface FileVaultProps {
  onEncrypt: (file: File, mimeType: string) => Promise<EncryptResult>
  onDecrypt: (file: File) => Promise<DecryptResult>
  onModeChange?: (mode: Mode) => void
  externalRefreshKey?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

const FileVault: React.FC<FileVaultProps> = ({ onEncrypt, onDecrypt, onModeChange }) => {
  const [mode, setMode] = useState<Mode>('encrypt')

  // File input state
  const [inputFile, setInputFile] = useState<FileState | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState<ProcessStep[]>([])

  // Result state
  const [encryptResult, setEncryptResult] = useState<EncryptResult | null>(null)
  const [decryptResult, setDecryptResult] = useState<DecryptResult | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const resetOutput = (): void => {
    setEncryptResult(null)
    setDecryptResult(null)
    setResultBlob(null)
    setProgress(0)
    setSteps([])
  }

  const handleSetMode = (next: Mode): void => {
    if (next === mode) return
    setMode(next)
    setInputFile(null)
    resetOutput()
    onModeChange?.(next)
  }

  // ── File validation ──────────────────────────────────────────────────────────

  const validateEncryptFile = (file: File): { valid: boolean; mime: string; msg?: string } => {
    const mime = file.type || inferMimeFromName(file.name)
    const allowed = ALLOWED_MIME_TYPES.has(mime)
    if (!allowed) {
      return {
        valid: false,
        mime,
        msg: `File type "${mime}" is not in the allowed format list. Please select a supported file type.`
      }
    }
    return { valid: true, mime }
  }

  const acceptEncryptFile = async (file: File): Promise<void> => {
    const { valid, mime, msg } = validateEncryptFile(file)
    setInputFile({ file, mime, valid, validationMsg: msg })
    resetOutput()
  }

  const acceptDecryptFile = async (file: File): Promise<void> => {
    const valid = file.name.endsWith('.mjkb') || (await isMjkbFile(file))
    const mime = 'application/octet-stream'
    setInputFile({
      file,
      mime,
      valid,
      validationMsg: valid
        ? undefined
        : "This file is not a valid .mjkb binary. The magic bytes don't match — it may be corrupted or not encrypted with Majik File."
    })
    resetOutput()
  }

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    mode === 'encrypt' ? await acceptEncryptFile(file) : await acceptDecryptFile(file)
  }

  const handleBrowse = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    mode === 'encrypt' ? await acceptEncryptFile(file) : await acceptDecryptFile(file)
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClearInput = (): void => {
    setInputFile(null)
    resetOutput()
  }

  // ── Encrypt ──────────────────────────────────────────────────────────────────

  const handleEncrypt = async (): Promise<void> => {
    if (!inputFile?.valid || !inputFile.file) return

    setIsProcessing(true)
    setProgress(10)
    setSteps([
      { label: '① Hash', done: false, active: true },
      { label: '② Compress', done: false, active: false },
      { label: '③ ML-KEM encapsulate', done: false, active: false },
      { label: '④ AES-GCM encrypt', done: false, active: false }
    ])

    try {
      // Simulate step progression while the real work happens
      const tick = (p: number, stepIdx: number): void => {
        setProgress(p)
        setSteps((prev) =>
          prev.map((s, i) => ({
            ...s,
            done: i < stepIdx,
            active: i === stepIdx
          }))
        )
      }

      tick(25, 1)
      const result = await onEncrypt(inputFile.file, inputFile.mime)
      tick(80, 2)
      await new Promise((r) => setTimeout(r, 120)) // let the UI update
      tick(95, 3)
      await new Promise((r) => setTimeout(r, 80))

      setProgress(100)
      setSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })))
      setEncryptResult(result)
      setResultBlob(result.binary)

      toast.success('File encrypted', {
        description: `${inputFile.file.name} → .mjkb (${formatBytes(result.encryptedSize)})`,
        id: 'toast-encrypt-success'
      })
    } catch (err) {
      toast.error('Encryption failed', {
        description: err instanceof Error ? err.message : String(err),
        id: 'toast-encrypt-error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Decrypt ──────────────────────────────────────────────────────────────────

  const handleDecrypt = async (): Promise<void> => {
    if (!inputFile?.valid || !inputFile.file) return

    setIsProcessing(true)
    setProgress(15)
    setSteps([
      { label: '① Parse .mjkb', done: false, active: true },
      { label: '② ML-KEM decapsulate', done: false, active: false },
      { label: '③ AES-GCM decrypt', done: false, active: false },
      { label: '④ Decompress', done: false, active: false }
    ])

    try {
      const tick = (p: number, stepIdx: number): void => {
        setProgress(p)
        setSteps((prev) =>
          prev.map((s, i) => ({
            ...s,
            done: i < stepIdx,
            active: i === stepIdx
          }))
        )
      }

      tick(30, 1)
      const result = await onDecrypt(inputFile.file)
      tick(75, 2)
      await new Promise((r) => setTimeout(r, 100))
      tick(92, 3)
      await new Promise((r) => setTimeout(r, 80))

      setProgress(100)
      setSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })))
      setDecryptResult(result)
      setResultBlob(result.binary)

      toast.success('File decrypted', {
        description: `Recovered: ${result.originalName} (${formatBytes(result.originalSize)})`,
        id: 'toast-decrypt-success'
      })
    } catch (err) {
      toast.error('Decryption failed', {
        description: err instanceof Error ? err.message : String(err),
        id: 'toast-decrypt-error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Download ─────────────────────────────────────────────────────────────────

  const handleDownload = useCallback((): void => {
    if (!resultBlob) return

    let filename: string
    let type: string

    if (mode === 'encrypt' && encryptResult) {
      filename = `${encryptResult.originalName.replace(/\.[^.]+$/, '')}_${encryptResult.hash.slice(0, 8)}.mjkb`
      type = 'application/octet-stream'
    } else if (mode === 'decrypt' && decryptResult) {
      filename = decryptResult.originalName
      type = decryptResult.mimeType
    } else {
      return
    }

    const url = URL.createObjectURL(new Blob([resultBlob], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Download started', {
      description: filename,
      id: 'toast-download'
    })
  }, [mode, resultBlob, encryptResult, decryptResult])

  // ── Derived state ─────────────────────────────────────────────────────────────

  const hasValidInput = !!inputFile?.valid
  const hasResult = mode === 'encrypt' ? !!encryptResult : !!decryptResult
  const inputAccent = !inputFile ? mode : inputFile.valid ? mode : 'error'

  const outputBadgeVariant = isProcessing ? mode : hasResult ? 'ready' : null

  const compressionRatio =
    encryptResult && encryptResult.originalSize > 0
      ? Math.round((1 - encryptResult.encryptedSize / encryptResult.originalSize) * 100)
      : null

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Root>
      {/* ── Content header ── */}
      <ContentHeader>
        <ContentLabel>File Content</ContentLabel>
        <ModeSwitcher>
          <ModePill
            $active={mode === 'encrypt'}
            $mode="encrypt"
            onClick={() => handleSetMode('encrypt')}
          >
            Encrypt
          </ModePill>
          <ModePill
            $active={mode === 'decrypt'}
            $mode="decrypt"
            onClick={() => handleSetMode('decrypt')}
          >
            Decrypt
          </ModePill>
        </ModeSwitcher>
      </ContentHeader>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={mode === 'decrypt' ? '.mjkb' : undefined}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <EditorGrid>
        <EditorPane $accent={inputAccent}>
          <PaneHeader>
            <PaneLabel $mode={inputFile?.valid ? mode : null}>
              {mode === 'encrypt' ? 'Source File' : 'Source .mjkb'}
            </PaneLabel>
            <PaneStatusBadge $variant={!inputFile ? null : inputFile.valid ? mode : 'error'}>
              {!inputFile ? 'No File' : inputFile.valid ? 'Ready' : 'Invalid'}
            </PaneStatusBadge>
          </PaneHeader>

          <DropZone
            $hasFile={!!inputFile}
            $isDragging={isDragging}
            $mode={mode}
            $isValid={inputFile?.valid}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={handleBrowse}
          >
            {!inputFile ? (
              // ── Empty state ──
              <>
                <DropIconWrap $mode={mode}>{mode === 'encrypt' ? '📁' : '🔑'}</DropIconWrap>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}
                >
                  <DropTitle>
                    {mode === 'encrypt'
                      ? 'Drop a file or click to browse'
                      : 'Drop a .mjkb file or click to browse'}
                  </DropTitle>
                  <DropSub>
                    {mode === 'encrypt'
                      ? '130+ formats — images, video, audio, documents,\ncode, archives, executables, 3D & more'
                      : 'Only accepts encrypted Majik File binaries\n(.mjkb format only)'}
                  </DropSub>
                </div>
              </>
            ) : (
              // ── File selected ──
              <FileCard onClick={(e) => e.stopPropagation()}>
                <FileRow $invalid={!inputFile.valid}>
                  <FileLeft>
                    <FileIconEmoji>{getFileIcon(inputFile.mime)}</FileIconEmoji>
                    <FileMeta>
                      <FileName>{inputFile.file.name}</FileName>
                      <FileSize>
                        {formatBytes(inputFile.file.size)} · {inputFile.mime}
                      </FileSize>
                    </FileMeta>
                  </FileLeft>
                  <FileClearBtn onClick={handleClearInput}>✕ Remove</FileClearBtn>
                </FileRow>

                {inputFile.valid ? (
                  <MimeRow>
                    <MimeChip $variant="neutral">Format</MimeChip>
                    <MimeChip $variant={mode === 'encrypt' ? 'source' : 'mjkb'}>
                      {inputFile.mime}
                    </MimeChip>
                    <MimeChip $variant="valid">
                      ✓ {mode === 'decrypt' ? 'Valid .mjkb' : 'Allowed'}
                    </MimeChip>
                  </MimeRow>
                ) : (
                  <ErrorBar>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                    <span>{inputFile.validationMsg}</span>
                  </ErrorBar>
                )}
              </FileCard>
            )}
          </DropZone>

          <PaneFooter>
            <PaneBtn onClick={handleBrowse}>
              {mode === 'encrypt' ? 'Browse File' : 'Browse .mjkb'}
            </PaneBtn>
            <PaneBtn onClick={handleClearInput} disabled={!inputFile}>
              Clear
            </PaneBtn>
          </PaneFooter>
        </EditorPane>
        {/* ── OUTPUT PANE ── */}
        <EditorPane $accent={hasResult ? mode : null}>
          <PaneHeader>
            <PaneLabel $mode={hasResult ? mode : null}>
              {mode === 'encrypt' ? 'Encrypted Output' : 'Decrypted File'}
            </PaneLabel>
            <PaneStatusBadge $variant={outputBadgeVariant}>
              {isProcessing ? 'Processing…' : hasResult ? 'Ready' : 'Waiting'}
            </PaneStatusBadge>
          </PaneHeader>

          {/* Progress bar */}
          {isProcessing && (
            <ProgressBarWrap>
              <ProgressBarFill $progress={progress} $mode={mode} />
            </ProgressBarWrap>
          )}

          <OutputArea $hasResult={isProcessing || hasResult}>
            {!isProcessing && !hasResult && (
              <WaitingState>
                <WaitingIcon>{mode === 'encrypt' ? '📦' : '🔑'}</WaitingIcon>
                <WaitingText>
                  {mode === 'encrypt' ? 'Select a file to encrypt' : 'Upload a .mjkb to decrypt'}
                </WaitingText>
              </WaitingState>
            )}

            {isProcessing && (
              <ProcessStepsWrap>
                <ProcessLabel>{mode === 'encrypt' ? 'Encrypting…' : 'Decrypting…'}</ProcessLabel>
                <ProcessSteps>
                  {steps.map((step) => (
                    <MimeChip
                      key={step.label}
                      $variant={step.done ? 'valid' : step.active ? 'source' : 'neutral'}
                    >
                      {step.done ? `✓ ${step.label}` : step.label}
                    </MimeChip>
                  ))}
                </ProcessSteps>
              </ProcessStepsWrap>
            )}

            {!isProcessing && mode === 'encrypt' && encryptResult && (
              <ResultCard>
                <ResultRow>
                  <ResultLabel>Output file</ResultLabel>
                  <ResultValue $accent="encrypt">
                    {encryptResult.originalName.replace(/\.[^.]+$/, '')}_
                    {encryptResult.hash.slice(0, 8)}.mjkb
                  </ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Cipher</ResultLabel>
                  <ResultValue $accent="neutral">ML-KEM-768 + AES-256-GCM</ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Original size</ResultLabel>
                  <ResultValue $accent="neutral">
                    {formatBytes(encryptResult.originalSize)}
                  </ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Encrypted size</ResultLabel>
                  <ResultValue $accent="encrypt">
                    {formatBytes(encryptResult.encryptedSize)}
                  </ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>SHA-256</ResultLabel>
                  <ResultValue $accent="neutral" style={{ fontSize: 9, letterSpacing: '0.03em' }}>
                    {encryptResult.hash.slice(0, 24)}…
                  </ResultValue>
                </ResultRow>
              </ResultCard>
            )}

            {!isProcessing && mode === 'decrypt' && decryptResult && (
              <ResultCard>
                <ResultRow>
                  <ResultLabel>Recovered file</ResultLabel>
                  <ResultValue $accent="decrypt">{decryptResult.originalName}</ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>MIME type</ResultLabel>
                  <ResultValue $accent="neutral">{decryptResult.mimeType}</ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Original size</ResultLabel>
                  <ResultValue $accent="decrypt">
                    {formatBytes(decryptResult.originalSize)}
                  </ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Verified</ResultLabel>
                  <ResultValue $accent="decrypt">✓ ML-KEM-768 match</ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Decompressed</ResultLabel>
                  <ResultValue $accent="neutral">Zstd lv.22</ResultValue>
                </ResultRow>
              </ResultCard>
            )}
          </OutputArea>

          <PaneFooter>
            <PaneBtn
              $variant={hasValidInput && !isProcessing ? mode : undefined}
              disabled={!hasValidInput || isProcessing}
              onClick={mode === 'encrypt' ? handleEncrypt : handleDecrypt}
            >
              {hasResult
                ? mode === 'encrypt'
                  ? 'Re-encrypt'
                  : 'Decrypt Again'
                : mode === 'encrypt'
                  ? 'Encrypt'
                  : 'Decrypt'}
            </PaneBtn>
            <PaneBtn
              $variant={hasResult ? mode : undefined}
              disabled={!hasResult || isProcessing}
              onClick={handleDownload}
            >
              {mode === 'encrypt' ? 'Download .mjkb' : 'Download File'}
            </PaneBtn>
          </PaneFooter>
        </EditorPane>
      </EditorGrid>

      {/* ── Stats row (shown after success) ── */}
      {hasResult && !isProcessing && (
        <StatsRow>
          <StatChip>
            <StatLabel>Original</StatLabel>
            <StatValue $accent="neutral">
              {mode === 'encrypt'
                ? formatBytes(encryptResult!.originalSize)
                : formatBytes(inputFile?.file.size ?? 0)}
            </StatValue>
          </StatChip>
          <StatChip>
            <StatLabel>Output</StatLabel>
            <StatValue $accent={mode}>
              {mode === 'encrypt'
                ? formatBytes(encryptResult!.encryptedSize)
                : formatBytes(decryptResult!.originalSize)}
            </StatValue>
          </StatChip>
          <StatChip>
            <StatLabel>Ratio</StatLabel>
            <StatValue $accent="neutral">
              {mode === 'encrypt' && compressionRatio !== null
                ? compressionRatio > 0
                  ? `${compressionRatio}% smaller`
                  : `${Math.abs(compressionRatio)}% larger`
                : mode === 'decrypt'
                  ? 'Restored'
                  : '—'}
            </StatValue>
          </StatChip>
          <StatChip>
            <StatLabel>Cipher</StatLabel>
            <StatValue $accent={mode}>{mode === 'encrypt' ? 'ML-KEM-768' : '✓ Verified'}</StatValue>
          </StatChip>
        </StatsRow>
      )}
    </Root>
  )
}

export default FileVault
