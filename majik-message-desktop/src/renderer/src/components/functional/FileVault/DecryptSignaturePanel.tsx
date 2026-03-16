// ── DecryptSignaturePanel ─────────────────────────────────────────────────
// Shown in the OUTPUT pane (decrypt mode) — verdict + signer details.

import type { DecryptSignatureStatus } from '@renderer/components/panels/_types'
import {
  SignerBadgeBody,
  SignerBadgeDetail,
  SignerBadgeIcon,
  SignerBadgeMono,
  SignerBadgeTitle,
  SignerBadgeWrap
} from './StyledFileVaultComponents'

interface DecryptSignaturePanelProps {
  status: DecryptSignatureStatus | null | undefined
}

export const DecryptSignaturePanel: React.FC<DecryptSignaturePanelProps> = ({ status }) => {
  if (!status) return null

  if (status.verdict === 'unsigned') {
    return (
      <SignerBadgeWrap $variant="unsigned">
        <SignerBadgeIcon>◌</SignerBadgeIcon>
        <SignerBadgeBody>
          <SignerBadgeTitle>No signature</SignerBadgeTitle>
          <SignerBadgeDetail>
            This file was not signed at encryption time. Content authenticity cannot be verified.
          </SignerBadgeDetail>
        </SignerBadgeBody>
      </SignerBadgeWrap>
    )
  }

  if (status.verdict === 'invalid') {
    return (
      <SignerBadgeWrap $variant="invalid">
        <SignerBadgeIcon>⚠</SignerBadgeIcon>
        <SignerBadgeBody>
          <SignerBadgeTitle>⛔ Signature invalid — possible forgery or tampering</SignerBadgeTitle>
          <SignerBadgeDetail>
            A signature was found but verification failed. The file may have been modified after
            signing, or the signature was forged. Do not trust the contents.
          </SignerBadgeDetail>
          {status.signerId && (
            <SignerBadgeMono>Claimed signer: {status.signerId.slice(0, 32)}…</SignerBadgeMono>
          )}
        </SignerBadgeBody>
      </SignerBadgeWrap>
    )
  }

  if (status.verdict === 'unverified') {
    return (
      <SignerBadgeWrap $variant="warn">
        <SignerBadgeIcon>~</SignerBadgeIcon>
        <SignerBadgeBody>
          <SignerBadgeTitle>Signature present · unverified</SignerBadgeTitle>
          <SignerBadgeDetail>
            A signature was found but could not be verified — signer public keys unavailable.
          </SignerBadgeDetail>
          {status.signerId && (
            <SignerBadgeMono>Signer ID: {status.signerId.slice(0, 32)}…</SignerBadgeMono>
          )}
        </SignerBadgeBody>
      </SignerBadgeWrap>
    )
  }

  // valid
  // const label = status.signerLabel ?? status.signerId?.slice(0, 20) + '…'
  const accountType = status.isOwnAccount
    ? 'Your account'
    : status.isKnownContact
      ? 'Known contact'
      : 'Unknown signer'
  const ts = status.timestamp ? new Date(status.timestamp).toLocaleString() : null

  return (
    <SignerBadgeWrap $variant="valid">
      <SignerBadgeIcon>✦</SignerBadgeIcon>
      <SignerBadgeBody>
        <SignerBadgeTitle>✓ Signature verified · Ed25519 + ML-DSA-87</SignerBadgeTitle>
        <SignerBadgeDetail>
          {accountType}
          {status.signerLabel ? ` · ${status.signerLabel}` : ''}
          {status.contentType ? ` · ${status.contentType}` : ''}
        </SignerBadgeDetail>
        {ts && <SignerBadgeDetail style={{ opacity: 0.5 }}>Signed {ts}</SignerBadgeDetail>}
        {status.signerId && <SignerBadgeMono>{status.signerId.slice(0, 32)}…</SignerBadgeMono>}
      </SignerBadgeBody>
    </SignerBadgeWrap>
  )
}

export default DecryptSignaturePanel
