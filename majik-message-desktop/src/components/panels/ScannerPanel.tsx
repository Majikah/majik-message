import styled from "styled-components";
import { useEffect, useState, useCallback } from "react";
import { type EnvelopeCacheItem } from "@majikah/majik-message";
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
  type ReduxSystemRootState,
  toggleScannerMode,
} from "../../redux/slices/system";

import ConfirmationButton from "../foundations/ConfirmationButton";
import {
  SectionSubTitle,
  SectionTitleFrame,
} from "../../globals/styled-components";
import type { MajikMessageDatabase } from "../majik-context-wrapper/majik-message-database";

const Container = styled.div`
  width: inherit;
  height: 100%;
  padding: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
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
interface ScannerPanelProps {
  majik?: MajikMessageDatabase | null;
  showHistoryLog?: boolean;
}

const PAGE = 50;

const ScannerPanel: React.FC<ScannerPanelProps> = ({
  majik,
  showHistoryLog = true,
}) => {
  const dispatch = useDispatch();

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDecryptMessage = async (
    item: EnvelopeCacheItem,
  ): Promise<void> => {
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

  const handleToggleScanning = async (enable: boolean): Promise<void> => {
    if (!majik) return;

    if (enable) {
      // const passphrase = prompt('Enter passphrase for scanning:')
      // if (!passphrase) {
      //   dispatch(toggleScannerMode(false))
      //   return
      // }
      // chrome.runtime.sendMessage({
      //   type: 'ENABLE_SCANNING',
      //   passphrase
      // })
    } else {
      // chrome.runtime.sendMessage({ type: 'DISABLE_SCANNING' })
    }
    dispatch(toggleScannerMode(enable));
  };

  const handleClearHistory = async (): Promise<void> => {
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

  return (
    <Container>
      <SectionTitleFrame>
        <Row>
          <h2>Scanner</h2>
          <ConfirmationButton
            alertTextTitle="Clear History"
            disabled={!history || history.length === 0}
            onClick={handleClearHistory}
            icon={{ icon: ClockCounterClockwiseIcon }}
            strict
            text="Clear History"
          />
        </Row>
      </SectionTitleFrame>
      <AnimatedIconToggle
        currentValue={scannerMode}
        onUpdate={handleToggleScanning}
        size={48}
        options={{
          on: {
            color: theme.colors.brand.green,
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
    </Container>
  );
};

export default ScannerPanel;
