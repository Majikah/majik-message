/**
 * CallMessageRenderer.tsx
 *
 * Renders a [call:<uuid>] token embedded in a chat message.
 * Mirrors the ChatImageRenderer pattern: lazy-loads via IntersectionObserver,
 * shows a skeleton while fetching, and fires onReady once the record is loaded.
 *
 * Call records are only available for 24 h after the call ends (server-enforced).
 * After that window the component renders an "unavailable" fallback.
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  PhoneIcon,
  PhoneSlashIcon,
  PhoneXIcon,
  UsersThreeIcon,
  ClockIcon,
  StarIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react";

import {
  CallEndReason,
  formatCallDuration,
  isCallRecordDisplayable,
  MajikCallRecordSummary,
} from "../majikah-session-wrapper/calls/majik-call-record/types";
import { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";

// ─── Local tokens ─────────────────────────────────────────────────────────────

const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Animations ───────────────────────────────────────────────────────────────

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
`;

// ─── Styled components ────────────────────────────────────────────────────────

const CallBubble = styled.div<{ $isOwn: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  min-width: 200px;
  width: fit-content;
  position: relative;
  background: ${({ theme }) => theme.colors.secondaryBackground};

  ${({ $isOwn }) =>
    $isOwn
      ? css`
          border-bottom-right-radius: 4px;
        `
      : css`
          border-bottom-left-radius: 4px;
        `}
`;

const CallHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CallIconWrap = styled.div<{ $color: string }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${({ $color }) => $color}22;
  color: ${({ $color }) => $color};
`;

const CallHeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const CallType = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1.2;
`;

const CallStatus = styled.span<{ $color: string }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
  opacity: 0.8;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  opacity: 0.5;
  margin: 0 -2px;
`;

const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const StatLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  white-space: nowrap;
`;

const RatingBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const RatingBar = styled.div`
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  overflow: hidden;
`;

const RatingFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: #f59e0b;
  border-radius: 2px;
`;

const RatingLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  color: #f59e0b;
  min-width: 28px;
  text-align: right;
`;

const SkeletonBubble = styled.div`
  min-width: 200px;
  height: 80px;
  border-radius: 16px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 25%,
    rgba(255, 255, 255, 0.08) 37%,
    rgba(255, 255, 255, 0.04) 63%
  );
  background-size: 400% 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

const ExpiredBubble = styled.div<{ $isOwn: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid rgba(255, 255, 255, 0.05);
  opacity: 0.5;

  ${({ $isOwn }) =>
    $isOwn
      ? css`
          border-bottom-right-radius: 4px;
        `
      : css`
          border-bottom-left-radius: 4px;
        `}
`;

const ExpiredLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface EndReasonMeta {
  label: string;
  color: string;
  Icon: React.ElementType;
}

function getEndReasonMeta(reason: CallEndReason): EndReasonMeta {
  switch (reason) {
    case "local_ended":
    case "remote_ended":
      return { label: "Ended", color: "#22c55e", Icon: PhoneIcon };
    case "rejected":
      return { label: "Declined", color: "#ef4444", Icon: PhoneXIcon };
    case "missed":
      return { label: "Missed", color: "#f59e0b", Icon: PhoneSlashIcon };
    case "busy":
      return { label: "Busy", color: "#f59e0b", Icon: PhoneSlashIcon };
    case "network_error":
      return { label: "Network error", color: "#ef4444", Icon: WifiSlashIcon };
    case "timeout":
      return { label: "No answer", color: "#f59e0b", Icon: PhoneSlashIcon };
    default:
      return { label: "Ended", color: "#22c55e", Icon: PhoneIcon };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadPhase = "idle" | "loading" | "ready" | "expired" | "error";

export interface CallReadyInfo {
  summary: MajikCallRecordSummary;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CallMessageRendererProps {
  majik: MajikMessageDatabase;
  callId: string;
  /** Needed for the 24 h displayability check */
  messageTimestamp: string;
  isOwn: boolean;
  onReady?: (info: CallReadyInfo) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CallMessageRenderer: React.FC<CallMessageRendererProps> = ({
  majik,
  callId,
  messageTimestamp,
  isOwn,
  onReady,
}) => {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [summary, setSummary] = useState<MajikCallRecordSummary | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // ── Fetch pipeline ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    setPhase("loading");

    // 24 h client-side guard
    if (!isCallRecordDisplayable(messageTimestamp)) {
      setPhase("expired");
      return;
    }

    try {
      const callRecordSummary = await majik.getCallRecord(callId);

      if (!callRecordSummary) {
        setPhase("expired");
        return;
      }

      setSummary(callRecordSummary);
      setPhase("ready");
      onReadyRef.current?.({ summary: callRecordSummary });
    } catch (err) {
      console.warn("[CallMessageRenderer] fetch error:", err);
      // Degrade to expired/unavailable rather than an error state —
      // call records are ephemeral so this is the expected failure mode.
      hasFetchedRef.current = false;
      setPhase("expired");
    }
  }, [callId, messageTimestamp]);

  // ── IntersectionObserver — lazy trigger ───────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [load]);

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (phase === "idle" || phase === "loading") {
    return <SkeletonBubble ref={wrapperRef} />;
  }

  // ── Expired / unavailable ─────────────────────────────────────────────────
  if (phase === "expired" || phase === "error" || !summary) {
    return (
      <ExpiredBubble ref={wrapperRef} $isOwn={isOwn}>
        <PhoneIcon size={14} opacity={0.4} />
        <ExpiredLabel>Call record unavailable</ExpiredLabel>
      </ExpiredBubble>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const { label, color, Icon } = getEndReasonMeta(summary.endReason);
  const isGroup = summary.topology === "sfu";
  const durationLabel =
    summary.totalDurationMs > 0
      ? formatCallDuration(summary.totalDurationMs)
      : null;

  return (
    <CallBubble ref={wrapperRef} $isOwn={isOwn}>
      <CallHeader>
        <CallIconWrap $color={color}>
          <Icon size={16} weight="fill" />
        </CallIconWrap>
        <CallHeaderText>
          <CallType>{isGroup ? "Group Call" : "Audio Call"}</CallType>
          <CallStatus $color={color}>{label}</CallStatus>
        </CallHeaderText>
      </CallHeader>

      <Divider />

      <StatsRow>
        {durationLabel && (
          <StatItem>
            <ClockIcon size={12} opacity={0.5} />
            <StatLabel>{durationLabel}</StatLabel>
          </StatItem>
        )}
        {isGroup && (
          <StatItem>
            <UsersThreeIcon size={12} opacity={0.5} />
            <StatLabel>
              {summary.totalParticipantCount}{" "}
              {summary.totalParticipantCount === 1
                ? "participant"
                : "participants"}
            </StatLabel>
          </StatItem>
        )}
      </StatsRow>

      {summary.averageRating !== null && (
        <>
          <Divider />
          <RatingBadge>
            <StarIcon size={11} color="#f59e0b" weight="fill" />
            <RatingBar>
              <RatingFill $pct={summary.averageRating} />
            </RatingBar>
            <RatingLabel>{summary.averageRating}</RatingLabel>
          </RatingBadge>
        </>
      )}
    </CallBubble>
  );
};
