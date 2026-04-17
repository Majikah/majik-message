import styled, { keyframes } from "styled-components";
import {
  WarningDiamondIcon,
  WarningCircleIcon,
  InfoIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = "warning" | "error" | "danger" | "info" | "success";

interface DynamicAlertBannerProps {
  title: string;
  description: string;
  level?: AlertLevel;
}

// ─── Theme map ────────────────────────────────────────────────────────────────

const levelTheme: Record<
  AlertLevel,
  { bg: string; border: string; color: string }
> = {
  warning: {
    bg: "rgba(186, 117, 23, 0.09)",
    border: "rgba(186, 117, 23, 0.28)",
    color: "#BA7517",
  },
  error: {
    bg: "rgba(162, 45, 45, 0.08)",
    border: "rgba(162, 45, 45, 0.22)",
    color: "#A32D2D",
  },
  danger: {
    bg: "rgba(220, 60, 60, 0.07)",
    border: "rgba(220, 60, 60, 0.22)",
    color: "#e05050",
  },
  info: {
    bg: "rgba(24, 95, 165, 0.07)",
    border: "rgba(24, 95, 165, 0.20)",
    color: "#185FA5",
  },
  success: {
    bg: "rgba(59, 109, 17, 0.07)",
    border: "rgba(59, 109, 17, 0.20)",
    color: "#3B6D11",
  },
};

// ─── Icon renderer ────────────────────────────────────────────────────────────

const renderIcon = (level: AlertLevel) => {
  switch (level) {
    case "warning":
      return <WarningDiamondIcon size={15} weight="fill" />;
    case "error":
      return <XCircleIcon size={15} weight="fill" />;
    case "danger":
      return <WarningCircleIcon size={15} weight="fill" />;
    case "info":
      return <InfoIcon size={15} weight="fill" />;
    case "success":
      return <CheckCircleIcon size={15} weight="fill" />;
  }
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const BannerWrapper = styled.div<{ $level: AlertLevel }>`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ $level }) => levelTheme[$level].bg};
  border: 1px solid ${({ $level }) => levelTheme[$level].border};
  margin-bottom: 2em;
  animation: ${fadeIn} 0.2s ease;
`;

const BannerIcon = styled.div<{ $level: AlertLevel }>`
  flex-shrink: 0;
  color: ${({ $level }) => levelTheme[$level].color};
  margin-top: 1px;
`;

const BannerBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const BannerTitle = styled.p<{ $level: AlertLevel }>`
  font-size: 11px;
  font-weight: 700;
  color: ${({ $level }) => levelTheme[$level].color};
  margin: 0;
  letter-spacing: 0.02em;
`;

const BannerText = styled.p`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.5;
  opacity: 0.8;
`;

// ─── Component ────────────────────────────────────────────────────────────────

const DynamicAlertBanner = ({
  title,
  description,
  level = "info",
}: DynamicAlertBannerProps) => {
  return (
    <BannerWrapper $level={level}>
      <BannerIcon $level={level}>{renderIcon(level)}</BannerIcon>
      <BannerBody>
        <BannerTitle $level={level}>{title}</BannerTitle>
        <BannerText>{description}</BannerText>
      </BannerBody>
    </BannerWrapper>
  );
};

export default DynamicAlertBanner;
