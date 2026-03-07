// UserFiles.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import Fuse from 'fuse.js'
import {
  MagnifyingGlassIcon,
  UploadSimpleIcon,
  DownloadSimpleIcon,
  TrashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  XIcon,
  LockKeyIcon,
  SquaresFourIcon,
  ListIcon,
  SortAscendingIcon,
  WarningIcon,
  PuzzlePieceIcon,
  CopySimpleIcon,
  GlobeSimpleXIcon,
  GlobeIcon
} from '@phosphor-icons/react'
import { MajikFile } from '@majikah/majik-file'
import type { FileContext, MajikFileJSON, TempFileDuration } from '@majikah/majik-file'
import type { FileQuota, UploadIntentBody } from '../majikah-session-wrapper/types/files-api'
import UserFileQuota from './UserFileQuota'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import { toast } from 'sonner'
import type { MajikContact } from '@majikah/majik-message'
import MajikContactListSelector from '../MajikContactListSelector'
import moment from 'moment'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function daysLeft(iso: string | null): string | null {
  if (!iso) return null
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (diff <= 0) return 'Expired'
  return `${diff}d left`
}

function extInfo(name: string | null): { label: string; cls: BadgeCls } {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'heic'].includes(ext))
    return { label: 'IMG', cls: 'img' }
  if (ext === 'pdf') return { label: 'PDF', cls: 'pdf' }
  if (['doc', 'docx', 'txt', 'md', 'rtf', 'odt'].includes(ext)) return { label: 'DOC', cls: 'doc' }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext))
    return { label: 'ZIP', cls: 'zip' }
  return { label: ext.toUpperCase().slice(0, 4) || 'FILE', cls: 'file' }
}

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const pulseOpacity = keyframes`
  0%, 100% { opacity: 0.35; }
  50%       { opacity: 0.75; }
`

// ─── Root ─────────────────────────────────────────────────────────────────────

const Root = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  height: 90vh;
  overflow: hidden;
  animation: ${fadeUp} 200ms cubic-bezier(0.4, 0, 0.2, 1) both;
  width: inherit;
`

// ─── Quota ────────────────────────────────────────────────────────────────────

const QuotaWrap = styled.div`
  padding-bottom: 16px;
  flex-shrink: 0;
`

// ─── Error banner ─────────────────────────────────────────────────────────────

const ErrorBanner = styled.div`
  margin-bottom: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  background: rgba(240, 100, 73, 0.08);
  border: 1px solid rgba(240, 100, 73, 0.2);
  color: #f06449;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
`

const ErrorLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
`

const ErrorDismiss = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  opacity: 0.6;
  padding: 0;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
  }
`

// ─── Controls row (tabs + toolbar) ───────────────────────────────────────────

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 14px;
  flex-wrap: wrap;
  flex-shrink: 0;
`

const TabBar = styled.div`
  display: flex;
  gap: 2px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 10px;
  padding: 3px;
`

const Tab = styled.button<{ $active: boolean }>`
  padding: 5px 14px;
  border-radius: 7px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  border: ${({ $active, theme }) =>
    $active ? `1px solid ${theme.colors.primaryBackground}` : '1px solid transparent'};
  background: ${({ $active, theme }) => ($active ? theme.colors.primaryBackground : 'transparent')};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.textPrimary : theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  text-transform: capitalize;

  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`

const RightControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

// ─── Search ───────────────────────────────────────────────────────────────────

const SearchContainer = styled.div`
  position: relative;
  flex: 1;
  min-width: 180px;
  max-width: 340px;
`

const SearchIconWrap = styled(MagnifyingGlassIcon)`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  pointer-events: none;
`

const SearchInput = styled.input`
  width: 100%;
  height: 34px;
  padding: 0 34px 0 34px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.4;
  }
`

const SearchClear = styled.button`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
  opacity: 0.5;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
  }
`

// ─── Shared small button base ─────────────────────────────────────────────────

const SmBtn = styled.button`
  height: 34px;
  padding: 0 13px;
  border-radius: 8px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`

const AccentBtn = styled(SmBtn)`
  background: ${({ theme }) => theme.colors.primarySoft};
  border-color: ${({ theme }) => theme.colors.primary}4d;
  color: ${({ theme }) => theme.colors.primary};

  &:hover {
    background: ${({ theme }) => theme.colors.primary}28;
    color: ${({ theme }) => theme.colors.primary};
  }
`

const DangerBtn = styled(SmBtn)`
  background: rgba(240, 100, 73, 0.08);
  border-color: rgba(240, 100, 73, 0.22);
  color: #f06449;

  &:hover {
    background: rgba(240, 100, 73, 0.15);
    color: #f06449;
  }
`

// ─── View toggle ──────────────────────────────────────────────────────────────

const ViewToggle = styled.div`
  display: flex;
  gap: 0.25rem;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  padding: 3px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
`

const ViewButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: ${({ $active, theme }) => ($active ? theme.colors.primaryBackground : 'transparent')};
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  transition: all 0.2s;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`

// ─── Scrollable body ──────────────────────────────────────────────────────────

const ScrollBody = styled.div`
  flex: 1;
  width: inherit;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.primaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primaryBackground};
    border-radius: 99px;
  }
`

// ─── Drop zone ────────────────────────────────────────────────────────────────

const DropZone = styled.div<{ $active: boolean }>`
  border: 1.5px dashed
    ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.primaryBackground)};
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : theme.colors.secondaryBackground};
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`

const DropText = styled.p`
  margin: 6px 0 0;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};

  strong {
    color: ${({ theme }) => theme.colors.textPrimary};
    font-weight: 500;
  }
`

const DropHint = styled.p`
  margin: 4px 0 0;
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`

const SectionLabelText = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.8px;
  white-space: nowrap;
  opacity: 0.55;
`

const SectionDivider = styled.div`
  flex: 1;
  height: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
`

// ─── File badge ───────────────────────────────────────────────────────────────

const FileBadge = styled.div<{ $cls: BadgeCls }>`
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.4px;
  flex-shrink: 0;
  border: 1px solid;

  ${({ $cls, theme }) => {
    switch ($cls) {
      case 'img':
        return css`
          background: rgba(62, 207, 142, 0.1);
          color: #3ecf8e;
          border-color: rgba(62, 207, 142, 0.22);
        `
      case 'pdf':
        return css`
          background: rgba(240, 100, 73, 0.1);
          color: #f06449;
          border-color: rgba(240, 100, 73, 0.22);
        `
      case 'doc':
        return css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border-color: ${theme.colors.primary}44;
        `
      case 'zip':
        return css`
          background: rgba(245, 166, 35, 0.1);
          color: #f5a623;
          border-color: rgba(245, 166, 35, 0.22);
        `
      default:
        return css`
          background: ${theme.colors.secondaryBackground};
          color: ${theme.colors.textSecondary};
          border-color: ${theme.colors.primaryBackground};
        `
    }
  }}
`

// ─── Tags ─────────────────────────────────────────────────────────────────────

const Tag = styled.span<{ $variant: 'perm' | 'temp' | 'shared' }>`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.4px;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'perm':
        return css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border-color: ${theme.colors.primary}44;
        `
      case 'temp':
        return css`
          background: rgba(245, 166, 35, 0.1);
          color: #f5a623;
          border-color: rgba(245, 166, 35, 0.25);
        `
      case 'shared':
        return css`
          background: rgba(62, 207, 142, 0.1);
          color: #3ecf8e;
          border-color: rgba(62, 207, 142, 0.25);
        `
    }
  }}
`

// ─── Pending row ──────────────────────────────────────────────────────────────

const PendingRow = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  animation: ${fadeUp} 0.2s ease;
`

const RowInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
`

const RowColumn = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
`

const PendingName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow: hidden;
  text-align: left;

  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;

  word-break: break-word;
  max-width: 300px;
`

const PendingMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 3px;
  flex-wrap: wrap;
`

const PendingMetaText = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`

const StatusBadge = styled.span<{ $error?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid;
  background: ${({ $error }) => ($error ? 'rgba(240,100,73,0.08)' : 'rgba(124,106,247,0.10)')};
  color: ${({ $error, theme }) => ($error ? '#f06449' : theme.colors.primary)};
  border-color: ${({ $error }) => ($error ? 'rgba(240,100,73,0.22)' : 'rgba(124,106,247,0.22)')};
`

const Spinner = styled.div`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid rgba(124, 106, 247, 0.22);
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.7s linear infinite;
  flex-shrink: 0;
`

const StorageToggle = styled.div`
  display: flex;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
`

const StorageOpt = styled.button<{ $active: boolean }>`
  padding: 3px 9px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  background: ${({ $active, theme }) => ($active ? theme.colors.primarySoft : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
`

const ConfirmBtn = styled.button<{ $ready: boolean }>`
  height: 28px;
  padding: 0 12px;
  border-radius: 7px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid ${({ $ready }) => ($ready ? 'rgba(62,207,142,0.25)' : 'transparent')};
  background: ${({ $ready, theme }) =>
    $ready ? 'rgba(62,207,142,0.10)' : theme.colors.primaryBackground};
  color: ${({ $ready }) => ($ready ? '#3ecf8e' : '#6b6b80')};
  cursor: ${({ $ready }) => ($ready ? 'pointer' : 'not-allowed')};
  opacity: ${({ $ready }) => ($ready ? 1 : 0.5)};
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgba(62, 207, 142, 0.18);
  }
`

// ─── Icon button ──────────────────────────────────────────────────────────────

const IconBtn = styled.button<{ $variant?: 'green' | 'red' | 'amber' }>`
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    ${({ $variant, theme }) => {
      if ($variant === 'green')
        return css`
          background: ${theme.colors.primarySoft};
          color: #3ecf8e;
          border-color: rgba(62, 207, 142, 0.3);
        `
      if ($variant === 'red')
        return css`
          background: ${theme.colors.primarySoft};
          color: #f06449;
          border-color: rgba(240, 100, 73, 0.3);
        `
      if ($variant === 'amber')
        return css`
          background: rgba(245, 166, 35, 0.1);
          color: #f5a623;
          border-color: rgba(245, 166, 35, 0.3);
        `
      return css`
        background: ${theme.colors.primarySoft};
        border-color: ${theme.colors.primary};
        color: ${theme.colors.textPrimary};
      `
    }}
  }
`

// ─── Published icon button (active state when file is published) ──────────────

const PublishIconBtn = styled(IconBtn)<{ $published: boolean }>`
  ${({ $published }) =>
    $published &&
    css`
      color: #3ecf8e;
      border-color: rgba(62, 207, 142, 0.3);
      background: rgba(62, 207, 142, 0.08);
    `}
`
// ─── File row (list view) ─────────────────────────────────────────────────────

const FileRowWrap = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  border: 1px solid
    ${({ $selected, theme }) => ($selected ? `${theme.colors.primary}44` : 'transparent')};
  background: ${({ $selected, theme }) => ($selected ? theme.colors.primarySoft : 'transparent')};
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 3px;

  &:hover {
    background: ${({ $selected, theme }) =>
      $selected ? theme.colors.primarySoft : theme.colors.secondaryBackground};
    border-color: ${({ $selected, theme }) =>
      $selected ? `${theme.colors.primary}44` : theme.colors.primaryBackground};
  }

  /* Show actions on hover */
  &:hover > .row-actions,
  &[data-selected='true'] > .row-actions {
    opacity: 1;
  }
`

const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const FileName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
`

const FileMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 3px;
`

const FileMetaText = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`

const FileSizeCol = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  width: 60px;
  text-align: right;
  flex-shrink: 0;
`

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
`

// ─── Grid card ────────────────────────────────────────────────────────────────

const DocsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 4px;
`

const GridCard = styled.div<{ $selected: boolean }>`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? `${theme.colors.primary}44` : theme.colors.primaryBackground};
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &:hover {
    border-color: ${({ theme }) => `${theme.colors.primary}44`};
    transform: translateY(-1px);
  }

  &:hover > .row-actions,
  &[data-selected='true'] > .row-actions {
    opacity: 1;
  }
`

const GridCardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
`

const GridFileName = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.45;
  flex: 1;
`

const GridFileMeta = styled.div`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow = styled.div`
  height: 54px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  animation: ${pulseOpacity} 1.4s ease-in-out infinite;
  margin-bottom: 4px;
`

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = styled.div`
  text-align: center;
  padding: 56px 2rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`

const EmptyIcon = styled.div`
  display: flex;
  font-size: 36px;
  width: 100%;
  justify-content: center;

  margin-bottom: 12px;
  svg {
    color: ${({ theme }) => theme.colors.secondaryBackground};
  }
`

const EmptyTitle = styled.p`
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSecondary};
`

const EmptySub = styled.p`
  margin: 0;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`

// ─── Pagination ───────────────────────────────────────────────────────────────

const PaginationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 16px 0 6px;
  flex-shrink: 0;
`

const PageBtn = styled.button<{ $active?: boolean }>`
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border-radius: 7px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? `${theme.colors.primary}55` : theme.colors.primaryBackground};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : theme.colors.secondaryBackground};
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  cursor: ${({ $active }) => ($active ? 'default' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`

const PageEllipsis = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  padding: 0 2px;
  user-select: none;
`

// ─── Action bar (multi-select) ────────────────────────────────────────────────

const ActionBar = styled.div`
  position: sticky;
  bottom: 0;
  padding: 10px 0 2px;
  background: linear-gradient(
    to top,
    ${({ theme }) => theme.colors.primaryBackground} 60%,
    transparent
  );
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

const SelectedCount = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex: 1;

  strong {
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`

// ─── Duration picker ──────────────────────────────────────────────────────────

const DurationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  max-width: 0;
  opacity: 0;
  transition:
    max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.18s ease;
  flex-shrink: 0;

  &[data-visible='true'] {
    max-width: 220px;
    opacity: 1;
  }
`

const DurationChip = styled.button<{ $active: boolean }>`
  height: 26px;
  min-width: 26px;
  padding: 0 7px;
  border-radius: 5px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
  flex-shrink: 0;

  background: ${({ $active }) => ($active ? 'rgba(245, 166, 35, 0.15)' : 'transparent')};
  color: ${({ $active, theme }) => ($active ? '#f5a623' : theme.colors.textSecondary)};
  border-color: ${({ $active }) =>
    $active ? 'rgba(245, 166, 35, 0.4)' : 'rgba(255,255,255,0.07)'};

  &:hover {
    background: rgba(245, 166, 35, 0.1);
    color: #f5a623;
    border-color: rgba(245, 166, 35, 0.3);
  }
`

const DurationLabel = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  padding-right: 2px;
`

// ─── InlineRecipientPicker ────────────────────────────────────────────────────

const ReEncryptingBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.7;
  white-space: nowrap;
  flex-shrink: 0;
`

interface InlineRecipientPickerProps {
  pendingId: string
  recipients: MajikContact[]
  contacts: MajikContact[]
  onUpdate: (id: string, updated: MajikContact[]) => void
  isReEncrypting: boolean
}

const InlineRecipientPicker: React.FC<InlineRecipientPickerProps> = ({
  pendingId,
  recipients,
  contacts,
  onUpdate,
  isReEncrypting
}) => {
  if (isReEncrypting) {
    return (
      <ReEncryptingBadge>
        <Spinner />
        re-encrypting…
      </ReEncryptingBadge>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <MajikContactListSelector
        id={`recipients-${pendingId}`}
        contacts={contacts}
        value={recipients}
        onUpdate={(updated) => onUpdate(pendingId, updated)}
        allowEmpty={false}
      />
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'permanent' | 'temporary' | 'shared' | 'attachments'
type SortKey = 'date' | 'name' | 'size'
type ViewMode = 'grid' | 'list'
type BadgeCls = 'img' | 'pdf' | 'doc' | 'zip' | 'file'

interface PendingFile {
  id: string
  raw: File
  storageType: 'permanent' | 'temporary'
  tempDuration: TempFileDuration
  recipients: MajikContact[] // ← per-file recipients
  majikFile: MajikFile | null | undefined
  encryptError?: string
}

export interface UserFilesProps {
  majik: MajikMessageDatabase
  uploadContext?: FileContext
  contacts?: MajikContact[] // ← available contacts for selector
  defaultRecipients?: MajikContact[] // ← seeded into each new pending file
}

// ─── Component ────────────────────────────────────────────────────────────────

const UserFiles: React.FC<UserFilesProps> = ({
  majik,
  uploadContext = 'user_upload',
  contacts = [],
  defaultRecipients = []
}) => {
  const [files, setFiles] = useState<MajikFileJSON[]>([])
  const [quota, setQuota] = useState<FileQuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [quotaLoading, setQuotaLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Derive the fetch context from the active tab.
  // 'attachments' fetches thread_attachment files; all other tabs fetch user_upload.
  const activeContext: FileContext = tab === 'attachments' ? 'thread_attachment' : uploadContext

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadFiles = useCallback(
    async (force = false) => {
      setLoading(true)
      try {
        const data = await majik.getFiles(activeContext, 50, 0, force)
        setFiles(data)
      } catch (e) {
        console.error('getFiles failed', e)
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik.user?.id, activeContext]
  )

  const loadQuota = useCallback(
    async (force = false) => {
      setQuotaLoading(true)
      try {
        const q = await majik.getFileQuota(force)
        setQuota(q)
      } catch (e) {
        console.error('getFileQuota failed', e)
      } finally {
        setQuotaLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik.user?.id]
  )

  useEffect(() => {
    loadFiles()
    loadQuota()
  }, [loadFiles, loadQuota])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
    setFiles([]) // clear stale results immediately while the new context loads
    loadFiles()
  }, [activeContext]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1)
  }, [searchQuery, sortKey])

  // ── Fuse.js – build searchable items ────────────────────────────────────────
  //
  // Mirrors the pattern in GroupDocumentations: build a flat text field so
  // Fuse can search across all meaningful properties in one pass.

  const searchableFiles = useMemo(() => {
    return files.map((f) => ({
      ...f,
      // flat text field for Fuse to score against
      _searchText: [f.original_name, f.mime_type, f.context, f.file_hash].filter(Boolean).join(' ')
    }))
  }, [files])

  const fuse = useMemo(
    () =>
      new Fuse(searchableFiles, {
        keys: [
          { name: 'original_name', weight: 0.55 },
          { name: 'mime_type', weight: 0.2 },
          { name: 'context', weight: 0.15 },
          { name: '_searchText', weight: 0.1 }
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 2,
        ignoreFieldNorm: true
      }),
    [searchableFiles]
  )

  // ── Filter + sort + paginate ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    // 1. Fuzzy search (when query is present Fuse handles sorting by score)
    let base: MajikFileJSON[]
    if (searchQuery.trim()) {
      base = fuse.search(searchQuery).map((r) => r.item)
    } else {
      base = [...files]
    }

    // 2. Tab filter
    base = base.filter((f) => {
      if (tab === 'permanent') return f.storage_type === 'permanent'
      if (tab === 'temporary') return f.storage_type === 'temporary'
      if (tab === 'shared') return f.is_shared
      // 'attachments' and 'all' → no additional client-side filter needed
      return true
    })

    // 3. Sort (skipped when fuzzy search is active – Fuse already sorted by score)
    if (!searchQuery.trim()) {
      base.sort((a, b) => {
        if (sortKey === 'name') return (a.original_name ?? '').localeCompare(b.original_name ?? '')
        if (sortKey === 'size') return b.size_original - a.size_original
        return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()
      })
    }

    return base
  }, [files, fuse, searchQuery, tab, sortKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Build the compact page-number window (mirrors GroupDocumentations pattern)
  const pageWindow = useMemo<(number | '…')[]>(() => {
    const pages: (number | '…')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push('…')
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++)
        pages.push(i)
      if (safePage < totalPages - 2) pages.push('…')
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, safePage])

  // ── Encrypt ──────────────────────────────────────────────────────────────────
  // Defined BEFORE addRawFiles so the useCallback below captures a stable ref.

  const encryptPendingFile = useCallback(
    async (pf: PendingFile) => {
      const identity = majik.currentIdentity
      if (!identity) {
        setPendingFiles((prev) =>
          prev.map((p) =>
            p.id === pf.id
              ? { ...p, majikFile: null, encryptError: 'No active identity – please log in' }
              : p
          )
        )
        return
      }

      // Resolve recipient public keys — filter out own account to avoid duplication
      // (MajikFile.create() always prepends the owner automatically)
      const ownFingerprint = identity.id
      const recipientPubKeys = (
        await Promise.all(
          pf.recipients
            .filter((r) => {
              // Strip own account — owner is always added by MajikFile.create()
              const contactFingerprint = r?.fingerprint
              return contactFingerprint !== ownFingerprint
            })
            .map((r) => r.getPublicKeyBase64())
        )
      ).filter(Boolean) as string[]

      const isTemp = pf.storageType === 'temporary'
      try {
        console.log(
          '[UserFiles] encrypting:',
          pf.raw.name,
          '→',
          pf.recipients.length,
          'recipient(s)'
        )
        const bytes = new Uint8Array(await pf.raw.arrayBuffer())
        const encryptedResult = await majik.encryptFile({
          data: bytes,
          mimeType: pf.raw.type || 'application/octet-stream',
          originalName: pf.raw.name,
          context: uploadContext,
          isTemporary: isTemp,
          userId: majik?.user?.id,
          expiresAt: isTemp ? pf.tempDuration : undefined,
          recipients: recipientPubKeys
        })

        const majikFile = encryptedResult.file
        setPendingFiles((prev) => prev.map((p) => (p.id === pf.id ? { ...p, majikFile } : p)))
      } catch (e) {
        console.error('[UserFiles] encrypt error:', e)
        setPendingFiles((prev) =>
          prev.map((p) =>
            p.id === pf.id ? { ...p, majikFile: null, encryptError: (e as Error).message } : p
          )
        )
      }
    },
    [majik, uploadContext]
  )

  // ── Drag & Drop ─────────────────────────────────────────────────────────────

  const addRawFiles = useCallback(
    (rawFiles: File[]) => {
      const batch: PendingFile[] = rawFiles.map((f) => ({
        id: crypto.randomUUID(),
        raw: f,
        storageType: 'permanent' as const,
        tempDuration: 15 as TempFileDuration,
        recipients: defaultRecipients ?? [], // ← seed from prop
        majikFile: undefined
      }))
      setPendingFiles((prev) => [...prev, ...batch])
      batch.forEach((pf) => encryptPendingFile(pf))
    },
    [encryptPendingFile, defaultRecipients]
  )
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length) addRawFiles(dropped)
  }

  const removePending = (id: string): void =>
    setPendingFiles((prev) => prev.filter((p) => p.id !== id))

  const togglePendingStorage = (id: string): void =>
    setPendingFiles((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const next = p.storageType === 'permanent' ? 'temporary' : 'permanent'
        if (p.majikFile instanceof MajikFile) {
          if (next === 'temporary') {
            p.majikFile.setTemporary(p.tempDuration)
          } else {
            p.majikFile.setPermanent()
          }
        }
        return { ...p, storageType: next }
      })
    )

  const setPendingDuration = (id: string, duration: TempFileDuration): void =>
    setPendingFiles((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        // Mutate the MajikFile in-place — already temporary at this point
        if (p.majikFile instanceof MajikFile && p.storageType === 'temporary') {
          p.majikFile.setTemporary(duration)
        }
        return { ...p, tempDuration: duration }
      })
    )

  const setPendingRecipients = useCallback(
    (id: string, updated: MajikContact[]) => {
      // Build the updated pf synchronously so we can pass it directly to encryptPendingFile
      let updatedPf: PendingFile | null = null

      setPendingFiles((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p
          updatedPf = { ...p, recipients: updated, majikFile: undefined, encryptError: undefined }
          return updatedPf
        })
      )

      // encryptPendingFile is stable (useCallback) and writes back via setPendingFiles
      if (updatedPf) encryptPendingFile(updatedPf)
    },
    [encryptPendingFile]
  )

  // ── Confirm upload ──────────────────────────────────────────────────────────

  const processConfirmUploadFile = async (pf: PendingFile): Promise<string> => {
    if (!pf.majikFile || uploadingIds.has(pf.id))
      return 'File is not ready for upload or already uploading'
    setUploadingIds((prev) => new Set(prev).add(pf.id))
    setActionError(null)

    const fileJSON = pf.majikFile.toJSON()
    const isTemp = pf.storageType === 'temporary'
    const intent: UploadIntentBody = {
      fileHash: fileJSON.file_hash,
      sizeOriginal: fileJSON.size_original,
      mimeType: fileJSON.mime_type,
      context: uploadContext,
      isTemporary: isTemp,
      expiresAt: fileJSON.expires_at,
      originalName: fileJSON.original_name
    }
    const confirmed = await majik.uploadFile(intent, pf.majikFile)
    setFiles((prev) => [confirmed, ...prev])
    removePending(pf.id)
    await Promise.all([loadQuota(true), loadFiles(true)]) // force-refresh both
    return `"${pf.raw.name}" uploaded successfully`
  }

  const handleConfirmUploadFile = async (pf: PendingFile): Promise<void> => {
    try {
      toast.promise(processConfirmUploadFile(pf), {
        loading: `Uploading "${pf.raw.name}"...`,
        success: (msg) => {
          return msg
        },
        error: (err) => `${err.message}`
      })
    } catch (err) {
      toast.error('Upload Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: 'toast-error-upload'
      })
      console.error('Upload failed', err)
      setActionError((err as Error).message ?? 'Upload failed')
    } finally {
      setUploadingIds((prev) => {
        const n = new Set(prev)
        n.delete(pf.id)
        return n
      })
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const processDeleteFile = async (fileId: string): Promise<string> => {
    setActionError(null)

    await majik.deleteFile(fileId)
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.delete(fileId)
      return n
    })
    await Promise.all([loadQuota(true), loadFiles(true)]) // force-refresh both
    return 'File deleted successfully'
  }

  const handleDeleteFile = async (fileId: string): Promise<void> => {
    try {
      toast.promise(processDeleteFile(fileId), {
        loading: `Deleting file...`,
        success: (msg) => {
          return msg
        },
        error: (err) => `${err.message}`
      })
    } catch (err) {
      toast.error('Delete Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: 'toast-error-delete'
      })
      console.error('Delete failed', err)
      setActionError((err as Error).message ?? 'Delete failed')
    }
  }

  const deleteSelected = async (): Promise<void> => {
    for (const id of selectedIds) await handleDeleteFile(id)
  }

  // ── Share ────────────────────────────────────────────────────────────────────

  // ── Publish / Unpublish (toggle web accessibility) ───────────────────────────
  // Controls whether the file is accessible via a public share URL on the web.
  // When published, a share_token is generated and the file becomes reachable
  // at /shared/<token>. When unpublished, only the owner can access it (though
  // it can still be shared through other mediums like direct message).

  const processTogglePublish = async (
    fileId: string
  ): Promise<{
    title: string
    description: string
  }> => {
    setActionError(null)

    const result = await majik.toggleFileSharing(fileId)

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, is_shared: result.isShared, share_token: result.shareToken } : f
      )
    )

    if (result.isShared) {
      return {
        title: 'File Published',
        description: 'Anyone with the link can now access this file on the web.'
      }
    }

    return {
      title: 'File Unpublished',
      description: 'Web access has been revoked. The file is now private.'
    }
  }

  const handleTogglePublish = async (fileId: string): Promise<void> => {
    const toastId = toast.loading('Toggling publish status...')

    try {
      const msg = await processTogglePublish(fileId)

      toast.success(msg.title, {
        description: msg.description,
        id: toastId
      })
    } catch (err) {
      toast.error('Publish Toggle Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: toastId
      })
    }
  }
  // ── Copy share link ──────────────────────────────────────────────────────────
  // Copies the public share URL to clipboard. Only meaningful when the file is
  // already published (has a share_token). If not published, nudges the user
  // to publish first.

  const copyShareLink = async (file: MajikFileJSON): Promise<void> => {
    if (!file.is_shared || !file.share_token) {
      toast.info('File is not published', {
        description: 'Use the publish button (globe icon) to make it web-accessible first.',
        id: `toast-copy-unpublished-${file.id}`
      })
      return
    }
    try {
      await navigator.clipboard.writeText(
        `https://majikah.solutions/share/files/${file.share_token}`
      )
      toast.success('Link copied', {
        description: 'Share link copied to clipboard.',
        id: `toast-copy-${file.id}`
      })
    } catch {
      toast.error('Failed to copy link', { id: `toast-copy-err-${file.id}` })
    }
  }

  // ── Download ─────────────────────────────────────────────────────────────────

  const processDownloadFile = async (file: MajikFileJSON): Promise<string> => {
    setActionError(null)

    const binary = await majik.downloadFileBinary(file.id)
    const downloadedBlob = new Blob([binary as BlobPart], {
      type: 'application/octet-stream'
    })

    const majikFileInstance = await MajikFile.fromJSONWithBlob(file, downloadedBlob)

    majikFileInstance.validate()
    const blob = majikFileInstance.toMJKB()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // get original name or fallback
    let fileName = majikFileInstance.originalName ?? file.original_name ?? 'download'

    // strip file extension if present
    fileName = fileName.replace(/\.[^/.]+$/, '')

    // assign to download attribute
    a.download = `${fileName}.mjkb`
    a.click()
    URL.revokeObjectURL(url)
    return `"${file.original_name}" downloaded successfully`
  }

  const handleDownloadFile = async (file: MajikFileJSON): Promise<void> => {
    try {
      toast.promise(processDownloadFile(file), {
        loading: `Downloading "${file.original_name}"...`,
        success: (msg) => {
          return msg
        },
        error: (err) => `${err.message}`
      })
    } catch (err) {
      toast.error('Download Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: 'toast-error-download'
      })
      setActionError((err as Error).message ?? 'Download failed')
    }
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  const toggleSelect = (id: string): void =>
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Root>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          if (picked.length) addRawFiles(picked)
          e.target.value = ''
        }}
      />

      {/* Quota */}
      <QuotaWrap>
        <UserFileQuota quota={quota} isLoading={quotaLoading} />
      </QuotaWrap>

      {/* Error */}
      {actionError && (
        <ErrorBanner>
          <ErrorLeft>
            <WarningIcon size={14} />
            {actionError}
          </ErrorLeft>
          <ErrorDismiss onClick={() => setActionError(null)}>
            <XIcon size={13} />
          </ErrorDismiss>
        </ErrorBanner>
      )}

      {/* Controls: tabs on left, search + toggles on right */}
      <Controls>
        <TabBar>
          {(['all', 'permanent', 'temporary', 'shared', 'attachments'] as Tab[]).map((t) => (
            <Tab key={t} $active={tab === t} onClick={() => setTab(t)}>
              {t}
            </Tab>
          ))}
        </TabBar>

        <RightControls>
          <SearchContainer>
            <SearchIconWrap size={16} weight="regular" />
            <SearchInput
              type="text"
              placeholder="Search files…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <SearchClear onClick={() => setSearchQuery('')}>
                <XIcon size={12} />
              </SearchClear>
            )}
          </SearchContainer>

          {/* Sort cycle */}
          <SmBtn
            onClick={() =>
              setSortKey((k) => (k === 'date' ? 'name' : k === 'name' ? 'size' : 'date'))
            }
            title="Cycle sort: date → name → size"
          >
            <SortAscendingIcon size={13} />
            {sortKey}
          </SmBtn>

          {/* View toggle – same pattern as GroupDocumentations */}
          <ViewToggle>
            <ViewButton
              $active={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <ListIcon size={16} weight={viewMode === 'list' ? 'fill' : 'regular'} />
            </ViewButton>
            <ViewButton
              $active={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <SquaresFourIcon size={16} weight={viewMode === 'grid' ? 'fill' : 'regular'} />
            </ViewButton>
          </ViewToggle>

          <AccentBtn onClick={() => fileInputRef.current?.click()}>
            <UploadSimpleIcon size={13} />
            Upload
          </AccentBtn>
        </RightControls>
      </Controls>

      {/* Scrollable body */}
      <ScrollBody>
        {/* Drop zone */}
        <DropZone
          $active={isDragging}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadSimpleIcon size={22} style={{ opacity: 0.35 }} />
          <DropText>
            <strong>Drop files here</strong> or click to browse
          </DropText>
          <DropHint>Encrypted with MajikFile before upload · Max 100 MB each</DropHint>
        </DropZone>

        {/* Pending files */}
        {pendingFiles.length > 0 && (
          <>
            <SectionLabelRow>
              <SectionLabelText>
                Ready to upload · {pendingFiles.length} file
                {pendingFiles.length > 1 ? 's' : ''}
              </SectionLabelText>
              <SectionDivider />
            </SectionLabelRow>

            {pendingFiles.map((pf) => {
              const isEncrypting = pf.majikFile === undefined
              const isError = pf.majikFile === null
              const isUploading = uploadingIds.has(pf.id)
              const ready = !isEncrypting && !isError && !isUploading
              const { label, cls } = extInfo(pf.raw.name)

              return (
                <PendingRow key={pf.id}>
                  <RowColumn>
                    <RowInfo>
                      <FileBadge $cls={cls}>{label}</FileBadge>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <PendingName>{pf.raw.name}</PendingName>
                        <PendingMeta>
                          <PendingMetaText>{formatBytes(pf.raw.size)}</PendingMetaText>

                          {isEncrypting && !isError && (
                            <StatusBadge>
                              <Spinner />
                              <LockKeyIcon size={10} />
                              Encrypting…
                            </StatusBadge>
                          )}
                          {isError && (
                            <StatusBadge $error>
                              <WarningIcon size={10} />
                              {pf.encryptError ?? 'Encrypt failed'}
                            </StatusBadge>
                          )}
                          {isUploading && (
                            <StatusBadge>
                              <Spinner />
                              Uploading…
                            </StatusBadge>
                          )}
                        </PendingMeta>
                      </div>

                      {/* Storage type toggle */}
                      <StorageToggle>
                        {(['permanent', 'temporary'] as const).map((st) => (
                          <StorageOpt
                            key={st}
                            $active={pf.storageType === st}
                            onClick={() => togglePendingStorage(pf.id)}
                          >
                            {st === 'permanent' ? 'Perm' : 'Temp'}
                          </StorageOpt>
                        ))}
                      </StorageToggle>

                      {/* Duration picker — slides in when temporary is selected */}
                      <DurationRow data-visible={pf.storageType === 'temporary' ? 'true' : 'false'}>
                        <DurationLabel>ttl</DurationLabel>
                        {([1, 2, 3, 5, 7, 15] as TempFileDuration[]).map((d) => (
                          <DurationChip
                            key={d}
                            $active={pf.tempDuration === d}
                            onClick={() => setPendingDuration(pf.id, d)}
                            title={`${d} day${d === 1 ? '' : 's'}`}
                          >
                            {d}d
                          </DurationChip>
                        ))}
                      </DurationRow>

                      <ConfirmBtn
                        $ready={ready}
                        disabled={!ready}
                        onClick={() => handleConfirmUploadFile(pf)}
                      >
                        {isUploading ? '…' : 'Confirm'}
                      </ConfirmBtn>

                      <IconBtn $variant="red" onClick={() => removePending(pf.id)}>
                        <XIcon size={12} />
                      </IconBtn>
                    </RowInfo>
                    {/* ── Recipient picker ── */}
                    <InlineRecipientPicker
                      pendingId={pf.id}
                      recipients={pf.recipients}
                      contacts={contacts}
                      onUpdate={setPendingRecipients}
                      isReEncrypting={pf.majikFile === undefined && pf.recipients.length > 0}
                    />
                  </RowColumn>
                </PendingRow>
              )
            })}
          </>
        )}

        {/* File list / grid */}
        {loading ? (
          <>
            {[...Array(6)].map((_, i) => (
              <SkeletonRow key={i} style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <PuzzlePieceIcon size={36} />
            </EmptyIcon>
            <EmptyTitle>{searchQuery ? 'No files match your search' : 'No files yet'}</EmptyTitle>
            <EmptySub>
              {searchQuery ? 'Try a different query' : 'Drop files above to get started'}
            </EmptySub>
          </EmptyState>
        ) : (
          <>
            <SectionLabelRow style={{ marginTop: pendingFiles.length > 0 ? 16 : 4 }}>
              <SectionLabelText>
                {tab === 'all' ? 'Your files' : tab} · {filtered.length} item
                {filtered.length !== 1 ? 's' : ''}
              </SectionLabelText>
              <SectionDivider />
            </SectionLabelRow>

            {viewMode === 'list' ? (
              paginated.map((file) => {
                const { label, cls } = extInfo(file.original_name)
                const isSelected = selectedIds.has(file.id)
                const expiry = moment(file?.expires_at ?? new Date()).fromNow()

                return (
                  <FileRowWrap
                    key={file.id}
                    $selected={isSelected}
                    data-selected={isSelected}
                    onClick={() => toggleSelect(file.id)}
                  >
                    <FileBadge $cls={cls}>{label}</FileBadge>

                    <FileInfo>
                      <FileName>{file.original_name ?? file.file_hash.slice(0, 16) + '…'}</FileName>
                      <FileMeta>
                        <FileMetaText>{formatDate(file.timestamp)}</FileMetaText>
                        <Tag $variant={file.storage_type === 'permanent' ? 'perm' : 'temp'}>
                          {file.storage_type === 'permanent'
                            ? 'Permanent'
                            : `Expires${expiry ? ` · ${expiry}` : ''}`}
                        </Tag>
                        {file.context === 'thread_attachment' && (
                          <Tag $variant="shared">Attachment</Tag>
                        )}
                        {file.is_shared && <Tag $variant="shared">Shared</Tag>}
                      </FileMeta>
                    </FileInfo>

                    <FileSizeCol>{formatBytes(file.size_original)}</FileSizeCol>

                    <RowActions className="row-actions">
                      <IconBtn
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadFile(file)
                        }}
                        title="Download"
                      >
                        <DownloadSimpleIcon size={13} />
                      </IconBtn>
                      {file.context !== 'thread_attachment' && (
                        <>
                          {/* Copy share link — only functional when published */}
                          <IconBtn
                            onClick={(e) => {
                              e.stopPropagation()
                              copyShareLink(file)
                            }}
                            title={
                              file.is_shared
                                ? 'Copy share link'
                                : 'Copy share link (publish first to enable web access)'
                            }
                          >
                            <CopySimpleIcon size={13} />
                          </IconBtn>

                          {/* Publish / Unpublish — toggles web accessibility */}

                          <PublishIconBtn
                            $published={!!file.is_shared}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTogglePublish(file.id)
                            }}
                            title={
                              file.is_shared
                                ? 'Unpublish · revoke web access'
                                : 'Publish · make accessible on the web'
                            }
                          >
                            {file.is_shared ? (
                              <GlobeSimpleXIcon size={13} />
                            ) : (
                              <GlobeIcon size={13} />
                            )}
                          </PublishIconBtn>
                        </>
                      )}

                      <IconBtn
                        $variant="red"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFile(file.id)
                        }}
                        title="Delete"
                      >
                        <TrashIcon size={13} />
                      </IconBtn>
                    </RowActions>
                  </FileRowWrap>
                )
              })
            ) : (
              <DocsGrid>
                {paginated.map((file) => {
                  const { label, cls } = extInfo(file.original_name)
                  const isSelected = selectedIds.has(file.id)
                  const expiry = daysLeft(file.expires_at)

                  return (
                    <GridCard
                      key={file.id}
                      $selected={isSelected}
                      data-selected={isSelected}
                      onClick={() => toggleSelect(file.id)}
                    >
                      <GridCardTop>
                        <FileBadge $cls={cls}>{label}</FileBadge>
                        <RowActions
                          className="row-actions"
                          style={{ opacity: isSelected ? 1 : undefined }}
                        >
                          <IconBtn
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadFile(file)
                            }}
                          >
                            <DownloadSimpleIcon size={12} />
                          </IconBtn>

                          {/* Copy share link */}
                          <IconBtn
                            onClick={(e) => {
                              e.stopPropagation()
                              copyShareLink(file)
                            }}
                            title={
                              file.is_shared
                                ? 'Copy share link'
                                : 'Copy share link (publish first to enable web access)'
                            }
                          >
                            <CopySimpleIcon size={12} />
                          </IconBtn>

                          {/* Publish / Unpublish */}
                          <PublishIconBtn
                            $published={!!file.is_shared}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTogglePublish(file.id)
                            }}
                            title={
                              file.is_shared
                                ? 'Unpublish · revoke web access'
                                : 'Publish · make accessible on the web'
                            }
                          >
                            {file.is_shared ? (
                              <GlobeSimpleXIcon size={12} />
                            ) : (
                              <GlobeIcon size={12} />
                            )}
                          </PublishIconBtn>

                          <IconBtn
                            $variant="red"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteFile(file.id)
                            }}
                          >
                            <TrashIcon size={12} />
                          </IconBtn>
                        </RowActions>
                      </GridCardTop>

                      <GridFileName>
                        {file.original_name ?? file.file_hash.slice(0, 12) + '…'}
                      </GridFileName>

                      <FileMeta>
                        <Tag $variant={file.storage_type === 'permanent' ? 'perm' : 'temp'}>
                          {file.storage_type === 'permanent'
                            ? 'Perm'
                            : `Temp${expiry ? ` · ${expiry}` : ''}`}
                        </Tag>
                        {file.is_shared && <Tag $variant="shared">Shared</Tag>}
                      </FileMeta>

                      <GridFileMeta>
                        {formatBytes(file.size_original)} · {formatDate(file.timestamp)}
                      </GridFileMeta>
                    </GridCard>
                  )
                })}
              </DocsGrid>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationRow>
                <PageBtn disabled={safePage === 1} onClick={() => setPage((p) => p - 1)}>
                  <ArrowLeftIcon size={12} />
                </PageBtn>

                {pageWindow.map((p, i) =>
                  p === '…' ? (
                    <PageEllipsis key={`ellipsis-${i}`}>…</PageEllipsis>
                  ) : (
                    <PageBtn
                      key={p}
                      $active={p === safePage}
                      onClick={() => typeof p === 'number' && setPage(p)}
                    >
                      {p}
                    </PageBtn>
                  )
                )}

                <PageBtn disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ArrowRightIcon size={12} />
                </PageBtn>
              </PaginationRow>
            )}
          </>
        )}

        {/* Multi-select action bar */}
        {selectedIds.size > 0 && (
          <ActionBar>
            <SelectedCount>
              <strong>{selectedIds.size}</strong> selected
            </SelectedCount>
            <SmBtn
              onClick={() => {
                const file = files.find((f) => selectedIds.has(f.id))
                if (file) handleDownloadFile(file)
              }}
            >
              <DownloadSimpleIcon size={13} />
              Download
            </SmBtn>
            <AccentBtn
              onClick={async () => {
                for (const id of selectedIds) {
                  const file = files.find((f) => f.id === id)
                  if (file) await copyShareLink(file)
                }
              }}
            >
              <CopySimpleIcon size={13} />
              Copy Link
            </AccentBtn>
            <SmBtn
              onClick={async () => {
                for (const id of selectedIds) await handleTogglePublish(id)
              }}
            >
              <GlobeIcon size={13} />
              Publish
            </SmBtn>
            <DangerBtn onClick={deleteSelected}>
              <TrashIcon size={13} />
              Delete
            </DangerBtn>
          </ActionBar>
        )}
      </ScrollBody>
    </Root>
  )
}

export default UserFiles
