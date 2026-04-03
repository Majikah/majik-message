// UserContactInvitations.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CheckIcon,
  ClockIcon,
  EnvelopeIcon,
  EnvelopeOpenIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  SealCheckIcon,
  UserCircleIcon,
  UserCirclePlusIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import {
  MajikContactInvite,
  MajikContactInviteStatus,
} from "../majik-context-wrapper/majik-contact-invite";
import moment from "moment";

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";
const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function abbrevKey(key: string, head = 8, tail = 6): string {
  if (key.length <= head + tail + 3) return key;
  return `${key.slice(0, head)}…${key.slice(-tail)}`;
}

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulseOpacity = keyframes`
  0%, 100% { opacity: 0.3; }
  50%       { opacity: 0.7; }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
`;

// ─── Root ─────────────────────────────────────────────────────────────────────

const Root = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  height: 90vh;
  overflow: hidden;
  animation: ${fadeUp} 220ms cubic-bezier(0.4, 0, 0.2, 1) both;
  width: inherit;
`;

// ─── Summary bar ─────────────────────────────────────────────────────────────

const SummaryBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 12px;
  margin-bottom: 16px;
  flex-shrink: 0;
`;

const SummaryStat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const SummaryValue = styled.div`
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1;
`;

const SummaryLabel = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
`;

const SummaryDivider = styled.div`
  width: 1px;
  height: 28px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
`;

// ─── Error banner ─────────────────────────────────────────────────────────────

const ErrorBanner = styled.div`
  margin-bottom: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  font-family: ${FONT_MONO};
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
`;

const ErrorLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
`;

const ErrorDismiss = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  opacity: 0.6;
  padding: 0;
  &:hover {
    opacity: 1;
  }
`;

// ─── Controls ────────────────────────────────────────────────────────────────

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const RightControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SearchContainer = styled.div`
  position: relative;
  flex: 1;
  min-width: 180px;
  max-width: 320px;
`;

const SearchIconWrap = styled(MagnifyingGlassIcon)`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  height: 34px;
  padding: 0 32px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${FONT_MONO};
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
`;

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
  &:hover {
    opacity: 1;
  }
`;

// ─── Shared small button ──────────────────────────────────────────────────────

const SmBtn = styled.button`
  height: 34px;
  padding: 0 13px;
  border-radius: 8px;
  font-family: ${FONT_MONO};
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
`;

// ─── Tab strip ────────────────────────────────────────────────────────────────

const TabStrip = styled.div`
  display: flex;
  gap: 4px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  padding: 3px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  flex-shrink: 0;
  margin-bottom: 14px;
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s;
  white-space: nowrap;

  background: ${({ $active, theme }) =>
    $active ? theme.colors.primaryBackground : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? undefined : theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const TabBadge = styled.span<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 5px;
  font-size: 9px;
  font-weight: 700;
  background: ${({ $active, theme }) =>
    $active
      ? `${theme.colors.primary}22`
      : `${theme.colors.secondaryBackground}`};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
`;

// ─── Status filter row ────────────────────────────────────────────────────────

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  flex-shrink: 0;
`;

const FilterLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const FilterChip = styled.button<{
  $active: boolean;
  $variant?: "pending" | "accepted";
}>`
  height: 26px;
  padding: 0 10px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid;

  ${({ $active, $variant }) => {
    if ($variant === "pending") {
      return $active
        ? css`
            background: rgba(245, 158, 11, 0.12);
            border-color: rgba(245, 158, 11, 0.35);
            color: #f59e0b;
          `
        : css`
            background: transparent;
            border-color: rgba(245, 158, 11, 0.15);
            color: rgba(245, 158, 11, 0.45);
            &:hover {
              border-color: rgba(245, 158, 11, 0.3);
              color: #f59e0b;
            }
          `;
    }

    if ($variant === "accepted") {
      return $active
        ? css`
            background: rgba(34, 197, 94, 0.1);
            border-color: rgba(34, 197, 94, 0.3);
            color: #22c55e;
          `
        : css`
            background: transparent;
            border-color: rgba(34, 197, 94, 0.12);
            color: rgba(34, 197, 94, 0.4);
            &:hover {
              border-color: rgba(34, 197, 94, 0.28);
              color: #22c55e;
            }
          `;
    }
    // all
    return $active
      ? css`
          background: rgba(194, 197, 34, 0.1);
          border-color: rgba(154, 197, 34, 0.3);
          color: #bac522;
        `
      : css`
          background: transparent;
          border-color: rgba(197, 154, 34, 0.12);
          color: rgba(186, 197, 34, 0.4);
          &:hover {
            border-color: rgba(194, 197, 34, 0.28);
            color: #adc522;
          }
        `;
  }}
`;

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const SectionLabelText = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
  opacity: 0.45;
`;

const SectionDivider = styled.div`
  flex: 1;
  height: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
`;

// ─── Scroll body ──────────────────────────────────────────────────────────────

const ScrollBody = styled.div`
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.colors.primaryBackground} transparent`};
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
`;

// ─── Invite row ───────────────────────────────────────────────────────────────

const InviteRowWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  transition: all 0.15s;
  margin-bottom: 4px;
  animation: ${slideIn} 180ms cubic-bezier(0.4, 0, 0.2, 1) both;

  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-color: ${({ theme }) => theme.colors.primaryBackground};
  }

  &:hover .invite-actions {
    opacity: 1;
  }
`;

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar = styled.div<{ $direction: "incoming" | "sent" }>`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid;

  ${({ $direction }) =>
    $direction === "incoming"
      ? css`
          background: rgba(79, 110, 247, 0.08);
          border-color: rgba(79, 110, 247, 0.2);
          color: #4f6ef7;
        `
      : css`
          background: rgba(85, 188, 247, 0.08);
          border-color: rgba(85, 142, 247, 0.2);
          color: #559bf7;
        `}
`;

// ─── Invite info ──────────────────────────────────────────────────────────────

const InviteInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const InviteKeyRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const InviteKey = styled.span`
  font-family: ${FONT_MONO};
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
`;

const InviteMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const InviteMetaText = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  display: flex;
  align-items: center;
  gap: 3px;
`;

// ─── Status tag ───────────────────────────────────────────────────────────────

const StatusTag = styled.span<{ $status: MajikContactInviteStatus }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 5px;
  border: 1px solid;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;

  ${({ $status }) => {
    switch ($status) {
      case "accepted":
        return css`
          background: rgba(34, 197, 94, 0.08);
          color: #22c55e;
          border-color: rgba(34, 197, 94, 0.22);
        `;
      case "pending":
        return css`
          background: rgba(245, 158, 11, 0.08);
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.22);
        `;
      case "rejected":
        return css`
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.22);
        `;
    }
  }}
`;

// ─── Direction tag ────────────────────────────────────────────────────────────

const DirectionTag = styled.span<{ $direction: "incoming" | "sent" }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;

  ${({ $direction }) =>
    $direction === "incoming"
      ? css`
          background: rgba(79, 110, 247, 0.07);
          color: #4f6ef7;
          border-color: rgba(79, 110, 247, 0.18);
        `
      : css`
          background: rgba(85, 150, 247, 0.07);
          color: #55bcf7;
          border-color: rgba(85, 201, 247, 0.18);
        `}
`;

// ─── Row actions ──────────────────────────────────────────────────────────────

const InviteActions = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
`;

const IconBtn = styled.button<{ $variant?: "green" | "red" }>`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;

  ${({ $variant }) =>
    $variant === "green"
      ? css`
          &:hover {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
            border-color: rgba(34, 197, 94, 0.3);
          }
        `
      : $variant === "red"
        ? css`
            &:hover {
              background: rgba(239, 68, 68, 0.1);
              color: #ef4444;
              border-color: rgba(239, 68, 68, 0.3);
            }
          `
        : css`
            &:hover {
              background: ${({ theme }) => theme.colors.primaryBackground};
              color: ${({ theme }) => theme.colors.textPrimary};
            }
          `}

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

// ─── Add to directory button ──────────────────────────────────────────────────
/**
 * Shown only when:
 *   - invite.isAccepted() === true
 *   - current user is the requester (direction === "sent")
 *   - invite.payload is non-null (the accepting party attached their contact string)
 *
 * Clicking the button imports the payload as a contact string, then calls
 * majik.deleteContactInvite to clean up the record. Both steps happen in
 * handleAddToDirectory below.
 */
const AddContactBtn = styled.button`
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  border: 1px solid rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.08);
  color: #22c55e;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.5);
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow = styled.div`
  height: 62px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  animation: ${pulseOpacity} 1.4s ease-in-out infinite;
  margin-bottom: 4px;
`;

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = styled.div`
  text-align: center;
  padding: 56px 2rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const EmptyIcon = styled.div`
  display: flex;
  font-size: 36px;
  width: 100%;
  justify-content: center;
  margin-bottom: 12px;
  svg {
    color: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const EmptyTitle = styled.p`
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const EmptySub = styled.p`
  margin: 0;
  font-family: ${FONT_MONO};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

// ─── Spinner ──────────────────────────────────────────────────────────────────

const Spinner = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid rgba(124, 106, 247, 0.22);
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.7s linear infinite;
  flex-shrink: 0;
`;

// ─── Pagination ───────────────────────────────────────────────────────────────

const PaginationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 16px 0 6px;
  flex-shrink: 0;
`;

const PageBtn = styled.button<{ $active?: boolean }>`
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border-radius: 7px;
  font-family: ${FONT_MONO};
  font-size: 11px;
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? `${theme.colors.primary}55` : theme.colors.primaryBackground};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : theme.colors.secondaryBackground};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  cursor: ${({ $active }) => ($active ? "default" : "pointer")};
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
`;

const PageEllipsis = styled.span`
  font-family: ${FONT_MONO};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  padding: 0 2px;
  user-select: none;
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type DirectionFilter = "all" | "incoming" | "sent";
type StatusFilter = "pending" | "accepted";

export interface UserContactInvitationsProps {
  majik: MajikMessageDatabase;
}

// ─── Component ────────────────────────────────────────────────────────────────

const UserContactInvitations: React.FC<UserContactInvitationsProps> = ({
  majik,
}) => {
  const [invites, setInvites] = useState<MajikContactInvite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] =
    useState<DirectionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter | undefined>(
    undefined,
  );
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // ── Current user key (to determine direction) ─────────────────────────────
  const [currentUserKey, setCurrentUserKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolve = async (): Promise<void> => {
      try {
        const account = majik.getActiveAccount();
        if (!account) return;
        const key = await account.getPublicKeyBase64();
        if (!cancelled) setCurrentUserKey(key);
      } catch {
        // Non-fatal — direction tags simply won't appear
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [majik]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const loadInvites = useCallback(
    async (quiet = false, forceReload = false) => {
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      setActionError(null);
      try {
        const fetchedData = await majik.getAllContactInvites(
          {
            status: statusFilter,
            page: page,
          },
          forceReload,
        );

        const parsed = fetchedData.invites.map(MajikContactInvite.fromJSON);
        setInvites(parsed);
        setTotal(fetchedData.pagination.total);
        setPage(1);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to load invitations.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [majik, statusFilter, page],
  );

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  // Reset to page 1 when filters / search change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, directionFilter, statusFilter]);

  // ── Direction helper ──────────────────────────────────────────────────────

  const getDirection = useCallback(
    (invite: MajikContactInvite): "incoming" | "sent" => {
      if (!currentUserKey) return "incoming";
      return invite.requesterPublicKey === currentUserKey ? "sent" : "incoming";
    },
    [currentUserKey],
  );

  // ── Filter (client-side within loaded batch) ──────────────────────────────

  const filtered = useMemo(() => {
    return invites.filter((inv) => {
      // Direction gate
      if (directionFilter !== "all") {
        const dir = getDirection(inv);
        if (dir !== directionFilter) return false;
      }

      // Search (against both public keys and id)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const haystack = [
          inv.requesterPublicKey,
          inv.recipientPublicKey,
          inv.id,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [invites, directionFilter, searchQuery, getDirection]);

  // ── Counts ────────────────────────────────────────────────────────────────

  const incomingCount = useMemo(
    () => invites.filter((inv) => getDirection(inv) === "incoming").length,
    [invites, getDirection],
  );
  const sentCount = useMemo(
    () => invites.filter((inv) => getDirection(inv) === "sent").length,
    [invites, getDirection],
  );

  // ── Pagination ────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const pageWindow = useMemo<(number | "…")[]>(() => {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("…");
      for (
        let i = Math.max(2, safePage - 1);
        i <= Math.min(totalPages - 1, safePage + 1);
        i++
      )
        pages.push(i);
      if (safePage < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  // ── Accept ────────────────────────────────────────────────────────────────

  const handleAccept = useCallback(
    async (invite: MajikContactInvite): Promise<void> => {
      setProcessingIds((prev) => new Set(prev).add(invite.id));
      try {
        if (!invite.payload?.trim()) {
          toast.error("Contact Card not Found");
          return;
        }
        try {
          const importResponse = await majik.importContactFromString(
            invite.payload,
          );

          if (!importResponse.success) {
            toast.error("Failed to Add New Contact", {
              description: importResponse.message,
              id: "error-majik-add",
            });
          }
        } catch {
          console.log("Skipped importing contact card of requester: ");
        }

        const response = await majik.acceptContactInvite(invite.id);

        if (response.success) {
          toast.success("Contact request accepted", {
            description: response.message,
            id: `contact-accept-${invite.id}`,
          });
        } else {
          toast.error("Failed to accept invite", {
            description: response.message,
            id: `contact-accept-error-${invite.id}`,
          });
        }
        loadInvites(undefined, true);
      } catch (err) {
        toast.error("Failed to accept", {
          description:
            err instanceof Error ? err.message : "Something went wrong.",
          id: `invite-accept-err-${invite.id}`,
        });
      } finally {
        setProcessingIds((prev) => {
          const n = new Set(prev);
          n.delete(invite.id);
          return n;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik],
  );

  // ── Reject / cancel ───────────────────────────────────────────────────────

  const handleCancelReject = useCallback(
    async (invite: MajikContactInvite): Promise<void> => {
      const isOwn = getDirection(invite) === "sent";
      setProcessingIds((prev) => new Set(prev).add(invite.id));
      try {
        if (isOwn) {
          const response = await majik.deleteContactInvite(invite.id);

          if (response.success) {
            toast.success("Invite cancelled", {
              description: response.message,
              id: `contact-request-${invite.id}`,
            });
          } else {
            toast.error("Failed to cancel invite", {
              description: response.message,
              id: `contact-request-error-${invite.id}`,
            });
          }
        } else {
          const response = await majik.rejectContactInvite(invite.id);
          if (response.success) {
            toast.success("Invite rejected", {
              description: response.message,
              id: `contact-request-${invite.id}`,
            });
          } else {
            toast.error("Failed to reject invite", {
              description: response.message,
              id: `contact-request-error-${invite.id}`,
            });
          }
        }
        loadInvites(undefined, true);
      } catch (err) {
        toast.error(isOwn ? "Failed to cancel" : "Failed to decline", {
          description:
            err instanceof Error ? err.message : "Something went wrong.",
          id: `invite-reject-err-${invite.id}`,
        });
      } finally {
        setProcessingIds((prev) => {
          const n = new Set(prev);
          n.delete(invite.id);
          return n;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getDirection],
  );

  // ── Add to directory ──────────────────────────────────────────────────────

  const handleAddToDirectory = useCallback(
    async (invite: MajikContactInvite): Promise<void> => {
      // Hard guards — should never be reached if canAddToDirectory is correct
      if (!invite.isAccepted() || getDirection(invite) !== "sent") return;
      if (!invite.payload) {
        toast.error("No contact data available", {
          description:
            "This invite was accepted but contains no contact payload.",
          id: `add-contact-no-payload-${invite.id}`,
        });
        return;
      }

      setProcessingIds((prev) => new Set(prev).add(invite.id));
      try {
        try {
          const importResponse = await majik.importContactFromString(
            invite.payload,
          );

          if (!importResponse.success) {
            toast.error("Failed to Add New Contact", {
              description: importResponse.message,
              id: "error-majik-add",
            });
          }
        } catch {
          console.log("Skipped importing contact card of requester: ");
        }
        // Clean up the invite record now that it has been consumed
        const deleteResponse = await majik.deleteContactInvite(invite.id);
        if (!deleteResponse.success) {
          // Non-fatal: contact was imported, cleanup just didn't finish
          console.warn(
            "[UserContactInvitations] deleteContactInvite failed after import:",
            deleteResponse.message,
          );
        }

        // Remove from local state regardless of delete outcome
        loadInvites(undefined, true);

        toast.success("Contact added to directory", {
          description: `${abbrevKey(invite.recipientPublicKey)} has been imported.`,
          id: `add-contact-success-${invite.id}`,
        });
      } catch (err) {
        toast.error("Failed to add contact", {
          description:
            err instanceof Error ? err.message : "Something went wrong.",
          id: `add-contact-err-${invite.id}`,
        });
      } finally {
        setProcessingIds((prev) => {
          const n = new Set(prev);
          n.delete(invite.id);
          return n;
        });
      }
    },
    [majik, getDirection],
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Root>
      {/* ── Summary bar ── */}
      <SummaryBar>
        <SummaryStat>
          <SummaryValue>{total}</SummaryValue>
          <SummaryLabel>Total Invitations</SummaryLabel>
        </SummaryStat>

        <SummaryDivider />

        <SummaryStat>
          <SummaryValue>{incomingCount}</SummaryValue>
          <SummaryLabel>Incoming</SummaryLabel>
        </SummaryStat>

        <SummaryDivider />

        <SummaryStat>
          <SummaryValue>{sentCount}</SummaryValue>
          <SummaryLabel>Sent</SummaryLabel>
        </SummaryStat>

        <SmBtn
          onClick={() => loadInvites(true)}
          disabled={refreshing || loading}
          title="Refresh"
          style={{ marginLeft: "auto" }}
        >
          {refreshing ? <Spinner /> : <ArrowsClockwiseIcon size={13} />}
          Refresh
        </SmBtn>
      </SummaryBar>

      {/* ── Error banner ── */}
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

      {/* ── Tab strip: direction filter ── */}
      <TabStrip>
        <Tab
          $active={directionFilter === "all"}
          onClick={() => setDirectionFilter("all")}
        >
          All
          <TabBadge $active={directionFilter === "all"}>{total}</TabBadge>
        </Tab>
        <Tab
          $active={directionFilter === "incoming"}
          onClick={() => setDirectionFilter("incoming")}
        >
          <EnvelopeOpenIcon size={12} />
          Incoming
          <TabBadge $active={directionFilter === "incoming"}>
            {incomingCount}
          </TabBadge>
        </Tab>
        <Tab
          $active={directionFilter === "sent"}
          onClick={() => setDirectionFilter("sent")}
        >
          <PaperPlaneTiltIcon size={12} />
          Sent
          <TabBadge $active={directionFilter === "sent"}>{sentCount}</TabBadge>
        </Tab>
      </TabStrip>

      {/* ── Controls row: search + status filter ── */}
      <Controls>
        <SearchContainer>
          <SearchIconWrap size={15} />
          <SearchInput
            type="text"
            placeholder="Search by public key or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <SearchClear onClick={() => setSearchQuery("")}>
              <XIcon size={12} />
            </SearchClear>
          )}
        </SearchContainer>

        <RightControls>
          <FilterRow style={{ margin: 0 }}>
            <FilterLabel>
              <FunnelIcon size={10} />
              Status
            </FilterLabel>
            <FilterChip
              $active={statusFilter === undefined}
              onClick={() => setStatusFilter(undefined)}
            >
              <ClockIcon size={10} />
              All
            </FilterChip>
            <FilterChip
              $active={statusFilter === "pending"}
              $variant="pending"
              onClick={() => setStatusFilter("pending")}
            >
              <ClockIcon size={10} />
              Pending
            </FilterChip>
            <FilterChip
              $active={statusFilter === "accepted"}
              $variant="accepted"
              onClick={() => setStatusFilter("accepted")}
            >
              <SealCheckIcon size={10} />
              Accepted
            </FilterChip>
          </FilterRow>
        </RightControls>
      </Controls>

      {/* ── Scroll body ── */}
      <ScrollBody>
        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i} style={{ animationDelay: `${i * 0.09}s` }} />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <EnvelopeIcon size={36} />
            </EmptyIcon>
            <EmptyTitle>
              {searchQuery
                ? "No invitations match your search"
                : `No ${statusFilter ?? ""} invitations`}
            </EmptyTitle>
            <EmptySub>
              {searchQuery
                ? "Try a different key or ID"
                : directionFilter === "incoming"
                  ? "Contact requests from others will appear here"
                  : directionFilter === "sent"
                    ? "Requests you've sent will appear here"
                    : "Contact invitations will appear here"}
            </EmptySub>
          </EmptyState>
        ) : (
          <>
            <SectionLabelRow>
              <SectionLabelText>
                {directionFilter === "all"
                  ? "All Invitations"
                  : directionFilter === "incoming"
                    ? "Incoming Requests"
                    : "Sent Requests"}{" "}
                · {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </SectionLabelText>
              <SectionDivider />
            </SectionLabelRow>

            {paginated.map((invite, idx) => {
              const direction = getDirection(invite);
              const isProcessing = processingIds.has(invite.id);
              const isPending = invite.isPending();
              const isAccepted = invite.isAccepted();
              const isIncoming = direction === "incoming";
              const isRequester = direction === "sent";

              // The "other party" key to display prominently
              const peerKey = isIncoming
                ? invite.requesterPublicKey
                : invite.recipientPublicKey;

              // "Add to Directory" conditions:
              //   accepted + current user is the original requester + payload present
              const canAddToDirectory =
                isAccepted && isRequester && !!invite.payload;

              return (
                <InviteRowWrap
                  key={invite.id}
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  {/* Avatar */}
                  <Avatar $direction={direction}>
                    {isIncoming ? (
                      <UserCircleIcon size={18} weight="duotone" />
                    ) : (
                      <PaperPlaneTiltIcon size={16} weight="duotone" />
                    )}
                  </Avatar>

                  {/* Info */}
                  <InviteInfo>
                    <InviteKeyRow>
                      <InviteKey title={peerKey}>
                        {abbrevKey(peerKey)}
                      </InviteKey>
                      <DirectionTag $direction={direction}>
                        {isIncoming ? (
                          <>
                            <EnvelopeOpenIcon size={8} />
                            Incoming
                          </>
                        ) : (
                          <>
                            <PaperPlaneTiltIcon size={8} />
                            Sent
                          </>
                        )}
                      </DirectionTag>
                      <StatusTag $status={invite.status}>
                        {invite.status === "accepted" && (
                          <SealCheckIcon size={8} weight="fill" />
                        )}
                        {invite.status === "pending" && <ClockIcon size={8} />}
                        {invite.status}
                      </StatusTag>
                    </InviteKeyRow>

                    <InviteMeta>
                      <InviteMetaText>
                        <ClockIcon size={9} />
                        {moment(invite.timestamp).fromNow()}
                      </InviteMetaText>
                      <InviteMetaText title={invite.id}>
                        #{invite.id.slice(0, 8)}
                      </InviteMetaText>
                    </InviteMeta>
                  </InviteInfo>

                  {/* Row actions */}
                  <InviteActions className="invite-actions">
                    {/* Add to directory — accepted sent-invites with payload only */}
                    {canAddToDirectory && (
                      <AddContactBtn
                        disabled={isProcessing}
                        title="Import contact and remove invite"
                        onClick={() => handleAddToDirectory(invite)}
                      >
                        {isProcessing ? (
                          <Spinner />
                        ) : (
                          <UserCirclePlusIcon size={13} weight="bold" />
                        )}
                        Add to Directory
                      </AddContactBtn>
                    )}

                    {/* Accept — only on incoming pending invites */}
                    {isPending && isIncoming && (
                      <IconBtn
                        $variant="green"
                        title="Accept request"
                        disabled={isProcessing}
                        onClick={() => handleAccept(invite)}
                      >
                        {isProcessing ? (
                          <Spinner />
                        ) : (
                          <CheckIcon size={14} weight="bold" />
                        )}
                      </IconBtn>
                    )}

                    {/* Decline (incoming) / Cancel (sent) — only on pending */}
                    {isPending && (
                      <IconBtn
                        $variant="red"
                        title={
                          isIncoming ? "Decline request" : "Cancel request"
                        }
                        disabled={isProcessing}
                        onClick={() => handleCancelReject(invite)}
                      >
                        {isProcessing ? (
                          <Spinner />
                        ) : (
                          <XIcon size={14} weight="bold" />
                        )}
                      </IconBtn>
                    )}
                  </InviteActions>
                </InviteRowWrap>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationRow>
                <PageBtn
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ArrowLeftIcon size={12} />
                </PageBtn>
                {pageWindow.map((p, i) =>
                  p === "…" ? (
                    <PageEllipsis key={`ellipsis-${i}`}>…</PageEllipsis>
                  ) : (
                    <PageBtn
                      key={p}
                      $active={p === safePage}
                      onClick={() => typeof p === "number" && setPage(p)}
                    >
                      {p}
                    </PageBtn>
                  ),
                )}
                <PageBtn
                  disabled={safePage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ArrowRightIcon size={12} />
                </PageBtn>
              </PaginationRow>
            )}
          </>
        )}
      </ScrollBody>
    </Root>
  );
};

export default UserContactInvitations;
