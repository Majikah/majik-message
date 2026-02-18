import styled from "styled-components";
import { useEffect, useState, useCallback } from "react";
import { EnvelopeCacheItem, MajikContact } from "@majikah/majik-message";
import DynamicPlaceholder from "../foundations/DynamicPlaceholder";

import { toast } from "sonner";
import { UtilityButton } from "../../globals/buttons";

import CBaseMessage from "../base/CBaseMessage";
import AnimatedIconToggle from "../functional/AnimatedIconToggle";
import theme from "../../globals/theme";
import {
  ClockCounterClockwiseIcon,
  HandPalmIcon,
  ScanIcon,
} from "@phosphor-icons/react";
import { useDispatch, useSelector } from "react-redux";
import {
  ReduxSystemRootState,
  toggleScannerMode,
} from "../../redux/slices/system";

import ConfirmationButton from "../foundations/ConfirmationButton";
import { SectionSubTitle } from "../../globals/styled-components";
import { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";
import ThemeToggle from "../functional/ThemeToggle";
import GuideHelper from "../functional/GuideHelper";

// ─── Layout ───────────────────────────────────────────────────────────────────
const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

// ─── Panel header ─────────────────────────────────────────────────────────────
const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const PanelSubtitle = styled.p`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.5;
  letter-spacing: 0.03em;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

// ─── Scrollable body ──────────────────────────────────────────────────────────
const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px 24px;

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.colors.secondaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 8px 0;
  width: inherit;
  gap: 8px;
`;

const BodyContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 8px 0;
  width: inherit;
  gap: 8px;
`;

const EmptyContainer = styled(BodyContainer)`
  max-width: 600px;
`;
interface ScannerPanelProps {
  majik: MajikMessageDatabase;
  showHistoryLog?: boolean;
}

const PAGE = 50;

const ScannerPanel: React.FC<ScannerPanelProps> = ({
  majik,
  showHistoryLog = true,
}) => {
  const dispatch = useDispatch();

  const [myAccount] = useState<MajikContact | null>(() => {
    const userAccount = majik.getActiveAccount();
    if (!userAccount) return null;
    return userAccount;
  });

  const [history, setHistory] = useState<EnvelopeCacheItem[]>([]);
  const [offset, setOffset] = useState(0);
  const scannerMode = useSelector(
    (state: ReduxSystemRootState) => state.system.scannerMode ?? false,
  );

  const loadPage = useCallback(
    async (start = 0) => {
      if (!majik?.listCachedEnvelopes) return;
      try {
        const items = await majik.listCachedEnvelopes(start, PAGE);
        const mapped = items.map((it: any) => ({
          id: it.id,
          timestamp: it.timestamp,
          source: it.source || window.location.hostname,
          message: undefined,
          envelope: it.envelope,
        }));

        if (start === 0) setHistory(mapped);
        else setHistory((prev) => [...prev, ...mapped]);

        return items.length;
      } catch (e) {
        console.warn("Failed to load cache page", e);
        return 0;
      }
    },
    [majik],
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  const handleDecryptMessage = async (item: EnvelopeCacheItem) => {
    if (!majik) return;
    try {
      const decrypted = await majik.decryptEnvelope(item.envelope);

      setHistory((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, message: decrypted } : p)),
      );
    } catch (e) {
      toast.error("Unauthorized Access", {
        description: "No matching account to decrypt this envelope.",
        id: `toast-error-decrypt`,
      });
      console.warn("Decrypt failed", e);
    }
  };

  const handleToggleScanning = async (enable: boolean) => {
    if (!majik) return;

    if (enable) {
      const passphrase = prompt("Enter passphrase for scanning:");
      if (!passphrase) {
        dispatch(toggleScannerMode(false));
        return;
      }

      chrome.runtime.sendMessage({
        type: "ENABLE_SCANNING",
        passphrase,
      });
    } else {
      chrome.runtime.sendMessage({ type: "DISABLE_SCANNING" });
    }
    dispatch(toggleScannerMode(enable));
  };

  const handleClearHistory = async () => {
    if (!majik) return;
    try {
      await majik.clearCachedEnvelopes();

      setHistory([]);
      toast.success("History Cleared", {
        description: "History has been cleared.",
        id: `toast-success-clear-history`,
      });
    } catch (e) {
      toast.error("Probleam Clearing History", {
        description: `Failed to clear history: ${e}`,
        id: `toast-error-clear-history`,
      });
      console.warn("History clear failed", e);
    }
  };

  if (!majik) {
    return <DynamicPlaceholder>Please create an account.</DynamicPlaceholder>;
  }

  if (!myAccount) {
    return (
      <EmptyContainer>
        <DynamicPlaceholder>
          Please create an account first to start encrypting and/or decrypting
          messages.
        </DynamicPlaceholder>
      </EmptyContainer>
    );
  }

  return (
    <Root id="section-contacts">
      <GuideHelper docsPath="https://majikah.solutions/products/majik-message/docs/contacts-documentation" />

      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>Scanner</PanelTitle>
          <PanelSubtitle>
            Automatically scan encrypted Majik Messages from your browser.
          </PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          <ThemeToggle size={45} />
          {/* Import */}
          <ConfirmationButton
            alertTextTitle="Clear History"
            disabled={!history || history.length === 0}
            onClick={handleClearHistory}
            icon={ClockCounterClockwiseIcon}
            strict
            text="Clear History"
          />
        </HeaderActions>
      </PanelHeader>
      <AnimatedIconToggle
        currentValue={scannerMode}
        onUpdate={handleToggleScanning}
        size={48}
        options={{
          on: {
            color: theme.colors.primary,
            icon: ScanIcon,
            message: "Now scanning for messages...",
          },
          off: {
            color: theme.colors.textSecondary,
            icon: HandPalmIcon,
            message: "Scanning Disabled",
          },
        }}
      />
      <Body>
        {showHistoryLog && (
          <section style={{ marginTop: 12 }}>
            <Row>
              <SectionSubTitle>History Log</SectionSubTitle>
            </Row>
            <List>
              {history.map((h, idx) => (
                <CBaseMessage
                  key={h.id || idx}
                  itemData={h}
                  index={idx}
                  onDecrypt={handleDecryptMessage}
                />
              ))}
            </List>
            <UtilityButton
              onClick={async () => {
                const next = offset + PAGE;
                const loaded = await loadPage(next);
                if (!!loaded && loaded > 0) setOffset(next);
              }}
            >
              Load more
            </UtilityButton>
          </section>
        )}
      </Body>
    </Root>
  );
};

export default ScannerPanel;
