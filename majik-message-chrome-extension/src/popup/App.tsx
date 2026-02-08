import { useEffect, useState } from "react";

import ScannerPanel from "../components/panels/ScannerPanel";
import UnlockModal from "../components/UnlockModal";
import { KeyStore, MajikContact } from "@majikah/majik-message";

import { toast, Toaster } from "sonner";
import DynamicPlaceholder from "../components/foundations/DynamicPlaceholder";
import styled from "styled-components";
import { useMajik } from "../components/majik-context-wrapper/use-majik";

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 550px;
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  min-height: 550px;
  padding: 25px;
`;

const MessageText = styled.p`
  width: 100%;
  text-align: center;
  margin: 8px;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

function App() {
  const { majik, loading } = useMajik();
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [unlockResolver, setUnlockResolver] = useState<
    ((s: string) => void) | null
  >(null);

  const [unlocked, setUnlocked] = useState<boolean>(false);

  useEffect(() => {
    // Wire KeyStore.onUnlockRequested to present our React modal
    KeyStore.onUnlockRequested = (id: string) => {
      return new Promise<string>((resolve) => {
        setUnlockId(id);
        setUnlockResolver(() => resolve);
      });
    };

    return () => {
      KeyStore.onUnlockRequested = undefined;
    };
  }, []);

  useEffect(() => {
    // define an async function inside useEffect
    const unlockIdentity = async () => {
      try {
        if (!majik) return;
        const activeAccount = majik.getActiveAccount();
        if (!activeAccount) return;
        await majik.ensureIdentityUnlocked(activeAccount.id);
        toast.success("Access granted", {
          description: "Your identity has been securely unlocked.",
          id: "toast-success-unlock",
        });

        console.log("Access granted: Identity unlocked");
      } catch (err) {
        toast.error("Unlock failed", {
          description: `Incorrect passphrase. Please try again. ${err}`,
          id: "toast-error-unlock",
        });
        console.warn("Failed to unlock identity:", err);
      }
    };

    // call the async function
    unlockIdentity();
  }, [majik]); // add dependencies as needed

  const handleCancel = () => {
    if (unlockResolver) unlockResolver("");
    setUnlockId(null);
    setUnlockResolver(null);
  };

  const handleSubmit = (pass: string) => {
    if (unlockResolver) unlockResolver(pass);
    setUnlockId(null);
    setUnlockResolver(null);
    setUnlocked(true);
  };

  const handleSwitchAccount = async (
    newAccount: MajikContact,
  ): Promise<void> => {
    handleCancel();
    setUnlockId(newAccount.id);
    await majik.ensureIdentityUnlocked(newAccount.id);
    toast.success("Access granted", {
      description: "Your identity has been securely unlocked.",
      id: "toast-success-unlock",
    });
  };

  if (!!loading) {
    return (
      <DynamicPlaceholder loading={loading}>Loading...</DynamicPlaceholder>
    );
  }

  if (!majik?.getActiveAccount()) {
    return (
      <RootContainer className="popup-container">
        <DynamicPlaceholder loading={loading}>
          <strong>Get started</strong> <br />
          Create your account in the side panel to continue.
        </DynamicPlaceholder>
      </RootContainer>
    );
  }

  return (
    <RootContainer className="popup-container">
      <ScannerPanel majik={majik} showHistoryLog={false} />
      <MessageText>
        <i>Open the extension side panel to access advanced options.</i>
      </MessageText>
      <UnlockModal
        identityId={unlockId}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        majik={majik}
        onSignout={() => setUnlockId(null)}
        onSwitchAccount={handleSwitchAccount}
        strict={!unlocked}
      />
      <Toaster expand={true} position="top-right" />
    </RootContainer>
  );
}

export default App;
