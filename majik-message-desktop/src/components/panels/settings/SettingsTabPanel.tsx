/**
 * components/foundations/SettingsTabPanel.tsx
 *
 * A modal-scoped, index-driven tab panel — no React Router dependency.
 * Designed as the settings/preferences equivalent of TabRouter.tsx.
 *
 * Usage:
 * ```tsx
 * const tabs: SettingsTab[] = [
 *   { id: "appearance", label: "Appearance", icon: Palette, content: <AppearancePanel /> },
 *   { id: "invoices",   label: "Invoices",   icon: Receipt,  content: <InvoicesPanel /> },
 * ];
 * <SettingsTabPanel tabs={tabs} position="left" />
 * ```
 */

import React, { useState, type JSX } from "react";
import { type Icon } from "@phosphor-icons/react";
import styled, { css } from "styled-components";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsTab {
  id: string;
  label: string;
  icon?: Icon;
  content: React.ReactNode;
  /** Optional badge/dot element shown in the icon area */
  notification?: React.ReactNode;
}

export type SettingsPanelPosition = "top" | "left";

interface SettingsTabPanelProps {
  tabs: SettingsTab[];
  position?: SettingsPanelPosition;
  /** Controlled active tab id. Uncontrolled if omitted. */
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  defaultTabId?: string;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Root = styled.div<{ $position: SettingsPanelPosition }>`
  display: flex;
  flex-direction: ${({ $position }) =>
    $position === "left" ? "row" : "column"};
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

// ── Sidebar / top nav ──────────────────────────────────────────────────────

const NavList = styled.nav<{ $position: SettingsPanelPosition }>`
  display: flex;
  flex-shrink: 0;
  background-color: ${({ theme }) => theme.colors.secondaryBackground};

  ${({ $position }) =>
    $position === "left"
      ? css`
          flex-direction: column;
          width: 180px;
          border-right: 1px solid
            ${({ theme }) => theme.colors.secondaryBackground};
          padding: 0.5rem 0;

          @media (max-width: 600px) {
            width: 52px;
          }
        `
      : css`
          flex-direction: row;
          border-bottom: 1px solid
            ${({ theme }) => theme.colors.secondaryBackground};
          padding: 0 0.5rem;
          overflow-x: auto;
          &::-webkit-scrollbar {
            display: none;
          }
        `}
`;

const NavButton = styled.button<{
  $active: boolean;
  $position: SettingsPanelPosition;
}>`
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 13px;
  font-weight: 500;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};

  ${({ $position, $active, theme }) =>
    $position === "left"
      ? css`
          flex-direction: row;
          width: 100%;
          padding: 0.65rem 1rem;
          border-left: 3px solid
            ${$active ? theme.colors.primary : "transparent"};
          background-color: ${$active
            ? theme.colors.primaryBackground
            : "transparent"};

          &:hover {
            background-color: ${theme.colors.primaryBackground};
            color: ${theme.colors.primary};
          }

          @media (max-width: 600px) {
            justify-content: center;
            padding: 0.65rem 0;
          }
        `
      : css`
          flex-direction: column;
          padding: 0.6rem 1rem;
          border-bottom: 2px solid
            ${$active ? theme.colors.primary : "transparent"};
          white-space: nowrap;
          background-color: ${$active
            ? theme.colors.primaryBackground
            : "transparent"};

          &:hover {
            background-color: ${theme.colors.primaryBackground};
            color: ${theme.colors.primary};
          }
        `}
`;

const IconWrap = styled.span<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;

  svg {
    color: ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.textSecondary};
    transition: color 0.15s ease;
  }
`;

const BadgeWrap = styled.span`
  position: absolute;
  top: -3px;
  right: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
`;

const NavLabel = styled.span`
  @media (max-width: 600px) {
    display: none;
  }
`;

// ── Content area ───────────────────────────────────────────────────────────

const ContentArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.25rem 1.25rem 0.5rem;
  background-color: ${({ theme }) => theme.colors.primaryBackground};

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) =>
      theme.gradients?.primary ?? theme.colors.primary};
    border-radius: 8px;
  }
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SettingsTabPanel: React.FC<SettingsTabPanelProps> = React.memo(
  ({
    tabs,
    position = "left",
    activeTabId: controlledId,
    onTabChange,
    defaultTabId,
  }): JSX.Element => {
    const [internalId, setInternalId] = useState<string>(
      defaultTabId ?? tabs[0]?.id ?? "",
    );

    const activeId = controlledId ?? internalId;

    const handleSelect = (id: string) => {
      if (!controlledId) setInternalId(id);
      onTabChange?.(id);
    };

    const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

    return (
      <Root $position={position}>
        <NavList $position={position}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <NavButton
                key={tab.id}
                $active={isActive}
                $position={position}
                onClick={() => handleSelect(tab.id)}
                aria-selected={isActive}
                role="tab"
              >
                {tab.icon && (
                  <IconWrap $active={isActive}>
                    <tab.icon
                      size={18}
                      weight={isActive ? "fill" : "regular"}
                    />
                    {tab.notification && (
                      <BadgeWrap>{tab.notification}</BadgeWrap>
                    )}
                  </IconWrap>
                )}
                <NavLabel>{tab.label}</NavLabel>
              </NavButton>
            );
          })}
        </NavList>

        <ContentArea role="tabpanel">{activeTab?.content}</ContentArea>
      </Root>
    );
  },
);

SettingsTabPanel.displayName = "SettingsTabPanel";
