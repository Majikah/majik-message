import { MajikBytes } from "@majikah/majik-bytes";

import {
  CheckCircleIcon,
  UploadSimpleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import styled, { keyframes } from "styled-components";

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Drag & Drop Zone ─────────────────────────────────────────────────────────
const DropZoneWrapper = styled.div`
  animation: ${fadeIn} 0.2s ease;
`;

const DropZone = styled.div<{ $isDragging: boolean; $hasFile: boolean }>`
  position: relative;
  border: 1.5px dashed
    ${({ theme, $isDragging, $hasFile }) =>
      $hasFile
        ? theme.colors.primary
        : $isDragging
          ? theme.colors.primary
          : theme.colors.secondaryBackground};
  border-radius: 10px;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${({ theme, $isDragging, $hasFile }) =>
    $hasFile
      ? `${theme.colors.primary}0d`
      : $isDragging
        ? `${theme.colors.primary}10`
        : `${theme.colors.secondaryBackground}40`};
  text-align: center;
  user-select: none;
  overflow: hidden;
  margin-bottom: 1.5em;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => `${theme.colors.primary}0a`};
  }
`;

const DropZoneIconRing = styled.div<{ $hasFile: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${({ theme, $hasFile }) =>
    $hasFile ? `${theme.colors.primary}20` : theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme, $hasFile }) =>
    $hasFile ? theme.colors.primary : theme.colors.textSecondary};
  transition: all 0.2s ease;
  flex-shrink: 0;
`;

const DropZoneTitle = styled.p`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const DropZoneHint = styled.p`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.6;
  line-height: 1.4;
`;

const DropZoneFileName = styled.p`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary};
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DropZoneClearButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

// ─── Drag-and-drop import sub-component ──────────────────────────────────────
interface DropImportProps {
  onFileLoaded: (inviteKey: string, filename: string) => void;
  inviteKey?: string;
  onClear: () => void;
}

export const DropImportContact: React.FC<DropImportProps> = ({
  inviteKey,
  onFileLoaded,
  onClear,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = async (file: File): Promise<void> => {
    setParseError("");
    try {
      const loadedMbyte = await MajikBytes.fromPNG(file);
      const rawBytes = loadedMbyte.bytes;

      // Convert the raw bytes back into a string
      const decodedString = new TextDecoder().decode(rawBytes);

      if (!decodedString?.trim()) {
        setParseError("Invalid contact card.");
        return;
      }
      setFileName(file.name);
      onFileLoaded(decodedString, file.name);
    } catch (e) {
      console.error("Error: ", e);
      setParseError(
        "Could not parse file. Make sure it's a valid contact card.",
      );
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    // reset so same file can be reselected
    e.target.value = "";
  };

  const handleClear = (ev: React.MouseEvent): void => {
    ev.stopPropagation();
    setFileName("");
    setParseError("");
    onClear();
  };

  const hasFile = !!inviteKey?.trim();

  return (
    <DropZoneWrapper>
      <DropZone
        $isDragging={isDragging}
        $hasFile={hasFile}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !hasFile && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) =>
          e.key === "Enter" && !hasFile && fileInputRef.current?.click()
        }
        aria-label="Drop Contact Card PNG file here or click to browse"
      >
        {hasFile && (
          <DropZoneClearButton onClick={handleClear} aria-label="Clear file">
            <XCircleIcon size={15} />
          </DropZoneClearButton>
        )}

        <DropZoneIconRing $hasFile={hasFile}>
          {hasFile ? (
            <CheckCircleIcon size={20} weight="fill" />
          ) : (
            <UploadSimpleIcon size={18} />
          )}
        </DropZoneIconRing>

        {hasFile ? (
          <>
            <DropZoneTitle>Contact Card loaded</DropZoneTitle>
            <DropZoneFileName data-private>{fileName}</DropZoneFileName>
          </>
        ) : (
          <>
            <DropZoneTitle>Drop your Contact Card PNG here</DropZoneTitle>
            <DropZoneHint>or click to browse your files</DropZoneHint>
          </>
        )}

        {parseError && (
          <DropZoneHint style={{ color: "#e05050", opacity: 1 }}>
            {parseError}
          </DropZoneHint>
        )}
      </DropZone>

      <HiddenFileInput
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleBrowse}
      />
    </DropZoneWrapper>
  );
};

export default DropImportContact;
