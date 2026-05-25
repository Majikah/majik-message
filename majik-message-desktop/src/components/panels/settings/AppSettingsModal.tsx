/**
 * modals/AppSettingsModal.tsx
 *
 * Multi-tab settings/preferences modal — auto-save edition.
 *
 * All changes are persisted immediately to majik.stateManager as they happen.
 * There is no "confirm" step. The modal has a single "Close" button.
 *
 * Tabs:
 *  - Appearance  → dark mode (Redux dispatch, no stateManager write needed)
 *  - Invoices    → InvoiceSettings component (owns its own persistence)
 *  - Dashboard   → autodecrypt toggle (auto-saved on toggle)
 *  - Privacy     → shareAnalytics toggle (auto-saved on toggle)
 */

import React, { useCallback, useEffect, useState, type JSX } from "react";
import { toast } from "sonner";
import styled from "styled-components";
import {
  MoonIcon,
  SunIcon,
  ShieldCheckIcon,
  PaletteIcon,
} from "@phosphor-icons/react";

import { SettingsTabPanel, type SettingsTab } from "./SettingsTabPanel";

import { useDispatch, useSelector } from "react-redux";
import { ReduxSystemRootState, toggleTheme } from "@/redux/slices/system";

import DynamicSlidingDialogue from "@/components/functional/DynamicSlidingDialogue";
import { UserAppPreferences } from "@majikah/majik-message";
import { DEFAULT_USER_APP_PREFERENCES } from "@majikah/majik-message/dist/core/client-state-manager";
import { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AppSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikMessageDatabase;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Shared styled primitives
// ---------------------------------------------------------------------------

const PanelRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const SectionTitle = styled.h3`
  margin: 0 0 0.25rem;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const RowLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RowLabelText = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const RowLabelSub = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// ── Toggle ─────────────────────────────────────────────────────────────────

const ToggleTrack = styled.button<{ $on: boolean }>`
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  flex-shrink: 0;
  position: relative;
  background: ${({ $on, theme }) =>
    $on ? theme.colors.primary : theme.colors.secondaryBackground};
  border: 1.5px solid
    ${({ $on, theme }) =>
      $on ? theme.colors.primary : theme.colors.textSecondary};
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
`;

const ToggleThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: ${({ $on }) => ($on ? "20px" : "2px")};
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${({ $on, theme }) =>
    $on ? theme.colors.primaryBackground : theme.colors.textSecondary};
  transition:
    left 0.2s ease,
    background 0.2s ease;
`;

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}
const Toggle: React.FC<ToggleProps> = ({ value, onChange, disabled }) => (
  <ToggleTrack
    $on={value}
    onClick={() => !disabled && onChange(!value)}
    role="switch"
    aria-checked={value}
  >
    <ToggleThumb $on={value} />
  </ToggleTrack>
);

// ── Theme cards ────────────────────────────────────────────────────────────

const ThemeCardRow = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const ThemeCard = styled.button<{ $active: boolean }>`
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 10px;
  border: 2px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.secondaryBackground};
  background: ${({ $active, theme }) =>
    $active ? `${theme.colors.primary}18` : theme.colors.secondaryBackground};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  font-size: 13px;
  font-weight: 500;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ---------------------------------------------------------------------------
// Panel: Appearance — dispatches to Redux immediately, no stateManager write
// ---------------------------------------------------------------------------

const AppearancePanel: React.FC = React.memo(() => {
  const dispatch = useDispatch();
  const darkMode = useSelector(
    (state: ReduxSystemRootState) => state.system.darkMode,
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", !!darkMode);
  }, [darkMode]);

  return (
    <PanelRoot>
      <SectionTitle>Color scheme</SectionTitle>
      <ThemeCardRow>
        <ThemeCard
          $active={!darkMode}
          onClick={() => dispatch(toggleTheme(false))}
          aria-pressed={!darkMode}
        >
          <SunIcon size={22} weight={!darkMode ? "fill" : "regular"} />
          Light
        </ThemeCard>
        <ThemeCard
          $active={!!darkMode}
          onClick={() => dispatch(toggleTheme(true))}
          aria-pressed={!!darkMode}
        >
          <MoonIcon size={22} weight={darkMode ? "fill" : "regular"} />
          Dark
        </ThemeCard>
      </ThemeCardRow>
    </PanelRoot>
  );
});
AppearancePanel.displayName = "AppearancePanel";

// ---------------------------------------------------------------------------
// Panel: Dashboard
// ---------------------------------------------------------------------------

// interface DashboardPanelProps {
//   prefs: UserAppPreferences["dashboard"];
//   onChange: (p: UserAppPreferences["dashboard"]) => void;
// }

// const DashboardPanel: React.FC<DashboardPanelProps> = React.memo(
//   ({ prefs, onChange }) => (
//     <PanelRoot>
//       <SectionTitle>Behaviour</SectionTitle>
//       <Row>
//         <RowLabel>
//           <RowLabelText>Auto-decrypt dashboard</RowLabelText>
//           <RowLabelSub>Decrypt account data automatically on load</RowLabelSub>
//         </RowLabel>
//         <Toggle
//           value={prefs.autodecrypt ?? false}
//           onChange={(v) => onChange({ ...prefs, autodecrypt: v })}
//         />
//       </Row>
//     </PanelRoot>
//   ),
// );
// DashboardPanel.displayName = "DashboardPanel";

// ---------------------------------------------------------------------------
// Panel: Privacy
// ---------------------------------------------------------------------------

interface PrivacyPanelProps {
  prefs: UserAppPreferences["privacy"];
  onChange: (p: UserAppPreferences["privacy"]) => void;
}

const PrivacyPanel: React.FC<PrivacyPanelProps> = React.memo(
  ({ prefs, onChange }) => (
    <PanelRoot>
      <SectionTitle>Data & diagnostics</SectionTitle>
      <Row>
        <RowLabel>
          <RowLabelText>Share analytics</RowLabelText>
          <RowLabelSub>
            Help improve the app by sending anonymous usage data
          </RowLabelSub>
        </RowLabel>
        <Toggle
          value={prefs.shareAnalytics ?? true}
          onChange={(v) => onChange({ ...prefs, shareAnalytics: v })}
        />
      </Row>
    </PanelRoot>
  ),
);
PrivacyPanel.displayName = "PrivacyPanel";

// ---------------------------------------------------------------------------
// AppSettingsModal
// ---------------------------------------------------------------------------

const DEFAULT_PREFS: UserAppPreferences = DEFAULT_USER_APP_PREFERENCES;

export const AppSettingsModal: React.FC<AppSettingsModalProps> = React.memo(
  ({ open, onOpenChange, majik }): JSX.Element => {
    const [prefs, setPrefs] = useState<UserAppPreferences>(DEFAULT_PREFS);

    // ── Load prefs on open ──────────────────────────────────────────────────
    useEffect(() => {
      if (!open) return;
      (async () => {
        try {
          const loaded = await majik.stateManager.getUserAppPreferences();
          setPrefs(loaded ?? DEFAULT_PREFS);
        } catch (err) {
          console.error("AppSettingsModal: failed to load prefs", err);
          toast.error("Failed to load settings.");
        }
      })();
    }, [open, majik]);

    // ── Auto-save: write full prefs object on every sub-section change ──────
    //
    // Pattern: optimistic local state update first, then async persist.
    // If the write fails we show a toast but don't roll back — the next
    // modal open will re-hydrate from stateManager anyway.

    // const handleDashboardChange = useCallback(
    //   async (dashboard: UserAppPreferences["dashboard"]) => {
    //     const updated: UserAppPreferences = { ...prefs, dashboard };
    //     setPrefs(updated);
    //     try {
    //       await majik.stateManager.setUserAppPreferences(updated);
    //     } catch (err) {
    //       console.error("AppSettingsModal: dashboard save failed", err);
    //       toast.error("Failed to save setting.");
    //     }
    //   },
    //   [prefs, majik],
    // );

    const handlePrivacyChange = useCallback(
      async (privacy: UserAppPreferences["privacy"]) => {
        const updated: UserAppPreferences = { ...prefs, privacy };
        setPrefs(updated);
        try {
          await majik.stateManager.setUserAppPreferences(updated);
        } catch (err) {
          console.error("AppSettingsModal: privacy save failed", err);
          toast.error("Failed to save setting.");
        }
      },
      [prefs, majik],
    );

    const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

    // ── Tabs ────────────────────────────────────────────────────────────────
    const tabs: SettingsTab[] = [
      {
        id: "appearance",
        label: "Appearance",
        icon: PaletteIcon,
        content: <AppearancePanel />,
      },

      // {
      //   id: "dashboard",
      //   label: "Dashboard",
      //   icon: GaugeIcon,
      //   content: (
      //     <DashboardPanel
      //       prefs={prefs.dashboard}
      //       onChange={handleDashboardChange}
      //     />
      //   ),
      // },
      {
        id: "privacy",
        label: "Privacy",
        icon: ShieldCheckIcon,
        content: (
          <PrivacyPanel prefs={prefs.privacy} onChange={handlePrivacyChange} />
        ),
      },
    ];

    // ── Render ──────────────────────────────────────────────────────────────
    return (
      <DynamicSlidingDialogue
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable={true}
        modal={{
          title: "Settings",
          description: "Manage your app preferences and invoice defaults.",
        }}
        buttons={{
          cancel: {
            text: "Close",
            onClick: handleClose,
            isDisabled: false,
          },
          confirm: {
            text: "Save changes",
            isDisabled: true,
            onClick: handleClose,
            hide: true,
          },
        }}
        preventDragClose={true}
        width={900}
      >
        <SettingsTabPanel tabs={tabs} position="left" />
      </DynamicSlidingDialogue>
    );
  },
);

AppSettingsModal.displayName = "AppSettingsModal";
