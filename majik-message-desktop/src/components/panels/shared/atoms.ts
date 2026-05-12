/**
 * shared/atoms.ts
 *
 * All styled-components that are used by more than one sub-component, plus
 * constants and small pure helpers that have no external dependencies.
 * Nothing in here should import from sibling files.
 */

import styled, { keyframes } from "styled-components";

// ─── Animations ────────────────────────────────────────────────────────────────

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

export const glowPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
`;

// ─── Shared atoms ──────────────────────────────────────────────────────────────

export const SpinIcon = styled.span`
  display: inline-flex;
  animation: ${spin} 0.9s linear infinite;
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  overflow: hidden;
`;

export const FieldRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  &:last-child {
    border-bottom: none;
  }
`;

export const FieldIcon = styled.div`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  padding-top: 1px;
`;

export const FieldContent = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const FieldLabel = styled.span`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

export const FieldValue = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  word-break: break-all;
  line-height: 1.4;
`;

export const FieldMono = styled(FieldValue)`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  opacity: 0.7;
`;

export const FieldCopyBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.3;
  flex-shrink: 0;
  &:hover {
    opacity: 0.8;
  }
`;

export const EmptyField = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.25;
  font-style: italic;
`;

export const SectionWrap = styled.div`
  margin-bottom: 12px;
  height: auto;
`;

export const SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 6px;
`;

export const SectionTitle = styled.h4`
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 5px;
`;

export const SectionAction = styled.button`
  font-size: 10px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.8;
  &:hover {
    opacity: 1;
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

export const IconBtn = styled.button`
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
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

export const ImportModeToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
`;

export const ModeToggleButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.secondaryBackground};
  background: ${({ theme, $active }) =>
    $active ? `${theme.colors.primary}18` : theme.colors.secondaryBackground};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  letter-spacing: 0.02em;
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ─── Constants ─────────────────────────────────────────────────────────────────

export const REVOKE_LOCKOUT_MS = 30 * 24 * 60 * 60 * 1000;

export const ACTIVE_SESSION_STATUSES = new Set([
  "Not Started",
  "In Progress",
  "In Review",
  "Resubmitted",
]);

export const STAGE_LABELS: Record<string, string> = {
  id_verification: "ID Verification",
  liveness: "Liveness Check",
  face_match: "Face Match",
  ip_analysis: "IP Analysis",
};

export const ALL_STAGES = [
  "id_verification",
  "liveness",
  "face_match",
  "ip_analysis",
];

// ─── Pure helpers ──────────────────────────────────────────────────────────────

export const copyToClipboard = (text: string, _label = "Copied") => {
  navigator.clipboard.writeText(text).then(() => {
    // toast imported at call site to avoid circular deps
  });
};

export function tierGradient(tier: string): string {
  switch (tier.toLowerCase()) {
    case "trusted":
      return "linear-gradient(135deg,#34d399,#10b981)";
    case "enhanced":
      return "linear-gradient(135deg,#f97316,#ea580c)";
    case "verified":
      return "linear-gradient(135deg,#60a5fa,#3b82f6)";
    case "basic":
      return "linear-gradient(135deg,#fbbf24,#d97706)";
    default:
      return "linear-gradient(135deg,#4b5563,#374151)";
  }
}
