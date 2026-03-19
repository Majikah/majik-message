// UserFileQuota.tsx
"use client";

import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import type { FileQuota } from "../majikah-session-wrapper/types/files-api";
import { DatabaseIcon } from "@phosphor-icons/react";

// ─── Animations ───────────────────────────────────────────────────────────────

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

const pulseOpacity = keyframes`
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.85; }
`;

// ─── Styled components ────────────────────────────────────────────────────────

const Card = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 14px;
  padding: 16px 18px;
  user-select: none;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const LabelGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconBox = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  svg {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const CardTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const UsageLabel = styled.div<{ $critical: boolean; $warn: boolean }>`
  font-family: "DM Mono", monospace;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${({ $critical, $warn, theme }) =>
    $critical ? "#f06449" : $warn ? "#f5a623" : theme.colors.primary};
`;

const UsageMuted = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

const SkeletonPill = styled.div`
  width: 64px;
  height: 14px;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  animation: ${pulseOpacity} 1.4s ease-in-out infinite;
`;

const TrackWrap = styled.div`
  height: 6px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 99px;
  overflow: hidden;
`;

const TrackFill = styled.div<{
  $pct: number;
  $critical: boolean;
  $warn: boolean;
}>`
  height: 100%;
  border-radius: 99px;
  width: ${({ $pct }) => Math.min($pct, 100)}%;
  background: ${({ $critical, $warn, theme }) =>
    $critical
      ? "linear-gradient(90deg, #f06449 0%, #f5a623 100%)"
      : $warn
        ? "linear-gradient(90deg, #f5a623 0%, #fde68a 100%)"
        : `linear-gradient(90deg, ${theme.colors.primary} 0%, #a78bfa 100%)`};
  transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.22) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 2.2s ease-in-out infinite;
  }
`;

const StatRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 10px;
`;

const StatPill = styled.div`
  flex: 1;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  gap: 7px;
`;

const StatDot = styled.div<{ $color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const StatText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StatVal = styled.span`
  font-family: "DM Mono", monospace;
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1;
`;

const StatLabel = styled.span`
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserFileQuotaProps {
  quota: FileQuota | null;
  isLoading?: boolean;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const UserFileQuota: React.FC<UserFileQuotaProps> = ({
  quota,
  isLoading = false,
  className,
}) => {
  // Defer fill so the CSS width transition actually fires on mount
  const [fillPct, setFillPct] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setFillPct(quota?.usedPct ?? 0), 80);
    return () => clearTimeout(t);
  }, [quota]);

  const rawPct = quota?.usedPct ?? 0;
  const isCritical = rawPct >= 90;
  const isWarn = rawPct >= 70 && !isCritical;
  const accentColor = isCritical ? "#f06449" : isWarn ? "#f5a623" : "#7c6af7";

  const stats = [
    {
      dot: accentColor,
      val: `${quota?.usedMB.toFixed(1) ?? "–"} MB`,
      label: "Used",
    },
    { dot: "#f5a623", val: `${rawPct.toFixed(1)}%`, label: "of Quota" },
    {
      dot: "#3ecf8e",
      val: `${quota?.availableMB.toFixed(1) ?? "–"} MB`,
      label: "Available",
    },
  ];

  return (
    <Card className={className}>
      <HeaderRow>
        <LabelGroup>
          <IconBox>
            <DatabaseIcon size={24} />
          </IconBox>
          <CardTitle>Storage Quota</CardTitle>
        </LabelGroup>

        {isLoading ? (
          <SkeletonPill />
        ) : (
          <UsageLabel $critical={isCritical} $warn={isWarn}>
            <span>{quota?.usedMB.toFixed(1) ?? "–"} MB</span>
            <UsageMuted>/</UsageMuted>
            <span>{quota?.limitMB.toFixed(0) ?? "–"} MB</span>
          </UsageLabel>
        )}
      </HeaderRow>

      <TrackWrap>
        <TrackFill
          $pct={isLoading ? 0 : fillPct}
          $critical={isCritical}
          $warn={isWarn}
        />
      </TrackWrap>

      <StatRow>
        {stats.map((s) => (
          <StatPill key={s.label}>
            <StatDot $color={s.dot} />
            <StatText>
              <StatVal>{isLoading ? "…" : s.val}</StatVal>
              <StatLabel>{s.label}</StatLabel>
            </StatText>
          </StatPill>
        ))}
      </StatRow>
    </Card>
  );
};

export default UserFileQuota;
