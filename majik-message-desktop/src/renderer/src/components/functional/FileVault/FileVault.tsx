import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { toast } from 'sonner'
import { CubeIcon, FolderIcon, KeyIcon } from '@phosphor-icons/react'
import { MajikFileScanner } from '@/SDK/majik-file-scanner/majik-file-scanner'
import type { FileScanResult } from '@/SDK/majik-file-scanner/majik-file-scanner'
import { MajikFile, MJKB_MAGIC } from '@majikah/majik-file'
import type {
  DecryptResult,
  DecryptSignatureStatus,
  EncryptResult,
  SignerInfo
} from '../../panels/_types'
import EncryptSignerPanel from './EncryptSignerPanel'
import {
  ALLOWED_MIME_TYPES,
  FILE_ICONS,
  RISK_BAND_BG,
  RISK_BAND_COLOR,
  RISK_BAND_LABEL
} from './_contants'
import DecryptSignaturePanel from './DecryptSignaturePanel'
import ScanResultBar from './ScanResultBar'

type CompressionLevel =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22

// ─── Compression Preset ───────────────────────────────────────────────────────

const CompressionPreset = {
  FASTEST: 2 as CompressionLevel,
  FAST: 3 as CompressionLevel,
  BALANCED: 6 as CompressionLevel,
  GOOD: 9 as CompressionLevel,
  BETTER: 15 as CompressionLevel,
  BEST: 19 as CompressionLevel,
  ULTRA: 22 as CompressionLevel
} as const

type CompressionPresetKey = keyof typeof CompressionPreset

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── Compression preset metadata ─────────────────────────────────────────────

/**
 * Display metadata for each CompressionPreset entry.
 * label    — short pill text
 * hint     — tooltip / sub-label shown below the pill row
 * level    — the numeric Zstd level for display purposes
 */
const PRESET_META: Record<CompressionPresetKey, { label: string; hint: string; level: number }> = {
  FASTEST: {
    label: 'Fastest',
    hint: 'Lv 2 · Speed-first, minimal CPU',
    level: 2
  },
  FAST: { label: 'Fast', hint: 'Lv 3 · Zstd default fast mode', level: 3 },
  BALANCED: {
    label: 'Balanced',
    hint: 'Lv 6 · Best ratio-per-ms inflection point',
    level: 6
  },
  GOOD: {
    label: 'Good',
    hint: 'Lv 9 · Recommended for most uploads',
    level: 9
  },
  BETTER: {
    label: 'Better',
    hint: 'Lv 15 · High-effort, documents & code',
    level: 15
  },
  BEST: { label: 'Best', hint: 'Lv 19 · Near-maximum, WASM-safe', level: 19 },
  ULTRA: {
    label: 'Ultra',
    hint: 'Lv 22 · Archival; auto-clamped on large files',
    level: 22
  }
}

// Ordered left-to-right for the pill row
const PRESET_ORDER: CompressionPresetKey[] = [
  'FASTEST',
  'FAST',
  'BALANCED',
  'GOOD',
  'BETTER',
  'BEST',
  'ULTRA'
]

/**
 * Mirrors MajikCompressor.adaptiveLevel() thresholds so we can display the
 * effective level after adaptive clamping WITHOUT importing the WASM module.
 *
 * Kept in sync with the thresholds in majik-compressor.ts.
 */
function resolveAdaptiveLevel(
  fileSizeBytes: number,
  desiredPreset: CompressionPresetKey
): { effective: number; wasClamped: boolean } {
  const desired = CompressionPreset[desiredPreset] as number
  const thresholds: { minBytes: number; maxLevel: number }[] = [
    { minBytes: 500 * 1024 * 1024, maxLevel: 6 },
    { minBytes: 100 * 1024 * 1024, maxLevel: 12 },
    { minBytes: 50 * 1024 * 1024, maxLevel: 16 },
    { minBytes: 10 * 1024 * 1024, maxLevel: 19 }
  ]
  for (const { minBytes, maxLevel } of thresholds) {
    if (fileSizeBytes > minBytes) {
      const effective = Math.min(desired, maxLevel)
      return { effective, wasClamped: effective < desired }
    }
  }
  return { effective: desired, wasClamped: false }
}

async function isMjkbFile(file: File): Promise<boolean> {
  try {
    const slice = await file.slice(0, 4).arrayBuffer()
    const bytes = new Uint8Array(slice)
    return MJKB_MAGIC.every((b, i) => bytes[i] === b)
  } catch {
    return false
  }
}

/**
 * Full structural validation of a File as a .mjkb binary.
 * Reads the entire file and delegates to MajikFile.isValidMJKB().
 * Falls back to the cheap magic-byte check on read error.
 */
async function isFullyValidMjkbFile(file: File): Promise<boolean> {
  try {
    const buffer = await file.arrayBuffer()
    return MajikFile.isValidMJKB(buffer)
  } catch {
    // Fallback to magic-byte check if we can't read the file
    return isMjkbFile(file)
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

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

function getFileIcon(mime: string): string {
  for (const [prefix, ico] of Object.entries(FILE_ICONS)) {
    if (mime.startsWith(prefix)) return ico
  }
  return '📁'
}

// ─── Scanner singleton ────────────────────────────────────────────────────────
const scanner = new MajikFileScanner({
  allowedMimeTypes: [...ALLOWED_MIME_TYPES]
})
let scannerReady = false

async function ensureScanner(): Promise<void> {
  if (!scannerReady) {
    await scanner.initialize()
    scannerReady = true
  }
}

type ScanPhase = 'idle' | 'scanning' | 'clean' | 'flagged' | 'error'

function scanPhaseIcon(phase: ScanPhase): string {
  switch (phase) {
    case 'scanning':
      return '◈'
    case 'clean':
      return '✓'
    case 'flagged':
      return '⚠'
    case 'error':
      return '~'
    default:
      return ''
  }
}

function scanPhaseLabel(phase: ScanPhase): string {
  switch (phase) {
    case 'scanning':
      return 'Scanning…'
    case 'clean':
      return 'Scan clean'
    case 'flagged':
      return 'Threat detected'
    case 'error':
      return 'Scan inconclusive'
    default:
      return ''
  }
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

const scannerPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
`

// ─── Styled components ────────────────────────────────────────────────────────

const Root = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
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

const EditorPane = styled.div<{ $accent?: Mode | 'error' | 'flagged' | null }>`
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid
    ${({ $accent, theme }) => {
      if ($accent === 'encrypt') return theme.colors.primary
      if ($accent === 'decrypt') return theme.colors.brand.green
      if ($accent === 'error') return '#ef4444'
      if ($accent === 'flagged') return '#ef4444'
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

const PaneHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
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

const ScanPhaseBadge = styled.span<{ $phase: ScanPhase }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid transparent;
  flex-shrink: 0;
  transition: all 200ms ease;

  ${({ $phase }) => {
    switch ($phase) {
      case 'scanning':
        return css`
          background: rgba(251, 191, 36, 0.1);
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.25);
          animation: ${scannerPulse} 1.1s ease infinite;
        `
      case 'clean':
        return css`
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.2);
        `
      case 'flagged':
        return css`
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
        `
      case 'error':
        return css`
          background: rgba(251, 191, 36, 0.07);
          color: #f59e0b;
          border-color: rgba(251, 191, 36, 0.2);
        `
      default:
        return css`
          display: none;
        `
    }
  }}
`

const PaneStatusBadge = styled.span<{
  $variant: 'encrypt' | 'decrypt' | 'ready' | 'error' | null
}>`
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

// ─── Compression selector ─────────────────────────────────────────────────────

const CompressionWrap = styled.div`
  flex-shrink: 0;
  padding: 9px 13px 10px;
  border-top: 1px solid ${({ theme }) => theme.colors.primarySoft};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: ${fadeIn} 160ms cubic-bezier(0.4, 0, 0.2, 1) both;
`

const CompressionHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const CompressionLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
`

const CompressionHint = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`

// The pill row — same visual language as the mode switcher
const CompressionPillRow = styled.div`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 9px;
  padding: 3px;
  gap: 2px;
  overflow-x: auto;

  /* Hide scrollbar but keep scrollability on small viewports */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`

const CompressionPill = styled.button<{
  $active: boolean
  $presetKey: CompressionPresetKey
}>`
  flex-shrink: 0;
  padding: 4px 11px;
  border-radius: 7px;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  border: 1px solid transparent;
  white-space: nowrap;
  transition:
    background 150ms ease,
    color 150ms ease,
    opacity 150ms ease;

  ${({ $active, $presetKey, theme }) => {
    // Ultra gets a warning tint since it can be auto-clamped
    if ($active && $presetKey === 'ULTRA') {
      return css`
        background: rgba(245, 158, 11, 0.2);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.35);
      `
    }
    if ($active) {
      return css`
        background: ${theme.colors.primary};
        color: ${theme.colors.primaryBackground};
      `
    }
    return css`
      background: transparent;
      color: ${theme.colors.textSecondary};
      opacity: 0.7;
      &:hover {
        color: ${theme.colors.textPrimary};
        opacity: 1;
      }
    `
  }}
`

// Adaptive clamp notice — shown when the selected preset will be downgraded
const ClampNotice = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid rgba(245, 158, 11, 0.18);
  border-radius: 6px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: #f59e0b;
  line-height: 1.5;
  animation: ${fadeIn} 150ms ease both;
`

// ─── Progress bar ─────────────────────────────────────────────────────────────

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

const MimeChip = styled.span<{
  $variant: 'source' | 'valid' | 'invalid' | 'neutral' | 'mjkb'
}>`
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

// ─── Nested .mjkb warning banner ──────────────────────────────────────────────

const NestedMjkbBanner = styled.div`
  margin: 0 14px 10px;
  padding: 9px 11px;
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: #f59e0b;
  line-height: 1.55;
  animation: ${fadeIn} 180ms ease both;
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

const ResultValue = styled.span<{
  $accent?: Mode | 'neutral' | 'clean' | 'flagged' | 'warn'
}>`
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
    if ($accent === 'clean') return '#10b981'
    if ($accent === 'flagged') return '#ef4444'
    if ($accent === 'warn') return '#f59e0b'
    return theme.colors.textPrimary
  }};
`

const ScanResultRow = styled(ResultRow)<{ $band?: FileScanResult['riskBand'] }>`
  border-color: ${({ $band }) => ($band ? `${RISK_BAND_COLOR[$band]}33` : undefined)};
  background: ${({ $band }) => ($band ? RISK_BAND_BG[$band] : undefined)};
`

function scanResultAccent(phase: ScanPhase): 'clean' | 'flagged' | 'warn' | 'neutral' {
  if (phase === 'clean') return 'clean'
  if (phase === 'flagged') return 'flagged'
  if (phase === 'error') return 'warn'
  return 'neutral'
}

// ─── Pane footer ─────────────────────────────────────────────────────────────

const PaneFooter = styled.div`
  display: flex;
  gap: 5px;
  padding: 7px 10px;
  border-top: 1px solid ${({ theme }) => theme.colors.primarySoft};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`

const PaneBtn = styled.button<{ $variant?: 'encrypt' | 'decrypt' | 'warn' }>`
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
        : $variant === 'warn'
          ? css`
              background: rgba(239, 68, 68, 0.08);
              color: #ef4444;
              border-color: rgba(239, 68, 68, 0.25);
              &:hover {
                background: #ef4444;
                color: #fff;
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
  onEncrypt: (
    file: File,
    mimeType: string,
    compressionLevel: CompressionLevel
  ) => Promise<EncryptResult>
  onDecrypt: (file: File) => Promise<DecryptResult>
  onModeChange?: (mode: Mode) => void
  externalRefreshKey?: number
  decryptFile?: File
  /**
   * Info about the account that will sign encrypted files.
   * When provided, shown in the input pane before/after encryption.
   * When null/undefined, a "No signing keys" notice is shown instead.
   */
  signerInfo?: SignerInfo | null
}

// ─── Component ────────────────────────────────────────────────────────────────

const FileVault: React.FC<FileVaultProps> = ({
  onEncrypt,
  onDecrypt,
  onModeChange,
  decryptFile,
  signerInfo
}) => {
  const [mode, setMode] = useState<Mode>('encrypt')
  const [inputFile, setInputFile] = useState<FileState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState<ProcessStep[]>([])
  const [encryptResult, setEncryptResult] = useState<EncryptResult | null>(null)
  const [decryptResult, setDecryptResult] = useState<DecryptResult | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  // Add to existing state declarations
  const [encryptSignerInfo, setEncryptSignerInfo] = useState<SignerInfo | null | undefined>(
    undefined
  )
  const [decryptSigStatus, setDecryptSigStatus] = useState<DecryptSignatureStatus | null>(null)

  // ── Compression preset selection (encrypt mode only) ─────────────────────
  // Default to GOOD (lv 9) — strong compression without WASM risk on typical uploads.
  const [selectedPreset, setSelectedPreset] = useState<CompressionPresetKey>('GOOD')

  // ── Scan state ────────────────────────────────────────────────────────────
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  const [scanResult, setScanResult] = useState<FileScanResult | null>(null)

  // ── Double-encrypt detection ──────────────────────────────────────────────
  // Set to true when a decrypted payload is itself a valid .mjkb binary.
  const [decryptedIsNestedMjkb, setDecryptedIsNestedMjkb] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!decryptFile) return
    setMode('decrypt')
    acceptDecryptFile(decryptFile)
    setTimeout(() => {
      handleDecrypt()
    }, 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decryptFile])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const resetOutput = (): void => {
    setEncryptResult(null)
    setDecryptResult(null)
    setResultBlob(null)
    setProgress(0)
    setSteps([])
    setScanPhase('idle')
    setScanResult(null)
    setDecryptedIsNestedMjkb(false)
    setEncryptSignerInfo(undefined) // ← add
    setDecryptSigStatus(null) // ← add
  }

  const handleSetMode = (next: Mode): void => {
    if (next === mode) return
    setMode(next)
    setInputFile(null)
    resetOutput()
    onModeChange?.(next)
  }

  const runScan = async (file: File | Blob): Promise<FileScanResult> => {
    setScanPhase('scanning')
    setScanResult(null)
    await ensureScanner()
    const result = await scanner.scan(file)
    const phase: ScanPhase =
      result.status === 'clean' ? 'clean' : result.status === 'flagged' ? 'flagged' : 'error'
    setScanPhase(phase)
    setScanResult(result)
    return result
  }

  const validateEncryptFile = (file: File): { valid: boolean; mime: string; msg?: string } => {
    if (file.name.toLowerCase().endsWith('.mjkb')) {
      return {
        valid: false,
        mime: 'application/octet-stream',
        msg: 'This file is already an encrypted .mjkb — use Decrypt mode instead.'
      }
    }
    const mime = file.type || inferMimeFromName(file.name)
    const allowed = ALLOWED_MIME_TYPES.has(mime)
    if (!allowed) {
      return {
        valid: false,
        mime,
        msg: `File type "${mime}" is not in the allowed format list.`
      }
    }
    return { valid: true, mime }
  }

  const acceptEncryptFile = async (file: File): Promise<void> => {
    // Use full structural validation (MajikFile.isValidMJKB) rather than just
    // checking magic bytes — catches truncated or malformed files early and
    // avoids silently accepting a non-.mjkb binary with coincidental MJKB magic.
    const looksLikeMjkb =
      file.name.toLowerCase().endsWith('.mjkb') || (await isFullyValidMjkbFile(file))

    if (looksLikeMjkb) {
      // Auto-redirect to decrypt mode: the user almost certainly wants to open
      // this file, not re-encrypt it. By design, double-encrypting is blocked.
      setMode('decrypt')
      onModeChange?.('decrypt')
      resetOutput()
      await acceptDecryptFile(file)
      toast.info('Switched to Decrypt mode', {
        description: 'This file is an encrypted .mjkb — loading it for decryption.',
        id: 'toast-auto-switch-decrypt',
        duration: 4000
      })
      return
    }

    const { valid, mime, msg } = validateEncryptFile(file)
    setInputFile({ file, mime, valid, validationMsg: msg })
    resetOutput()
  }

  const acceptDecryptFile = async (file: File): Promise<void> => {
    // Use full structural validation for decrypt input as well.

    const looksLikeMjkb =
      file.name.toLowerCase().endsWith('.mjkb') || (await isFullyValidMjkbFile(file))

    if (!looksLikeMjkb) {
      // Auto-redirect to decrypt mode: the user almost certainly wants to open
      // this file, not re-encrypt it. By design, double-encrypting is blocked.
      setMode('encrypt')
      onModeChange?.('encrypt')
      resetOutput()
      await acceptEncryptFile(file)
      toast.info('Switched to Encrypt mode', {
        description: 'This file is not an encrypted .mjkb — loading it for encryption.',
        id: 'toast-auto-switch-encrypt',
        duration: 4000
      })
      return
    }
    setInputFile({
      file,
      mime: 'application/octet-stream',
      valid: looksLikeMjkb,
      validationMsg: looksLikeMjkb
        ? undefined
        : "This file is not a valid .mjkb binary. Magic bytes or header don't match."
    })
    resetOutput()
  }

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (mode === 'encrypt') await acceptEncryptFile(file)
    else await acceptDecryptFile(file)
  }

  const handleBrowse = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    if (mode === 'encrypt') await acceptEncryptFile(file)
    else await acceptDecryptFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClearInput = (): void => {
    setInputFile(null)
    resetOutput()
  }

  // ── Encrypt ───────────────────────────────────────────────────────────────

  const handleEncrypt = async (): Promise<void> => {
    if (!inputFile?.valid || !inputFile.file) return
    setIsProcessing(true)
    setProgress(5)
    setSteps([
      { label: '① Scan', done: false, active: true },
      { label: '② Hash', done: false, active: false },
      { label: '③ Compress', done: false, active: false },
      { label: '④ ML-KEM encapsulate', done: false, active: false },
      { label: '⑤ AES-GCM encrypt', done: false, active: false }
    ])

    try {
      const scan = await runScan(inputFile.file)

      if (scan.status === 'flagged' && scan.score <= 70) {
        toast.error('File blocked — threat detected', {
          description: `Score: ${scan.score}/100 · ${scan.remarks.length} rule(s) matched`,
          id: 'toast-scan-blocked',
          duration: 8000
        })
        return
      }

      if (scan.status === 'error') {
        toast.warning('Scan inconclusive — proceeding with caution', {
          id: 'toast-scan-error'
        })
      }

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

      // Pass the selected preset's numeric level to the orchestrator
      const compressionLevel = CompressionPreset[selectedPreset]
      const result = await onEncrypt(inputFile.file, inputFile.mime, compressionLevel)

      tick(80, 3)
      await new Promise((r) => setTimeout(r, 120))
      tick(95, 4)
      await new Promise((r) => setTimeout(r, 80))

      setProgress(100)
      setSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })))
      setEncryptResult(result)
      // Capture signer info from the result if the orchestrator provided it
      setEncryptSignerInfo(result.signerInfo ?? null)
      setResultBlob(result.signerInfo ? result.signedBinary : result.binary)

      // Compute the effective level for the toast description
      const { effective, wasClamped } = resolveAdaptiveLevel(inputFile.file.size, selectedPreset)

      const desired = CompressionPreset[selectedPreset] as number

      const clampNote = wasClamped
        ? ` · auto-clamped lv ${desired} → ${effective}`
        : ` · lv ${effective}`

      toast.success('File encrypted', {
        description: `${inputFile.file.name} → .mjkb (${formatBytes(result.encryptedSize)}) · Zstd${clampNote}`,
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

  // ── Decrypt ───────────────────────────────────────────────────────────────

  const handleDecrypt = async (): Promise<void> => {
    if (!inputFile?.valid || !inputFile.file) return
    setIsProcessing(true)
    setProgress(15)
    setScanPhase('idle')
    setScanResult(null)
    setDecryptedIsNestedMjkb(false)
    setSteps([
      { label: '① Parse .mjkb', done: false, active: true },
      { label: '② ML-KEM decapsulate', done: false, active: false },
      { label: '③ AES-GCM decrypt', done: false, active: false },
      { label: '④ Decompress', done: false, active: false },
      { label: '⑤ Scan plaintext', done: false, active: false }
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
      tick(70, 3)
      await new Promise((r) => setTimeout(r, 100))
      tick(85, 4)
      await new Promise((r) => setTimeout(r, 80))

      // ── Double-encrypt guard ─────────────────────────────────────────────
      // Check whether the decrypted plaintext is itself a valid .mjkb binary.
      // This indicates the user encrypted an already-encrypted file — which
      // is blocked at the upload stage but could have been produced externally.
      const decryptedBytes = await result.binary.arrayBuffer()
      const isNestedMjkb = MajikFile.isValidMJKB(decryptedBytes)
      setDecryptedIsNestedMjkb(isNestedMjkb)

      if (isNestedMjkb) {
        toast.warning('Nested .mjkb detected', {
          description:
            'The decrypted file is itself an encrypted .mjkb. This file was double-encrypted — decrypt it again to recover the original.',
          id: 'toast-nested-mjkb',
          duration: 8000
        })
      }

      const plainFile = new File([result.binary], result.originalName, {
        type: result.mimeType
      })
      const scan = await runScan(plainFile)

      if (scan.status === 'flagged') {
        toast.error('Threat detected in decrypted file', {
          description: `Score: ${scan.score}/100 · ${scan.remarks.length} rule(s) matched · ${RISK_BAND_LABEL[scan.riskBand]}`,
          id: 'toast-scan-decrypt-flagged',
          duration: 8000
        })
      } else if (scan.status === 'error') {
        toast.warning('Post-decrypt scan inconclusive', {
          id: 'toast-scan-decrypt-error'
        })
      } else if (!isNestedMjkb) {
        toast.success('File decrypted — scan clean', {
          description: `Recovered: ${result.originalName} (${formatBytes(result.originalSize)}) · Score: ${scan.score}/100`,
          id: 'toast-decrypt-success'
        })
      }

      setProgress(100)
      setSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })))
      setDecryptResult(result)
      // Show signature status from the decryption result
      setDecryptSigStatus(result.signatureStatus ?? null)
      setResultBlob(result.binary)
    } catch (err) {
      toast.error('Decryption failed', {
        description: err instanceof Error ? err.message : String(err),
        id: 'toast-decrypt-error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = useCallback(async (): Promise<void> => {
    if (!resultBlob) return

    let filename: string
    let type: string

    if (mode === 'encrypt' && encryptResult) {
      filename = `${encryptResult.originalName.replace(/\.[^.]+$/, '')}_${encryptResult.hash.slice(0, 8)}.mjkb`
      type = 'application/octet-stream'
    } else if (mode === 'decrypt' && decryptResult) {
      if (scanPhase === 'flagged') {
        toast.warning('Downloading flagged file — proceed with caution', {
          description: 'A YARA rule matched this file. Save to an isolated location.',
          id: 'toast-download-flagged',
          duration: 6000
        })
      }
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

    if (scanPhase !== 'flagged') {
      toast.success('Download started', {
        description: filename,
        id: 'toast-download'
      })
    }
  }, [mode, resultBlob, encryptResult, decryptResult, scanPhase])

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasValidInput = !!inputFile?.valid
  const hasResult = mode === 'encrypt' ? !!encryptResult : !!decryptResult
  const outputAccent = !hasResult ? null : scanPhase === 'flagged' ? 'flagged' : mode
  const inputAccent = !inputFile ? mode : inputFile.valid ? mode : 'error'
  const outputBadgeVariant = isProcessing ? mode : hasResult ? 'ready' : null

  const compressionRatio =
    encryptResult && encryptResult.originalSize > 0
      ? Math.round((1 - encryptResult.encryptedSize / encryptResult.originalSize) * 100)
      : null

  const downloadLabel = !hasResult
    ? mode === 'encrypt'
      ? 'Download .mjkb'
      : 'Download File'
    : scanPhase === 'flagged'
      ? '⚠ Download Anyway'
      : mode === 'encrypt'
        ? 'Download .mjkb'
        : 'Download File'

  const downloadVariant = scanPhase === 'flagged' ? 'warn' : hasResult ? mode : undefined

  // Pre-compute the adaptive clamp info for the current file + preset selection
  // so we can show it live in the UI without waiting for encryption to run.
  const adaptiveInfo =
    inputFile?.valid && mode === 'encrypt'
      ? resolveAdaptiveLevel(inputFile.file.size, selectedPreset)
      : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Root id="section-file-vault">
      <ContentHeader>
        <ContentLabel>File Content</ContentLabel>
        <ModeSwitcher id="file-vault-mode-toggle">
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

      <input
        ref={fileInputRef}
        type="file"
        accept={mode === 'decrypt' ? '.mjkb' : undefined}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <EditorGrid id="file-vault-editor-grid">
        {/* ── INPUT PANE ── */}
        <EditorPane $accent={inputAccent} id="file-vault-input-pane">
          <PaneHeader>
            <PaneLabel $mode={inputFile?.valid ? mode : null}>
              {mode === 'encrypt' ? 'Source File' : 'Source .mjkb'}
            </PaneLabel>
            <PaneStatusBadge $variant={!inputFile ? null : inputFile.valid ? mode : 'error'}>
              {!inputFile ? 'No File' : inputFile.valid ? 'Ready' : 'Invalid'}
            </PaneStatusBadge>
          </PaneHeader>

          <DropZone
            id="file-vault-drop-zone"
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
              <>
                <DropIconWrap $mode={mode}>
                  {mode === 'encrypt' ? <FolderIcon size={28} /> : <KeyIcon size={28} />}
                </DropIconWrap>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    alignItems: 'center'
                  }}
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
              <FileCard onClick={(e) => e.stopPropagation()}>
                <FileRow $invalid={!inputFile.valid}>
                  <FileLeft>
                    <FileIconEmoji>{getFileIcon(inputFile.mime)}</FileIconEmoji>
                    <FileMeta>
                      <FileName data-private>{inputFile.file.name}</FileName>
                      <FileSize data-private>
                        {formatBytes(inputFile.file.size)} · {inputFile.mime}
                      </FileSize>
                    </FileMeta>
                  </FileLeft>
                  <FileClearBtn onClick={handleClearInput}>✕ Remove</FileClearBtn>
                </FileRow>
                {inputFile.valid ? (
                  <MimeRow>
                    <MimeChip $variant="neutral">Format</MimeChip>
                    <MimeChip $variant={mode === 'encrypt' ? 'source' : 'mjkb'} data-private>
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
                {/* Add inside the encrypt mode input pane, below the MimeRow / ErrorBar */}
                {mode === 'encrypt' && inputFile?.valid && (
                  <EncryptSignerPanel
                    signerInfo={encryptResult ? encryptSignerInfo : signerInfo}
                    hasFile={true}
                  />
                )}
              </FileCard>
            )}
          </DropZone>

          {/*
           * ── Compression preset selector ─────────────────────────────────
           * Only rendered in encrypt mode when a valid file is loaded.
           * Hidden in decrypt mode — Zstd level is embedded in the .mjkb
           * context field and resolved automatically on decompress.
           */}
          {mode === 'encrypt' && inputFile?.valid && (
            <CompressionWrap id="file-vault-compression-selector">
              <CompressionHeaderRow>
                <CompressionLabel>Compression</CompressionLabel>
                {/* Live hint: shows selected preset's description, or clamp notice */}
                <CompressionHint>{PRESET_META[selectedPreset].hint}</CompressionHint>
              </CompressionHeaderRow>

              <CompressionPillRow>
                {PRESET_ORDER.map((key) => (
                  <CompressionPill
                    key={key}
                    $active={selectedPreset === key}
                    $presetKey={key}
                    onClick={() => setSelectedPreset(key)}
                    title={PRESET_META[key].hint}
                  >
                    {PRESET_META[key].label}
                  </CompressionPill>
                ))}
              </CompressionPillRow>

              {/* Adaptive clamp warning — only shown when the selected level
                  would be automatically reduced for this file's size. */}
              {adaptiveInfo?.wasClamped && (
                <ClampNotice>
                  <span style={{ flexShrink: 0 }}>⚡</span>
                  <span>
                    {selectedPreset} (lv {CompressionPreset[selectedPreset]}) will be auto-clamped
                    to lv {adaptiveInfo.effective} for this file size to prevent out-of-memory
                    errors.
                  </span>
                </ClampNotice>
              )}
            </CompressionWrap>
          )}

          <PaneFooter id="file-vault-input-footer">
            <PaneBtn onClick={handleBrowse}>
              {mode === 'encrypt' ? 'Browse File' : 'Browse .mjkb'}
            </PaneBtn>
            <PaneBtn onClick={handleClearInput} disabled={!inputFile}>
              Clear
            </PaneBtn>
          </PaneFooter>
        </EditorPane>

        {/* ── OUTPUT PANE ── */}
        <EditorPane $accent={outputAccent} id="file-vault-output-pane">
          <PaneHeader>
            <PaneHeaderLeft>
              <PaneLabel $mode={hasResult ? mode : null}>
                {mode === 'encrypt' ? 'Encrypted Output' : 'Decrypted File'}
              </PaneLabel>
              {scanPhase !== 'idle' && (
                <ScanPhaseBadge $phase={scanPhase}>
                  {scanPhaseIcon(scanPhase)} {scanPhaseLabel(scanPhase)}
                </ScanPhaseBadge>
              )}
            </PaneHeaderLeft>
            <PaneStatusBadge $variant={outputBadgeVariant}>
              {isProcessing ? 'Processing…' : hasResult ? 'Ready' : 'Waiting'}
            </PaneStatusBadge>
          </PaneHeader>

          {isProcessing && (
            <ProgressBarWrap>
              <ProgressBarFill $progress={progress} $mode={mode} />
            </ProgressBarWrap>
          )}

          {/*
           * ── Nested .mjkb warning ────────────────────────────────────────
           * Shown after a decrypt completes when the recovered payload is
           * itself a structurally valid .mjkb binary — indicating double-encryption.
           * Positioned above the output area so it's impossible to miss.
           */}
          {!isProcessing && decryptedIsNestedMjkb && (
            <NestedMjkbBanner>
              <span style={{ flexShrink: 0, fontSize: 13 }}>⚠</span>
              <span>
                <strong>Nested .mjkb detected.</strong> The decrypted file is itself an encrypted
                .mjkb — this file was double-encrypted. Download it and decrypt again to recover the
                original plaintext. By design, Majik Message does not permit encrypting an already
                encrypted .mjkb.
              </span>
            </NestedMjkbBanner>
          )}

          <OutputArea $hasResult={isProcessing || hasResult}>
            {!isProcessing && !hasResult && (
              <WaitingState>
                <WaitingIcon>
                  {mode === 'encrypt' ? <CubeIcon size={28} /> : <KeyIcon size={28} />}
                </WaitingIcon>
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

            {/* ── Encrypt result ── */}
            {!isProcessing &&
              mode === 'encrypt' &&
              encryptResult &&
              (() => {
                // Compute the effective level once for display in the result card
                const { effective, wasClamped } = resolveAdaptiveLevel(
                  encryptResult.originalSize,
                  selectedPreset
                )
                const desiredLevel = CompressionPreset[selectedPreset] as number
                const levelDisplay = wasClamped
                  ? `Zstd lv ${effective} (auto-clamped from ${desiredLevel})`
                  : `Zstd lv ${effective} · ${PRESET_META[selectedPreset].label}`

                return (
                  <ResultCard>
                    <ResultRow>
                      <ResultLabel>Output file</ResultLabel>
                      <ResultValue $accent="encrypt" data-private>
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
                      <ResultValue $accent="neutral" data-private>
                        {formatBytes(encryptResult.originalSize)}
                      </ResultValue>
                    </ResultRow>
                    <ResultRow>
                      <ResultLabel>Encrypted size</ResultLabel>
                      <ResultValue $accent="encrypt" data-private>
                        {formatBytes(encryptResult.encryptedSize)}
                      </ResultValue>
                    </ResultRow>
                    {/* ── Compression level row ── */}
                    <ResultRow>
                      <ResultLabel>Compression</ResultLabel>
                      <ResultValue
                        $accent={wasClamped ? 'warn' : 'neutral'}
                        title={
                          wasClamped
                            ? `Requested lv ${desiredLevel} (${PRESET_META[selectedPreset].label}) — auto-clamped to lv ${effective} for file size safety`
                            : undefined
                        }
                      >
                        {levelDisplay}
                      </ResultValue>
                    </ResultRow>
                    <ResultRow>
                      <ResultLabel>SHA-256</ResultLabel>
                      <ResultValue
                        $accent="neutral"
                        style={{ fontSize: 9, letterSpacing: '0.03em' }}
                        data-private
                      >
                        {encryptResult.hash.slice(0, 24)}…
                      </ResultValue>
                    </ResultRow>
                    {/* Signer info row — only shown when signed */}
                    {encryptSignerInfo && (
                      <ResultRow>
                        <ResultLabel>Signed by</ResultLabel>
                        <ResultValue $accent="encrypt">
                          {encryptSignerInfo.signerLabel ??
                            encryptSignerInfo.signerId.slice(0, 16) + '…'}
                        </ResultValue>
                      </ResultRow>
                    )}

                    {scanPhase !== 'idle' && scanResult && (
                      <ScanResultRow $band={scanResult.riskBand}>
                        <ResultLabel>Pre-encrypt scan</ResultLabel>
                        <ResultValue $accent={scanResultAccent(scanPhase)}>
                          {scanPhaseIcon(scanPhase)}&nbsp;
                          {RISK_BAND_LABEL[scanResult.riskBand]}&nbsp;·&nbsp;
                          <span style={{ opacity: 0.7 }}>{scanResult.score}/100</span>
                        </ResultValue>
                      </ScanResultRow>
                    )}
                  </ResultCard>
                )
              })()}

            {/* ── Decrypt result ── */}
            {!isProcessing && mode === 'decrypt' && decryptResult && (
              <ResultCard>
                <ResultRow>
                  <ResultLabel>Recovered file</ResultLabel>
                  <ResultValue $accent="decrypt" data-private>
                    {decryptResult.originalName}
                  </ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>MIME type</ResultLabel>
                  <ResultValue $accent="neutral" data-private>
                    {decryptResult.mimeType}
                  </ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Original size</ResultLabel>
                  <ResultValue $accent="decrypt" data-private>
                    {formatBytes(decryptResult.originalSize)}
                  </ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Verified</ResultLabel>
                  <ResultValue $accent="decrypt">✓ ML-KEM-768 match</ResultValue>
                </ResultRow>
                <ResultRow>
                  <ResultLabel>Decompressed</ResultLabel>
                  <ResultValue $accent="neutral">Zstd · self-describing</ResultValue>
                </ResultRow>
                {/* Signature summary row — inline in result card */}
                <ResultRow>
                  <ResultLabel>Signature</ResultLabel>
                  <ResultValue
                    $accent={
                      !decryptSigStatus || decryptSigStatus.verdict === 'unsigned'
                        ? 'neutral'
                        : decryptSigStatus.verdict === 'valid'
                          ? 'decrypt'
                          : decryptSigStatus.verdict === 'invalid'
                            ? 'flagged'
                            : 'warn'
                    }
                  >
                    {!decryptSigStatus || decryptSigStatus.verdict === 'unsigned'
                      ? '◌ Not signed'
                      : decryptSigStatus.verdict === 'valid'
                        ? '✦ Verified'
                        : decryptSigStatus.verdict === 'invalid'
                          ? '⛔ Invalid — tampered'
                          : '~ Present · unverified'}
                  </ResultValue>
                </ResultRow>

                {/* Full signature panel — shows below the result card */}
                <DecryptSignaturePanel status={decryptSigStatus} />
                {/* ── Nested .mjkb inline indicator ── */}
                {decryptedIsNestedMjkb && (
                  <ResultRow>
                    <ResultLabel>Payload</ResultLabel>
                    <ResultValue $accent="warn">⚠ Nested .mjkb — decrypt again</ResultValue>
                  </ResultRow>
                )}
                {scanPhase !== 'idle' && scanResult && (
                  <ScanResultRow $band={scanResult.riskBand}>
                    <ResultLabel>Post-decrypt scan</ResultLabel>
                    <ResultValue $accent={scanResultAccent(scanPhase)}>
                      {scanPhaseIcon(scanPhase)}&nbsp;
                      {RISK_BAND_LABEL[scanResult.riskBand]}&nbsp;·&nbsp;
                      <span style={{ opacity: 0.7 }}>{scanResult.score}/100</span>
                    </ResultValue>
                  </ScanResultRow>
                )}
              </ResultCard>
            )}
          </OutputArea>

          <ScanResultBar
            phase={scanPhase}
            result={scanResult}
            context={mode === 'encrypt' ? 'pre-encrypt' : 'post-decrypt'}
          />

          <PaneFooter id="file-vault-output-footer">
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
              $variant={downloadVariant}
              disabled={!hasResult || isProcessing}
              onClick={handleDownload}
            >
              {downloadLabel}
            </PaneBtn>
          </PaneFooter>
        </EditorPane>
      </EditorGrid>

      {hasResult && !isProcessing && (
        <StatsRow id="file-vault-stats-row">
          <StatChip>
            <StatLabel>Original</StatLabel>
            <StatValue $accent="neutral" data-private>
              {mode === 'encrypt'
                ? formatBytes(encryptResult!.originalSize)
                : formatBytes(inputFile?.file.size ?? 0)}
            </StatValue>
          </StatChip>
          <StatChip>
            <StatLabel>Output</StatLabel>
            <StatValue $accent={mode} data-private>
              {mode === 'encrypt'
                ? formatBytes(encryptResult!.encryptedSize)
                : formatBytes(decryptResult!.originalSize)}
            </StatValue>
          </StatChip>
          <StatChip>
            <StatLabel>Ratio</StatLabel>
            <StatValue $accent="neutral" data-private>
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
