// ── Signature display ──────────────────────────────────────────────────────

import styled, { css, keyframes } from 'styled-components'
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`

export const SignerBadgeWrap = styled.div<{
  $variant: 'signed' | 'unsigned' | 'valid' | 'invalid' | 'warn'
}>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 11px;
  border-radius: 8px;
  border: 1px solid;
  font-family: ${FONT_MONO};
  font-size: 10px;
  line-height: 1.55;
  animation: ${fadeIn} 160ms ease both;

  ${({ $variant }) => {
    switch ($variant) {
      case 'signed':
      case 'valid':
        return css`
          background: rgba(16, 185, 129, 0.06);
          border-color: rgba(16, 185, 129, 0.2);
          color: #10b981;
        `
      case 'unsigned':
        return css`
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.07);
          color: #6b7280;
        `
      case 'invalid':
        return css`
          background: rgba(239, 68, 68, 0.07);
          border-color: rgba(239, 68, 68, 0.25);
          color: #ef4444;
        `
      case 'warn':
        return css`
          background: rgba(245, 158, 11, 0.06);
          border-color: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        `
    }
  }}
`

export const SignerBadgeIcon = styled.span`
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 0px;
  line-height: 1.4;
`

export const SignerBadgeBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`

export const SignerBadgeTitle = styled.div`
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.02em;
`

export const SignerBadgeDetail = styled.div`
  font-size: 9px;
  opacity: 0.7;
  word-break: break-all;
`

export const SignerBadgeMono = styled.span`
  font-family: ${FONT_MONO};
  font-size: 8px;
  opacity: 0.55;
  letter-spacing: 0.03em;
`
