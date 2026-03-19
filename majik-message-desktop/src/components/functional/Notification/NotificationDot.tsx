// components/NotificationDot.tsx
import { useMajikahNotifications } from "@/components/majikah-notification-wrapper/use-majikah-notifications";
import theme from "@/globals/theme";
import React from "react";
import styled, { keyframes } from "styled-components";
import type { Keyframes } from "styled-components/dist/types";

const pulse = (color: string): Keyframes => keyframes`
  0% {
    box-shadow: 0 0 0 0 ${color}66;
  }
  50% {
    box-shadow: 0 0 0 10px ${color}22;
  }
  100% {
    box-shadow: 0 0 0 0 ${color}66;
  }
`;

const DotWrapper = styled.div<{ color: string; size: number }>`
  position: absolute;
  top: -2px;
  right: -4px;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  border-radius: 50%;
  background-color: ${({ color }) => color};
  color: white;
  font-size: ${({ size }) => Math.floor(size * 0.6)}px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${({ color }) => pulse(color)} 2.6s ease-in-out infinite;
  box-shadow: 0 0 0 0 ${({ color }) => color}66;
`;

interface NotificationDotProps {
  color?: string;
  size?: number;
}

export const NotificationDot: React.FC<NotificationDotProps> = ({
  color = theme.colors.error,
  size = 16,
}) => {
  const { unreadCount } = useMajikahNotifications();

  if (unreadCount === 0) return null;

  return (
    <DotWrapper color={color} size={size}>
      {unreadCount}
    </DotWrapper>
  );
};
