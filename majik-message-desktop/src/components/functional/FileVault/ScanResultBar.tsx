// ─── ScanResultBar ────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import type {
  FileScanResult,
  RuleSeverity,
  ScanRemark,
} from "@src/SDK/majik-file-scanner/majik-file-scanner";

import styled, { css, keyframes } from "styled-components";
import {
  RISK_BAND_BG,
  RISK_BAND_COLOR,
  RISK_BAND_LABEL,
  SEVERITY_COLOR,
  SEVERITY_ICON,
  SEVERITY_ORDER_DISPLAY,
} from "./_contants";

type ScanPhase = "idle" | "scanning" | "clean" | "flagged" | "error";
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

interface ScanResultBarProps {
  phase: ScanPhase;
  result: FileScanResult | null;
  context: "pre-encrypt" | "post-decrypt";
}

// ─── Scan bar ─────────────────────────────────────────────────────────────────

const scannerPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
`;

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-6px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0); max-height: 600px; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const ScanBarWrap = styled.div<{ $phase: ScanPhase }>`
  flex-shrink: 0;
  border-top: 1px solid transparent;
  transition: all 200ms ease;

  ${({ $phase }) => {
    switch ($phase) {
      case "scanning":
        return css`
          background: rgba(251, 191, 36, 0.03);
          border-color: rgba(251, 191, 36, 0.08);
        `;
      case "clean":
        return css`
          background: rgba(16, 185, 129, 0.03);
          border-color: rgba(16, 185, 129, 0.08);
        `;
      case "flagged":
        return css`
          background: rgba(239, 68, 68, 0.04);
          border-color: rgba(239, 68, 68, 0.12);
        `;
      case "error":
        return css`
          background: rgba(251, 191, 36, 0.03);
          border-color: rgba(251, 191, 36, 0.08);
        `;
      default:
        return css`
          display: none;
        `;
    }
  }}
`;

const ScanBarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 13px;
  font-family: ${FONT_MONO};
  font-size: 10px;
`;

const ScorePill = styled.div<{
  $band: FileScanResult["riskBand"];
  $pulsing?: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: -0.02em;
  flex-shrink: 0;
  border: 1.5px solid ${({ $band }) => RISK_BAND_COLOR[$band] ?? "#6b7280"};
  color: ${({ $band }) => RISK_BAND_COLOR[$band] ?? "#6b7280"};
  background: ${({ $band }) => RISK_BAND_BG[$band] ?? "transparent"};
  transition: all 200ms ease;
  ${({ $pulsing }) =>
    $pulsing &&
    css`
      opacity: 0.3;
      animation: ${scannerPulse} 1.1s ease infinite;
    `}
`;

const ScanBarMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const ScanBarStatusLine = styled.div<{
  $band?: FileScanResult["riskBand"];
  $pulsing?: boolean;
}>`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  color: ${({ $band }) =>
    $band ? (RISK_BAND_COLOR[$band] ?? "#6b7280") : "#fbbf24"};
  display: flex;
  align-items: center;
  gap: 6px;
  ${({ $pulsing }) =>
    $pulsing &&
    css`
      animation: ${scannerPulse} 1.1s ease infinite;
    `}
`;

const ScanBarSubline = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ScanDetailsToggle = styled.button<{
  $phase: ScanPhase;
  $open: boolean;
}>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 5px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 120ms ease;

  ${({ $phase, $open }) => {
    const phaseColor: Record<ScanPhase, string> = {
      clean: "#10b981",
      flagged: "#ef4444",
      error: "#f59e0b",
      scanning: "#fbbf24",
      idle: "#6b7280",
    };
    const c = phaseColor[$phase] ?? "#6b7280";
    return css`
      color: ${c};
      border-color: ${$open ? c : "transparent"};
      background: ${$open ? `rgba(0,0,0,0.12)` : "transparent"};
      opacity: 0.75;
      &:hover {
        opacity: 1;
        border-color: ${c};
        background: rgba(0, 0, 0, 0.1);
      }
    `;
  }}
`;

const ScanDetailPanel = styled.div`
  overflow: hidden;
  animation: ${slideDown} 200ms cubic-bezier(0.4, 0, 0.2, 1) both;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
`;

const ScanDetailInner = styled.div`
  padding: 10px 13px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }
`;

const ScanStatsRow = styled.div`
  display: flex;
  gap: 6px;
`;

const ScanStatCell = styled.div<{ $color?: string }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
`;

const ScanStatLabel = styled.div`
  font-family: ${FONT_MONO};
  font-size: 8px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const ScanStatValue = styled.div<{ $color?: string }>`
  font-family: ${FONT_MONO};
  font-size: 11px;
  font-weight: 700;
  color: ${({ $color }) => $color ?? "inherit"};
`;

const RemarkList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const RemarkSectionLabel = styled.div`
  font-family: ${FONT_MONO};
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  padding: 2px 0 0;
`;

const RemarkRow = styled.div<{ $severity: RuleSeverity }>`
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-left: 2px solid ${({ $severity }) => SEVERITY_COLOR[$severity]};
  animation: ${fadeIn} 150ms ease both;
`;

const RemarkIcon = styled.div<{ $severity: RuleSeverity }>`
  font-size: 10px;
  flex-shrink: 0;
  margin-top: 1px;
  color: ${({ $severity }) => SEVERITY_COLOR[$severity]};
`;

const RemarkBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RemarkRule = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RemarkDesc = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  line-height: 1.45;
`;

const RemarkDeduction = styled.div<{ $severity: RuleSeverity }>`
  flex-shrink: 0;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 700;
  color: ${({ $severity }) => SEVERITY_COLOR[$severity]};
  opacity: 0.8;
  margin-top: 1px;
`;

const InfoNote = styled.div`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
  padding: 3px 0 0 2px;
`;

// ─── Scan phase helpers ───────────────────────────────────────────────────────

function scanPhaseIcon(phase: ScanPhase): string {
  switch (phase) {
    case "scanning":
      return "◈";
    case "clean":
      return "✓";
    case "flagged":
      return "⚠";
    case "error":
      return "~";
    default:
      return "";
  }
}

function scanPhaseLabel(phase: ScanPhase): string {
  switch (phase) {
    case "scanning":
      return "Scanning…";
    case "clean":
      return "Scan clean";
    case "flagged":
      return "Threat detected";
    case "error":
      return "Scan inconclusive";
    default:
      return "";
  }
}

function scanBarShortLine(
  phase: ScanPhase,
  result: FileScanResult | null,
): string {
  if (phase === "scanning")
    return "Running YARA scan locally — no data leaves your device…";
  if (!result) return "";
  if (phase === "clean")
    return `${result.remarks.length === 0 ? "No threats detected" : "All findings informational only"} · ${result.durationMs.toFixed(0)}ms`;
  if (phase === "flagged") {
    const top = result.remarks[0];
    return top
      ? `${result.remarks.length} rule(s) matched · worst: ${top.severity.toUpperCase()} [${top.rule}]`
      : `${result.remarks.length} rule(s) matched`;
  }
  if (phase === "error") return "Scan could not complete — result inconclusive";
  return "";
}

export const ScanResultBar: React.FC<ScanResultBarProps> = ({
  phase,
  result,
  context,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (phase === "scanning") setOpen(false);
  }, [phase]);

  if (phase === "idle") return null;

  const canExpand = phase !== "scanning" && result !== null;
  const actionableCount =
    result?.remarks.filter((r) => r.severity !== "info").length ?? 0;
  const infoCount =
    result?.remarks.filter((r) => r.severity === "info").length ?? 0;

  return (
    <ScanBarWrap $phase={phase}>
      <ScanBarRow>
        {phase !== "scanning" && result ? (
          <ScorePill $band={result.riskBand}>{result.score}</ScorePill>
        ) : (
          <ScorePill $band="clean" $pulsing>
            —
          </ScorePill>
        )}

        <ScanBarMeta>
          {phase === "scanning" ? (
            <ScanBarStatusLine $pulsing>
              {scanPhaseIcon(phase)} {scanPhaseLabel(phase)}
            </ScanBarStatusLine>
          ) : result ? (
            <ScanBarStatusLine $band={result.riskBand}>
              {scanPhaseIcon(phase)}&nbsp;
              {RISK_BAND_LABEL[result.riskBand]}
              &nbsp;·&nbsp;
              <span style={{ fontWeight: 400, opacity: 0.65 }}>
                {context === "pre-encrypt" ? "Pre-encrypt" : "Post-decrypt"}{" "}
                scan
              </span>
            </ScanBarStatusLine>
          ) : null}
          <ScanBarSubline>{scanBarShortLine(phase, result)}</ScanBarSubline>
        </ScanBarMeta>

        {canExpand && (
          <ScanDetailsToggle
            $phase={phase}
            $open={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "▲ Hide" : "▼ Details"}
          </ScanDetailsToggle>
        )}
      </ScanBarRow>

      {open && result && (
        <ScanDetailPanel>
          <ScanDetailInner>
            <ScanStatsRow>
              <ScanStatCell>
                <ScanStatLabel>Score</ScanStatLabel>
                <ScanStatValue $color={RISK_BAND_COLOR[result.riskBand]}>
                  {result.score}/100
                </ScanStatValue>
              </ScanStatCell>
              <ScanStatCell>
                <ScanStatLabel>Risk</ScanStatLabel>
                <ScanStatValue $color={RISK_BAND_COLOR[result.riskBand]}>
                  {RISK_BAND_LABEL[result.riskBand]}
                </ScanStatValue>
              </ScanStatCell>
              <ScanStatCell>
                <ScanStatLabel>Findings</ScanStatLabel>
                <ScanStatValue
                  $color={actionableCount > 0 ? "#ef4444" : "#10b981"}
                >
                  {actionableCount > 0 ? `${actionableCount} flagged` : "None"}
                </ScanStatValue>
              </ScanStatCell>
              <ScanStatCell>
                <ScanStatLabel>Duration</ScanStatLabel>
                <ScanStatValue>{result.durationMs.toFixed(0)}ms</ScanStatValue>
              </ScanStatCell>
            </ScanStatsRow>

            {result.remarks.length === 0 ? (
              <InfoNote>
                ✓ File passed all YARA rules — no signatures matched.
              </InfoNote>
            ) : (
              <RemarkList>
                {SEVERITY_ORDER_DISPLAY.filter((sev) => sev !== "info").map(
                  (sev) => {
                    const group = result.remarks.filter(
                      (r) => r.severity === sev,
                    );
                    if (group.length === 0) return null;
                    return (
                      <React.Fragment key={sev}>
                        <RemarkSectionLabel>
                          {SEVERITY_ICON[sev]} {sev.toUpperCase()} · −
                          {group[0].deduction} pts each
                        </RemarkSectionLabel>
                        {group.map((remark: ScanRemark) => (
                          <RemarkRow
                            key={remark.rule}
                            $severity={remark.severity}
                          >
                            <RemarkIcon $severity={remark.severity}>
                              {SEVERITY_ICON[remark.severity]}
                            </RemarkIcon>
                            <RemarkBody>
                              <RemarkRule>{remark.rule}</RemarkRule>
                              <RemarkDesc>{remark.description}</RemarkDesc>
                            </RemarkBody>
                            <RemarkDeduction $severity={remark.severity}>
                              −{remark.deduction}
                            </RemarkDeduction>
                          </RemarkRow>
                        ))}
                      </React.Fragment>
                    );
                  },
                )}

                {infoCount > 0 && (
                  <InfoNote>
                    ⚪ {infoCount} informational finding
                    {infoCount > 1 ? "s" : ""} (no score impact) ·{" "}
                    {result.remarks
                      .filter((r) => r.severity === "info")
                      .map((r) => r.rule)
                      .join(", ")}
                  </InfoNote>
                )}
              </RemarkList>
            )}
          </ScanDetailInner>
        </ScanDetailPanel>
      )}
    </ScanBarWrap>
  );
};

export default ScanResultBar;
