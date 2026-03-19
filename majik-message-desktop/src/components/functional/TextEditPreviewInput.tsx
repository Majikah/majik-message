import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { downloadBlob } from "../../utils/utils";

import { toast } from "sonner";
import { sendNotification } from "@tauri-apps/plugin-notification";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = "encrypt" | "decrypt";

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Root ─────────────────────────────────────────────────────────────────────
const Root = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

// ─── Section label row ────────────────────────────────────────────────────────
/**
 * Houses "Message Content" mono label on the left and the mode pill
 * switcher on the right. Matches the pattern used in the Recipients
 * section label row above it in MessagePanel.
 */
const ContentHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 10px;
`;

const ContentLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
`;

// ─── Mode pill switcher ───────────────────────────────────────────────────────
/**
 * Replaces the old Toggle (ActionButton) with a pill switcher so both
 * modes are always visible — users can see where they are and switch
 * without wondering if click = "switch to" or "currently in".
 *
 * Encrypt active → primary blue fill
 * Decrypt active → green fill
 */
const ModeSwitcher = styled.div`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 9px;
  padding: 3px;
  gap: 2px;
`;

const ModePill = styled.button<{ $active: boolean; $mode: Mode }>`
  padding: 5px 16px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  border: none;
  transition:
    background 150ms ease,
    color 150ms ease;

  ${({ $active, $mode, theme }) =>
    $active
      ? $mode === "encrypt"
        ? css`
            background: ${theme.colors.primary};
            color: ${theme.colors.primaryBackground};
          `
        : css`
            background: ${theme.colors.brand.green};
            color: ${theme.colors.primaryBackground};
          `
      : css`
          background: transparent;
          color: ${theme.colors.textSecondary};
          &:hover {
            color: ${theme.colors.textPrimary};
          }
        `}
`;

// ─── Two-column editor grid ───────────────────────────────────────────────────
const EditorGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  animation: ${fadeIn} 180ms cubic-bezier(0.4, 0, 0.2, 1) both;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

// ─── Editor pane ──────────────────────────────────────────────────────────────
/**
 * Each pane is a unified bordered container: pane header → textarea → footer.
 * The active INPUT pane gets a mode-tinted accent border.
 * The read-only OUTPUT pane keeps the neutral border so the accent
 * always indicates "this is where you type".
 */
const EditorPane = styled.div<{ $accent?: "encrypt" | "decrypt" | null }>`
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid
    ${({ $accent, theme }) => {
      if ($accent === "encrypt") return theme.colors.primary;
      if ($accent === "decrypt") return theme.colors.brand.green;
      return theme.colors.primaryBackground;
    }};
  transition: border-color 200ms ease;
`;

// ─── Pane header ──────────────────────────────────────────────────────────────
const PaneHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primarySoft};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const PaneLabel = styled.span<{ $mode?: Mode | null }>`
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ $mode, theme }) => {
    if ($mode === "encrypt") return theme.colors.primary;
    if ($mode === "decrypt") return theme.colors.brand?.green ?? "#10b981";
    return theme.colors.textSecondary;
  }};
  opacity: ${({ $mode }) => ($mode ? 0.8 : 0.4)};
  transition:
    color 200ms ease,
    opacity 200ms ease;
`;

const PaneStatusBadge = styled.span<{ $mode: Mode | null }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  transition: all 200ms ease;

  ${({ $mode, theme }) =>
    $mode === "encrypt"
      ? css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border: 1px solid ${theme.colors.primary};
        `
      : $mode === "decrypt"
        ? css`
            background: rgba(134, 185, 16, 0.1);
            color: ${theme.colors.brand.green};
            border: 1px solid ${theme.colors.brand.green};
          `
        : css`
            background: rgba(255, 255, 255, 0.04);
            color: ${theme.colors.textSecondary};
            border: 1px solid ${theme.colors.primaryBackground};
            opacity: 0.45;
          `}
`;

// ─── Textarea ─────────────────────────────────────────────────────────────────
const PaneTextarea = styled.textarea<{ $readOnly?: boolean }>`
  flex: 1;
  resize: none;
  padding: 14px;
  font-family: ${FONT_MONO};
  font-size: 12px;
  line-height: 1.65;
  border: none;
  outline: none;
  min-height: 220px;
  width: 100%;
  background: transparent;
  color: ${({ $readOnly, theme }) =>
    $readOnly ? theme.colors.textSecondary : theme.colors.textPrimary};
  cursor: ${({ $readOnly }) => ($readOnly ? "default" : "text")};

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.colors.primaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primaryBackground};
    border-radius: 4px;
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.3;
  }
`;

// ─── Pane footer (action buttons) ─────────────────────────────────────────────
const PaneFooter = styled.div`
  display: flex;
  gap: 5px;
  padding: 7px 10px;
  border-top: 1px solid ${({ theme }) => theme.colors.primarySoft};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

/**
 * Flat action buttons — lighter than global ExportButton/ButtonPrimaryConfirm
 * since they sit inside a bordered pane and need less visual weight.
 */
const PaneBtn = styled.button`
  flex: 1;
  padding: 6px 0;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all 100ms ease;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
    border-color: ${({ theme }) => theme.colors.secondaryBackground};
  }

  &:active {
    opacity: 0.75;
  }
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface TextEditPreviewInputProps {
  onEncrypt: (input: string) => Promise<string>;
  onDecrypt: (input: string) => Promise<string>;
  onModeChange?: (mode: Mode) => void;
  downloadName?: string;
  externalRefreshKey?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
const TextEditPreviewInput: React.FC<TextEditPreviewInputProps> = ({
  onEncrypt,
  onDecrypt,
  onModeChange,
  downloadName,
  externalRefreshKey,
}) => {
  const [mode, setMode] = useState<Mode>("encrypt");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Auto-process input on change ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const process = async (): Promise<void> => {
      if (!input.trim()) {
        setOutput("");
        return;
      }
      setIsProcessing(true);
      try {
        const result =
          mode === "encrypt" ? await onEncrypt(input) : await onDecrypt(input);
        if (!cancelled) setOutput(result);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setOutput("⚠️ Failed to process text");
        }
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    };

    process();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, mode, externalRefreshKey]);

  // ── Mode switch ────────────────────────────────────────────────────────────
  /**
   * Clears input + output on mode switch so stale content never leaks
   * between modes. Also notifies MessagePanel via onModeChange so the
   * recipient selector can switch to readonly/detected state.
   */
  const handleSetMode = (next: Mode): void => {
    if (next === mode) return;
    setMode(next);
    setInput("");
    setOutput("");
    onModeChange?.(next);
  };

  // ── Import handlers ────────────────────────────────────────────────────────
  const selectFile = (accept: string): Promise<File> =>
    new Promise((resolve, reject) => {
      const el = document.createElement("input");
      el.type = "file";
      el.accept = accept;
      el.onchange = () =>
        el.files?.[0]
          ? resolve(el.files[0])
          : reject(new Error("No file selected"));
      el.click();
    });

  const handleJsonImport = async (): Promise<void> => {
    try {
      const file = await selectFile(".json");
      const text = await file.text();
      const json = JSON.parse(text);

      const value = "encrypted"
        .split(".")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((obj: any, key) => obj?.[key], json);
      if (value === undefined) {
        toast.error("Failed to import JSON", {
          description: 'Key "encrypted" not found in JSON',
          id: "toast-error-import-json",
        });
        return;
      }
      setInput(value.toString());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("Failed to import JSON", {
        description: err.message || "Failed to import JSON",
        id: "toast-error-import-json",
      });
    }
  };

  const handleTextImport = async (): Promise<void> => {
    try {
      const file = await selectFile(".txt");
      const text = await file.text();
      if (!text.trim()) {
        toast.error("Failed to import text", {
          description: "Text file is empty.",
          id: "toast-error-import-text",
        });
        return;
      }
      setInput(text);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("Failed to import text", {
        description: err.message || "Failed to import text",
        id: "toast-error-import-text",
      });
    }
  };

  const handleClipboardImport = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("Failed to read clipboard", {
        description: `${err}`,
        id: "toast-error-import-text",
      });
    }
  };

  // ── Export handlers ────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (!output?.trim()) {
      toast.error("Nothing to copy", {
        description: "No output text yet.",
        id: "toast-error-copy",
      });
      return;
    }
    navigator.clipboard
      .writeText(output)
      .then(() => {
        toast.success("Copied to clipboard", {
          description:
            output.length > 200 ? output.slice(0, 200) + "…" : output,
          id: "toast-success-copy",
        });
        // Native Notification

        sendNotification({
          title: "Copied to clipboard",
          body: output.length > 200 ? output.slice(0, 200) + "…" : output,
        });
      })

      .catch((e) => {
        toast.error("Failed to copy", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (e as any)?.message || String(e),
          id: "toast-error-copy",
        });
      });
  }, [output]);

  const handleDownloadTxt = (): void => {
    try {
      downloadBlob(
        new Blob([output], { type: "application/octet-stream" }),
        "txt",
        downloadName || "Encoded",
      );
      // Native Notification

      sendNotification({
        title: "Message Downloaded",
        body: downloadName || "This message has been saved as a TXT file.",
      });
    } catch (e) {
      toast.error("Failed to download .txt", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || String(e),
        id: "toast-error-txt",
      });
    }
  };

  const handleDownloadJson = (): void => {
    try {
      const blob = new Blob(
        [JSON.stringify({ original: input, encrypted: output })],
        {
          type: "application/json;charset=utf-8",
        },
      );
      downloadBlob(blob, "json", downloadName || "Encoded");
      toast.success("Message downloaded", {
        description: "Saved as a JSON file.",
        id: "toast-success-json",
      });
      // Native Notification

      sendNotification({
        title: "Message Downloaded",
        body: downloadName || "This message has been saved as a JSON file.",
      });
    } catch (e) {
      toast.error("Failed to download .json", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || String(e),
        id: "toast-error-json",
      });
    }
  };

  // ── Derived labels ─────────────────────────────────────────────────────────
  const labels = useMemo(
    () => ({
      input: mode === "encrypt" ? "Plain Text Input" : "Encrypted Text Input",
      output: mode === "encrypt" ? "Encrypted Preview" : "Decrypted Preview",
      inputPlaceholder:
        mode === "encrypt"
          ? "Type any message here…"
          : "Paste encrypted text here…",
      outputPlaceholder: isProcessing
        ? "Processing…"
        : "Output will appear here…",
      outputBadge: isProcessing ? "Processing…" : output ? "Ready" : "Waiting",
    }),
    [mode, isProcessing, output],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root>
      {/* ── Content header: label + mode pill switcher ── */}
      <ContentHeader>
        <ContentLabel>Message Content</ContentLabel>

        <ModeSwitcher id="button-toggle-mode">
          <ModePill
            $active={mode === "encrypt"}
            $mode="encrypt"
            onClick={() => handleSetMode("encrypt")}
            title="Switch to Encrypt mode"
            id="button-mode-encrypt"
          >
            Encrypt
          </ModePill>
          <ModePill
            $active={mode === "decrypt"}
            $mode="decrypt"
            onClick={() => handleSetMode("decrypt")}
            title="Switch to Decrypt mode"
            id="button-mode-decrypt"
          >
            Decrypt
          </ModePill>
        </ModeSwitcher>
      </ContentHeader>

      {/* ── Two-column editor ── */}
      <EditorGrid>
        {/* Input pane — accent border shows mode */}
        <EditorPane $accent={mode} id="panel-input-pane">
          <PaneHeader>
            <PaneLabel $mode={mode}>{labels.input}</PaneLabel>
          </PaneHeader>

          <PaneTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={labels.inputPlaceholder}
            data-private="lipsum"
            id="panel-input-text"
          />

          <PaneFooter id="panel-input-actions">
            <PaneBtn onClick={handleClipboardImport}>Paste</PaneBtn>
            <PaneBtn onClick={handleTextImport}>Import .txt</PaneBtn>
            <PaneBtn onClick={handleJsonImport}>Import .json</PaneBtn>
          </PaneFooter>
        </EditorPane>

        {/* Output pane — neutral border, always read-only */}
        <EditorPane $accent={null} id="panel-output-pane">
          <PaneHeader>
            <PaneLabel $mode={null}>{labels.output}</PaneLabel>
            <PaneStatusBadge $mode={output ? mode : null}>
              {labels.outputBadge}
            </PaneStatusBadge>
          </PaneHeader>

          <PaneTextarea
            $readOnly
            readOnly
            value={output}
            placeholder={labels.outputPlaceholder}
            data-private="lipsum"
            id="panel-output-text"
          />

          <PaneFooter id="panel-output-actions">
            <PaneBtn onClick={handleCopy}>Copy</PaneBtn>
            <PaneBtn onClick={handleDownloadTxt}>Download .txt</PaneBtn>
            <PaneBtn onClick={handleDownloadJson}>Download .json</PaneBtn>
          </PaneFooter>
        </EditorPane>
      </EditorGrid>
    </Root>
  );
};

export default TextEditPreviewInput;
