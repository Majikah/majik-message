import styled, { keyframes } from "styled-components";
import type { MajikMessagePublicKey } from "@majikah/majik-message";
import { useEffect, useState } from "react";
import type { MajikMessageDatabase } from "@/components/majik-context-wrapper/majik-message-database";

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace";

// ─── Animations ───────────────────────────────────────────────────────────────
const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0);   opacity: 0.4; }
  30%           { transform: translateY(-4px); opacity: 1;   }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Root ─────────────────────────────────────────────────────────────────────
/**
 * Mirrors the layout of an "other" chat bubble so it feels like
 * a natural part of the message stream, not a floating status bar.
 * Avatar + bubble shell + italic label.
 */
const Root = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 2px 0;
  animation: ${fadeIn} 180ms ease both;
`;

// ─── Avatar ───────────────────────────────────────────────────────────────────
/**
 * Same deterministic hue system as ThreadRow/ThreadMail/ConversationCard.
 * Size is intentionally smaller than a full message avatar — this is
 * transient UI, it shouldn't compete with actual messages.
 */
const Avatar = styled.div<{ $hue: number }>`
  width: 22px;
  height: 22px;
  min-width: 22px;
  border-radius: 50%;
  background: hsl(${({ $hue }) => $hue}, 38%, 26%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_MONO};
  font-size: 8px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
  user-select: none;
  flex-shrink: 0;
  /* Aligns with the bubble bottom */
  margin-bottom: 2px;
`;

// ─── Bubble shell ─────────────────────────────────────────────────────────────
/**
 * Matches the "other" bubble style from CBaseChatBubble:
 * secondaryBackground fill, border, asymmetric bottom-left radius.
 */
const Bubble = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid
    ${({ theme }) =>
      /* slightly lighter than the card border for depth */
      `${theme.colors.secondaryBackground}`};
  border-radius: 14px;
  border-bottom-left-radius: 4px;
`;

// ─── Typing label ─────────────────────────────────────────────────────────────
const Label = styled.span`
  font-size: 12px;
  font-style: italic;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  opacity: 0.75;
  /* Truncate if many names */
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ─── Dots ─────────────────────────────────────────────────────────────────────
const Dots = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
`;

const Dot = styled.span<{ $delay: number }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  animation: ${bounce} 1.4s infinite ease-in-out;
  animation-delay: ${({ $delay }) => $delay}s;
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface TypingIndicatorProps {
  typingPublicKeys: MajikMessagePublicKey[];
  majik: MajikMessageDatabase;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingPublicKeys,
  majik,
}) => {
  const [displayNames, setDisplayNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchNames = async (): Promise<void> => {
      const names = await Promise.all(
        typingPublicKeys.map(async (publicKey) => {
          try {
            const contact = await majik.getContactByPublicKey(publicKey);
            return (await contact?.getDisplayName()) || "Unknown";
          } catch {
            return "Unknown";
          }
        }),
      );
      if (!cancelled) setDisplayNames(names);
    };

    fetchNames();
    return () => {
      cancelled = true;
    };
  }, [typingPublicKeys, majik]);

  if (typingPublicKeys.length === 0) return null;

  // Use the first typer's name to seed the avatar color
  const primaryName = displayNames[0] ?? typingPublicKeys[0] ?? "";
  const avatarHue = getHue(primaryName);
  const initials = getInitials(primaryName);

  return (
    <Root>
      <Avatar $hue={avatarHue} aria-hidden>
        {initials}
      </Avatar>

      <Bubble>
        {/* Label only renders once names have resolved */}
        {displayNames.length > 0 && (
          <Label>{formatTypingText(displayNames)}</Label>
        )}
        <Dots aria-label="Typing">
          <Dot $delay={0} />
          <Dot $delay={0.2} />
          <Dot $delay={0.4} />
        </Dots>
      </Bubble>
    </Root>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTypingText(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  if (names.length === 3)
    return `${names[0]}, ${names[1]}, and ${names[2]} are typing`;
  return `${names.length} people are typing`;
}

function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
