import { useEffect, useState } from "react";
import "./App.css";

import { MajikKeyStore, MajikContact } from "@majikah/majik-message";
import UnlockModal from "../../components/UnlockModal";
import { toast, Toaster } from "sonner";
import { useMajik } from "../../components/majik-context-wrapper/use-majik";

function App() {
  const { majik } = useMajik();
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [unlockResolver, setUnlockResolver] = useState<
    ((s: string) => void) | null
  >(null);

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

  const handleCancel = () => {
    if (unlockResolver) unlockResolver("");
    setUnlockId(null);
    setUnlockResolver(null);
  };

  const handleSubmit = (pass: string) => {
    if (unlockResolver) unlockResolver(pass);
    setUnlockId(null);
    setUnlockResolver(null);
  };

  return (
    <div className="popup-container">
      <UnlockModal
        identityId={unlockId}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        majik={majik}
        onSignout={() => setUnlockId(null)}
        onSwitchAccount={handleSwitchAccount}
      />
      <Toaster expand={true} position="top-right" />
    </div>
  );
}

export default App;
