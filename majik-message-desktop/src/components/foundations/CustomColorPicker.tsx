import React, { useState } from "react";
import styled from "styled-components";

const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

const PRESET_COLORS = [
  "#D0021B",
  "#F5A623",
  "#F8E71C",
  "#8B572A",
  "#7ED321",
  "#417505",
  "#BD10E0",
  "#9013FE",
  "#4A90E2",
  "#50E3C2",
  "#B8E986",
  "#000000",
  "#4A4A4A",
  "#9B9B9B",
  "#FFFFFF",
  "#d6f500",
  "#00BCD4",
  "#FF5722",
  "#607D8B",
  "#E91E63",
  "#3F51B5",
];

const isValidHex = (h: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h);

// --- Styled components ---

const Root = styled.div`
  display: flex;
  flex-direction: column;
  user-select: none;
  padding: 12px 0;
`;

const SwatchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
`;

const SwatchRow = styled.div<{ $editing?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 0.5px solid
    ${({ $editing, theme }) =>
      $editing ? theme.colors.primary : theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.primaryBackground};
  box-shadow: ${({ $editing }) =>
    $editing ? "0 0 0 2px rgba(80,80,200,0.12)" : "none"};
  transition: border-color 0.15s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const SwatchDot = styled.div<{ $color: string }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s;

  &:hover {
    transform: scale(1.1);
  }
`;

const HexLabel = styled.span`
  flex: 1;
  font-size: 13px;
  font-family: ${FONT_MONO};
  letter-spacing: 0.03em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const SmallButton = styled.button`
  font-size: 12px;
  padding: 3px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 0.5px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  cursor: pointer;
  transition: background 0.12s;

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

const EditButton = styled(SmallButton)`
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const DeleteButton = styled(SmallButton)`
  color: ${({ theme }) => theme.colors.error};
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.error};
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  font-size: 13px;
  padding: 7px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 0.5px dashed ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition:
    background 0.12s,
    border-style 0.12s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-style: solid;
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

const PickerPanel = styled.div`
  margin-top: 12px;
  padding: 12px;
  border-radius: ${({ theme }) => theme.borders.radius.large};
  border: 0.5px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.primaryBackground};
`;

const PickerLabel = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 10px;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  margin-bottom: 12px;
`;

const PresetCell = styled.div<{ $color: string; $selected: boolean }>`
  aspect-ratio: 1;
  border-radius: 5px;
  background: ${({ $color }) => $color};
  cursor: pointer;
  border: 2px solid ${({ $selected }) => ($selected ? "#111" : "transparent")};
  transition:
    transform 0.1s,
    border-color 0.1s;

  &:hover {
    transform: scale(1.15);
  }
`;

const HexRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
`;

const HexPreview = styled.div<{ $color: string }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
`;

const HexInput = styled.input`
  flex: 1;
  font-family: ${FONT_MONO};
  font-size: 13px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 0.5px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(80, 80, 200, 0.1);
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const CancelButton = styled(SmallButton)`
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const ConfirmButton = styled.button`
  font-size: 13px;
  padding: 6px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: none;
  background: ${({ theme }) => theme.colors.textPrimary};
  color: ${({ theme }) => theme.colors.primaryBackground};
  cursor: pointer;

  &:hover {
    opacity: 0.85;
  }
`;

// --- Component ---

interface CustomColorPickerProps {
  currentValue: string[];
  defaultColor?: string;
  max?: number;
  onUpdate?: (colors: string[]) => void;
}

const CustomColorPicker: React.FC<CustomColorPickerProps> = ({
  currentValue,
  defaultColor = "#d6f500",
  max = 10,
  onUpdate,
}) => {
  const [picking, setPicking] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentColor, setCurrentColor] = useState(defaultColor);
  const [hexInput, setHexInput] = useState(defaultColor);

  const colors = currentValue?.length ? currentValue : [defaultColor];

  const openForEdit = (index: number, color: string) => {
    setEditingIndex(index);
    setCurrentColor(color);
    setHexInput(color);
    setPicking(true);
  };

  const openForAdd = () => {
    setEditingIndex(max === 1 ? 0 : null);
    setCurrentColor(defaultColor);
    setHexInput(defaultColor);
    setPicking(true);
  };

  const handleConfirm = () => {
    const color = isValidHex(hexInput) ? hexInput : currentColor;
    if (editingIndex !== null) {
      const next = [...colors];
      next[editingIndex] = color;
      onUpdate?.(next);
    } else {
      onUpdate?.([...colors, color].slice(0, max));
    }
    setPicking(false);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    onUpdate?.(colors.filter((_, i) => i !== index));
    setPicking(false);
  };

  const handleHexInput = (val: string) => {
    if (!val.startsWith("#")) val = "#" + val;
    setHexInput(val);
    if (isValidHex(val)) setCurrentColor(val);
  };

  const handlePreset = (color: string) => {
    setCurrentColor(color);
    setHexInput(color);
  };

  return (
    <Root>
      <SwatchList>
        {colors.map((color, i) => (
          <SwatchRow key={i} $editing={picking && editingIndex === i}>
            <SwatchDot
              $color={color}
              onClick={() => openForEdit(i, color)}
              title="Edit"
            />
            <HexLabel>{color.toUpperCase()}</HexLabel>
            {max > 1 && (
              <EditButton onClick={() => openForEdit(i, color)}>
                Edit
              </EditButton>
            )}
            {max > 1 && (
              <DeleteButton
                onClick={() => handleDelete(i)}
                disabled={colors.length <= 1}
              >
                Remove
              </DeleteButton>
            )}
          </SwatchRow>
        ))}
      </SwatchList>

      {picking ? (
        <PickerPanel>
          <PickerLabel>
            {editingIndex !== null
              ? `Editing color ${editingIndex + 1}`
              : "New color"}
          </PickerLabel>
          <PresetGrid>
            {PRESET_COLORS.map((c) => (
              <PresetCell
                key={c}
                $color={c}
                $selected={currentColor === c}
                onClick={() => handlePreset(c)}
                title={c}
              />
            ))}
          </PresetGrid>
          <HexRow>
            <HexPreview
              $color={isValidHex(hexInput) ? hexInput : currentColor}
            />
            <HexInput
              value={hexInput}
              maxLength={7}
              placeholder="#000000"
              onChange={(e) => handleHexInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
                if (e.key === "Escape") {
                  setPicking(false);
                  setEditingIndex(null);
                }
              }}
            />
          </HexRow>
          <Actions>
            <CancelButton
              onClick={() => {
                setPicking(false);
                setEditingIndex(null);
              }}
            >
              Cancel
            </CancelButton>
            <ConfirmButton onClick={handleConfirm}>Apply</ConfirmButton>
          </Actions>
        </PickerPanel>
      ) : (
        <AddButton
          onClick={openForAdd}
          disabled={colors.length >= max && max > 1}
        >
          + {max === 1 ? "Pick color" : "Add color"}
        </AddButton>
      )}
    </Root>
  );
};

export default CustomColorPicker;
