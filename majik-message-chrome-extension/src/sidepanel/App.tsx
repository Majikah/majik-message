import { useEffect, useMemo, useState } from "react";

import ContactsPanel from "../components/panels/ContactsPanel";
import ScannerPanel from "../components/panels/ScannerPanel";
import UnlockModal from "../components/UnlockModal";
import { KeyStore, MajikContact } from "@majikah/majik-message";

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
  const [unlockResolver, setUnlockResolver] = useState<
    ((s: string) => void) | null
  >(null);

  const [refreshKey, setRefreshKey] = useState<number>(0);
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
          description: `${err}`,
          id: "toast-error-unlock",
        });
        console.warn("Failed to unlock identity:", err);
      }
    };

    // call the async function
    unlockIdentity();
  }, [majik]); // add dependencies as needed

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

  const handleSubmit = (pass: string): void => {
    if (unlockResolver) unlockResolver(pass);
    setUnlockId(null);
    setUnlockResolver(null);
    setUnlocked(true);
  };

  const handleRefreshInstance = (data: MajikMessageDatabase): void => {
    updateInstance(data);
    setRefreshKey((prev) => prev + 1);
  };

  const userAccounts = useMemo(() => {
    if (!majik) return [];

    return majik.listOwnAccounts();
  }, [majik, refreshKey]);

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
      content: (
        <AccountsPanel
          majik={majik}
          onUpdate={handleRefreshInstance}
          accounts={userAccounts}
        />
      ),
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
      content: <MessagePanel majik={majik} onUpdate={handleRefreshInstance} />,
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
      />
      <Toaster expand={true} position="top-right" />
    </RootContainer>
  );
}

export default App;
