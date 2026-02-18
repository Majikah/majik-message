import { useEffect, useState } from "react";

import ContactsPanel from "../components/panels/ContactsPanel";
import ScannerPanel from "../components/panels/ScannerPanel";
import UnlockModal from "../components/UnlockModal";
import { MajikKeyStore, MajikContact } from "@majikah/majik-message";

import AccountsPanel from "../components/panels/AccountsPanel";

import { toast, Toaster } from "sonner";
import DynamicPlaceholder from "../components/foundations/DynamicPlaceholder";
import styled from "styled-components";
import DynamicPagedTab, {
  TabContent,
} from "../components/functional/DynamicPagedTab";
import {
  AddressBookIcon,
  EnvelopeIcon,
  GearIcon,
  UserIcon,
} from "@phosphor-icons/react";
import MessagePanel from "../components/panels/MessagePanel";
import { useMajik } from "../components/majik-context-wrapper/use-majik";
import { MajikMessageDatabase } from "../components/majik-context-wrapper/majik-message-database";

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: inherit;
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  height: 100dvh;
`;

function App() {
  const { majik, loading, updateInstance } = useMajik();
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockResolver, setUnlockResolver] = useState<
    ((s: string) => void) | null
  >(null);

  const [, setRefreshKey] = useState<number>(0);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  useEffect(() => {
    // Wire MajikKeyStore.onUnlockRequested to present our React modal
    MajikKeyStore.onUnlockRequested = (id: string) => {
      return new Promise<string>((resolve) => {
        setUnlockId(id);
        setUnlockResolver(() => resolve);
      });
    };

    return () => {
      MajikKeyStore.onUnlockRequested = undefined;
    };
  }, []);

  useEffect(() => {
    if (!majik) return;

    const active = majik.getActiveAccount();
    if (!active) return;

    try {
      // Try accessing private key
      MajikKeyStore.getPrivateKey(active.id);

      // If no error → already unlocked
      setUnlocked(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const needsUnlock =
        err instanceof Error &&
        /must be unlocked|unlockIdentity/.test(err.message);

      if (needsUnlock) {
        setUnlockId(active.id);
      }
    }
  }, [majik]);

  const handleCancel = (): void => {
    if (unlockResolver) unlockResolver("");
    setUnlockId(null);
    setUnlockResolver(null);
    setRefreshKey((prev) => prev + 1);
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
  const handleSubmit = async (pass: string): Promise<void> => {
    if (!majik || !unlockId || isUnlocking) return;
    if (unlockResolver) unlockResolver(pass);
    try {
      setIsUnlocking(true);

      await MajikKeyStore.unlockIdentity(unlockId, pass);

      toast.success("Access granted", {
        description: "Your identity has been securely unlocked.",
      });

      setUnlockId(null);
      setUnlockResolver(null);
      setUnlocked(true);
    } catch {
      toast.error("Incorrect passphrase. Please try again.");
      // modal stays open
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleRefreshInstance = (data: MajikMessageDatabase): void => {
    updateInstance(data);
    setRefreshKey((prev) => prev + 1);
  };

  if (!!loading) {
    return (
      <DynamicPlaceholder loading={loading}>Loading...</DynamicPlaceholder>
    );
  }

  if (!majik) {
    return (
      <DynamicPlaceholder>
        There seems to be a problem with Majik Message...
      </DynamicPlaceholder>
    );
  }

  const tabs: TabContent[] = [
    {
      id: "accounts",
      icon: UserIcon,
      name: "Accounts",
      content: <AccountsPanel majik={majik} onUpdate={handleRefreshInstance} />,
    },
    {
      id: "contacts",
      name: "Contacts",
      icon: AddressBookIcon,
      content: <ContactsPanel majik={majik} onUpdate={handleRefreshInstance} />,
    },
    {
      id: "messsage",
      name: "Message",
      icon: EnvelopeIcon,
      content: <MessagePanel majik={majik} />,
    },
    {
      id: "scanner",
      icon: GearIcon,
      name: "Scanner",
      content: <ScannerPanel majik={majik} />,
    },
  ];

  return (
    <RootContainer>
      <DynamicPagedTab tabs={tabs} />
      <UnlockModal
        identityId={unlockId}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        majik={majik}
        strict={!unlocked}
        onSignout={() => setUnlockId(null)}
        onSwitchAccount={handleSwitchAccount}
        onReset={handleCancel}
        isUnlocking={isUnlocking}
      />
      <Toaster expand={true} position="top-right" />
    </RootContainer>
  );
}

export default App;
