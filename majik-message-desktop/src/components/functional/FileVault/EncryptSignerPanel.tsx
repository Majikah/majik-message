// ── EncryptSignerPanel ────────────────────────────────────────────────────
// Shown in the INPUT pane (encrypt mode) — who will sign this file.

import type { SignerInfo } from "@src/components/panels/_types";
import {
  SignerBadgeBody,
  SignerBadgeDetail,
  SignerBadgeIcon,
  SignerBadgeMono,
  SignerBadgeTitle,
  SignerBadgeWrap,
} from "./StyledFileVaultComponents";

interface EncryptSignerPanelProps {
  signerInfo: SignerInfo | null | undefined;
  hasFile: boolean;
}

export const EncryptSignerPanel: React.FC<EncryptSignerPanelProps> = ({
  signerInfo,
  hasFile,
}) => {
  if (!hasFile) return null;

  if (!signerInfo) {
    return (
      <SignerBadgeWrap $variant="unsigned">
        <SignerBadgeIcon>◌</SignerBadgeIcon>
        <SignerBadgeBody>
          <SignerBadgeTitle>No signing keys</SignerBadgeTitle>
          <SignerBadgeDetail>
            This file will be encrypted without a signature. Re-import your
            account via mnemonic backup to enable post-quantum signing.
          </SignerBadgeDetail>
        </SignerBadgeBody>
      </SignerBadgeWrap>
    );
  }

  const label =
    signerInfo.signerLabel ?? signerInfo.signerId.slice(0, 20) + "…";
  const accountType = signerInfo.isOwnAccount
    ? "Your account"
    : "External signer";

  return (
    <SignerBadgeWrap $variant="signed">
      <SignerBadgeIcon>✦</SignerBadgeIcon>
      <SignerBadgeBody>
        <SignerBadgeTitle>
          Will be signed · Ed25519 + ML-DSA-87
        </SignerBadgeTitle>
        <SignerBadgeDetail>
          {accountType}
          {signerInfo.signerLabel ? ` · ${label}` : ""}
        </SignerBadgeDetail>
        <SignerBadgeMono>{signerInfo.signerId.slice(0, 32)}…</SignerBadgeMono>
      </SignerBadgeBody>
    </SignerBadgeWrap>
  );
};

export default EncryptSignerPanel;
