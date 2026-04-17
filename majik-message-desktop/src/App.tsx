import { useEffect, useMemo, useState, type JSX } from "react";

import { toast } from "sonner";

import styled from "styled-components";

import {
  AddressBookIcon,
  ChatIcon,
  EnvelopeIcon,
  FileLockIcon,
  LinkIcon,
  StarFourIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useMajik } from "./components/majik-context-wrapper/use-majik";
import {
  jsonToSeed,
  MajikKeyStore,
  seedStringToArray,
  type MnemonicJSON,
} from "@majikah/majik-message";
import type { MajikMessageDatabase } from "./components/majik-context-wrapper/majik-message-database";
import DynamicPlaceholder from "./components/foundations/DynamicPlaceholder";
import AccountsPanel from "./components/panels/AccountsPanel";

import ContactsPanel from "./components/panels/ContactsPanel";
import UnlockModal from "./components/UnlockModal";

import {
  TabRouter,
  type RouterTabContent,
} from "./components/functional/TabRouter";

import DynamicPopUp from "./components/functional/DynamicPopUp";
import CustomInputField from "./components/foundations/CustomInputField";
import { SeedKeyInput } from "./components/foundations/SeedKeyInput";
import { downloadBlob, isDevEnvironment } from "./utils/utils";
import { useMajikah } from "./components/majikah-session-wrapper/use-majikah";

import MajikMessageOnboardingGate from "./components/MajikMessageOnboardingGate";
import { launchTutorialOnboarding } from "./lib/shepherd-js/tutorials/tutorial-onboarding";
import { useShepherd } from "./lib/shepherd-js/use-shepherd";

import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile, readFile } from "@tauri-apps/plugin-fs";

import { useNavigate } from "react-router-dom";
import { toggleTheme } from "./redux/slices/system";
import { useDispatch } from "react-redux";
import { sendNotification } from "@tauri-apps/plugin-notification";

import { basename } from "@tauri-apps/api/path";
import MajikahPanel from "./components/panels/MajikahPanel";
import FilePanel from "./components/panels/FilePanel";
import MessagePanel from "./components/panels/MessagePanel";
import EmailThreads from "./components/panels/threads/EmailThreads";
import { NotificationDot } from "./components/functional/Notification/NotificationDot";
import ConversationSidePanel from "./components/panels/conversations/ConversationSidePanel";
import { useFirebaseTauriPush } from "./lib/firebase/use-firebase-notifications";
import { MajikContact } from "@majikah/majik-contact";
import { useMajikahNotifications } from "./components/majikah-notification-wrapper/use-majikah-notifications";
import { useMajikTutorials } from "./hooks/use-majik-tutorials";
import DynamicAlertBanner from "./components/foundations/DynamicAlertBanner";

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: inherit;
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  height: 100vh;
  width: 100vw;
`;

const MAX_ACCOUNT_LIMIT = 25;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY!,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID!,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: import.meta.env.VITE_FIREBASE_APP_ID!,
  vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY!,
};

function App(): JSX.Element {
  const tour = useShepherd();
  const { add: addTutorial } = useMajikTutorials();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { majik, loading, updateInstance } = useMajik();
  const { majikah } = useMajikah();
  const { unreadChatCount, unreadThreadCount } = useMajikahNotifications();

  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [unlockResolver, setUnlockResolver] = useState<
    ((s: string) => void) | null
  >(null);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false);
  const [isImportingAccount, setIsImportingAccount] = useState<boolean>(false);
  const [isAddingContact, setIsAddingContact] = useState<boolean>(false);

  const [refreshKey, setRefreshKey] = useState<number>(0);

  const [label, setLabel] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [mnemonic, setMnemonic] = useState<string>("");

  const [mnemonicJSON, setMnemonicJSON] = useState<MnemonicJSON>({
    id: "",
    seed: Array(12).fill(""),
    phrase: "",
  });

  const [inviteKey, setInviteKey] = useState<string>("");

  useFirebaseTauriPush({
    config: firebaseConfig,
    publicKey: majik?.currentIdentity?.publicKey || null,
    session: majikah,
    enabled: true,
  });

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
    if (isDevEnvironment()) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
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

  const userAccounts = useMemo(() => {
    return majik.listOwnAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  useEffect(() => {
    let isCancelled = false;
    const handlers: Array<() => void> = [];

    const register = async () => {
      const unlisteners = await Promise.all([
        listen("trigger-encrypt-file", async () => {
          try {
            const selected = await open({
              multiple: false,
              filters: [{ name: "All Files", extensions: ["*"] }],
            });
            if (!selected) return;

            const filePath = selected as string;
            const uint8 = await readFile(filePath);
            const fileName = await basename(filePath);

            navigate("/files", {
              state: {
                pendingFile: {
                  bytes: Array.from(uint8), // serialisable for router state
                  name: fileName,
                },
                mode: "encrypt",
              },
            });
          } catch (error) {
            toast.error("Failed to open file for encryption", {
              description: (error as any)?.message || String(error),
            });
          }
        }),

        listen("trigger-decrypt-file", async () => {
          try {
            const selected = await open({
              multiple: false,
              filters: [
                { name: "MajikB Files", extensions: ["mjkb"] },
                { name: "All Files", extensions: ["*"] },
              ],
            });
            if (!selected) return;

            const filePath = selected as string;
            const uint8 = await readFile(filePath);
            const fileName = await basename(filePath);

            navigate("/files", {
              state: {
                pendingFile: {
                  bytes: Array.from(uint8),
                  name: fileName,
                },
                mode: "decrypt",
              },
            });
          } catch (error) {
            toast.error("Failed to open file for decryption", {
              description: (error as any)?.message || String(error),
            });
          }
        }),
        listen("trigger-toggle-dark-mode", () => {
          dispatch(toggleTheme());
        }),

        listen("trigger-start-tutorial", () => {
          launchTutorialOnboarding(tour);
        }),
        listen("trigger-create-account", async () => {
          if (userAccounts.length >= MAX_ACCOUNT_LIMIT) {
            toast.error("Account Limit Reached", {
              description: `You have reached the maximum limit of ${MAX_ACCOUNT_LIMIT} accounts.`,
              id: "toast-error-account-limit",
            });
            return;
          }
          setIsCreatingAccount(true);
        }),
        listen("trigger-import-account", async () => {
          if (userAccounts.length >= MAX_ACCOUNT_LIMIT) {
            toast.error("Account Limit Reached", {
              description: `You have reached the maximum limit of ${MAX_ACCOUNT_LIMIT} accounts.`,
              id: "toast-error-account-limit",
            });
            return;
          }
          try {
            const selected = await open({
              multiple: false,
              filters: [{ name: "Backup", extensions: ["json"] }],
            });
            if (!selected) return;

            const raw = await readTextFile(selected as string);
            const json = JSON.parse(raw) as MnemonicJSON;

            if (!json) {
              toast.error("Invalid Backup File", {
                description:
                  "There seems to be a problem with the backup file.",
              });
              return;
            }

            setMnemonicJSON(json);
            setIsImportingAccount(true);
            setRefreshKey((k) => k + 1);
          } catch (error) {
            console.error(error);
            toast.error("Failed to import mnemonic backup", {
              description: (error as any)?.message || String(error),
            });
          }
        }),
        listen("trigger-import-contact", () => {
          setIsAddingContact(true);
        }),
        listen("trigger-auth-sign-in", () => {
          navigate("/majikah");
        }),
        listen("trigger-auth-sign-out", async () => {
          if (!majikah.isAuthenticated) return;
          const user = majikah.user;
          try {
            await majikah.signOut();
            toast.success("Signed Out", {
              description: `Signed out from Majikah, ${user?.displayName || user?.email}.`,
              id: "toast-success-sign-out",
            });
          } catch {
            toast.error("Problem Signing Out", {
              description: `There was a problem signing out, ${user?.displayName || user?.email}.`,
              id: "toast-error-sign-out",
            });
          } finally {
            navigate("/majikah");
          }
        }),
      ]);

      // If the effect was cleaned up while we were awaiting, immediately unlisten
      if (isCancelled) {
        unlisteners.forEach((fn) => fn());
        return;
      }

      handlers.push(...unlisteners);
    };

    register();

    return () => {
      isCancelled = true;
      handlers.forEach((fn) => fn());
    };
  }, [majik, majikah, userAccounts.length, dispatch]);

  useEffect(() => {
    invoke("set_auth_state", { signedIn: majikah.isAuthenticated }).catch(
      console.error,
    );
  }, [majikah.isAuthenticated]);

  const handleCreate = async (): Promise<void> => {
    if (!mnemonic?.trim()) {
      toast.error("Failed to create account", {
        description: "Mnemonic Seed Phrase must be a non-empty string.",
        id: "toast-error-create",
      });
      return;
    }

    try {
      let accountID = "Unknown";

      if (!passphrase?.trim()) {
        toast.error("Failed to create account", {
          description: "Password must be a non-empty string.",
          id: "toast-error-create",
        });
        return;
      }

      const createdAccount = await majik.createAccountFromMnemonic(
        mnemonic.trim(),
        passphrase,
        label,
      );
      accountID = createdAccount.id;

      const jsonData: MnemonicJSON = {
        id: createdAccount.backup,
        seed: seedStringToArray(mnemonic.trim()),
        phrase: passphrase?.trim() ? passphrase.trim() : undefined,
      };

      const blob = new Blob([JSON.stringify(jsonData)], {
        type: "application/json;charset=utf-8",
      });

      // Open the native save dialog
      const filePath = await save({
        defaultPath: `${label} | ${createdAccount.id} | SEED KEY`,
        filters: [
          {
            name: "Backup JSON",
            extensions: ["json"],
          },
        ],
      });

      // User cancelled the dialog
      if (!filePath) {
        downloadBlob(
          blob,
          "json",
          `${label} | ${createdAccount.id} | SEED KEY`,
        );
      } else {
        // Convert blob → Uint8Array and write to the chosen path
        const arrayBuffer = await blob.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }

      toast.success("Account Created Successfully", {
        description: `New account for ${label || accountID} created.`,
        id: `toast-success-create-${label}`,
      });

      sendNotification({
        title: "Account Created Successfully",
        body: `New Account for ${label || accountID} created successfully.`,
      });

      window.location.reload();

      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Account Creation Failed", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: "error-majik-message-account-create",
      });
    }
  };

  const handleAddContact = async (): Promise<void> => {
    if (!inviteKey?.trim()) {
      toast.error("Invalid Invite Key", {
        description: "Please provide a valid invite key.",
        id: `toast-error-add-${inviteKey}`,
      });
      return;
    }
    try {
      await majik.importContactFromString(inviteKey);
      setRefreshKey((prev) => prev + 1);
      toast.success("New Contact Added Succesfully", {
        description: inviteKey,
        id: `toast-success-add-${inviteKey}`,
      });

      sendNotification({
        title: "New Contact Added Successfully",
        body: inviteKey,
      });
      navigate("/contacts");
    } catch (e) {
      toast.error("Failed to Add New Contact", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: "error-majik-add",
      });
    }
  };

  const handleCancel = (): void => {
    if (unlockResolver) unlockResolver("");
    setUnlockId(null);
    setUnlockResolver(null);
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

  const handleUpdatePassphrase = (value: string): void => {
    setPassphrase(value?.trim() ? value : "");
  };

  const handleSeedKeyChange = (input: MnemonicJSON): void => {
    if (!input) return;

    const stringSeed = jsonToSeed(input);
    setMnemonicJSON(input);
    setMnemonic(stringSeed);
  };

  const resetForm = (): void => {
    setLabel("");
    setPassphrase("");
    setMnemonic("");
    setMnemonicJSON({
      id: "",
      seed: Array(12).fill(""),
      phrase: "",
    });
  };

  // ── Import mnemonic ────────────────────────────────────────────────────────
  const handleLoadMnemonicAccount = async (): Promise<void> => {
    if (!majik) {
      toast.error("Problem Loading Majik Signature");
      return;
    }
    if (!mnemonicJSON) {
      toast.error("Invalid Backup File", {
        description: "There seems to be a problem with the backup file.",
      });
      return;
    }

    if (!passphrase?.trim()) {
      toast.error("Invalid Passphrase", {
        description: "Please provide a valid passphrase.",
      });
      return;
    }
    try {
      await majik.importAccountFromMnemonicBackup(
        mnemonicJSON.id,
        mnemonic.trim(),
        passphrase || "",
        label,
      );
      resetForm();
      toast.success("Account imported from mnemonic backup");

      sendNotification({
        title: "Account Imported Successfully",
        body: `New Account for ${label || mnemonicJSON.id} created successfully.`,
      });
      window.location.reload();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import mnemonic backup", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
      });
    }
  };

  if (loading) {
    return (
      <RootContainer>
        <DynamicPlaceholder loading>Loading...</DynamicPlaceholder>
      </RootContainer>
    );
  }

  const tabs: RouterTabContent[] = [
    {
      id: "accounts",
      route: "/accounts",
      icon: UserIcon,
      name: "Accounts",
      element: <AccountsPanel majik={majik} onUpdate={handleRefreshInstance} />,
    },

    {
      id: "chats",
      route: "/chats",
      name: "Chats",
      icon: ChatIcon,
      element: (
        <ConversationSidePanel majik={majik} onUpdate={handleRefreshInstance} />
      ),
      notification: <NotificationDot count={unreadChatCount} />,
    },
    {
      id: "threads",
      route: "/threads",
      name: "Threads",
      icon: LinkIcon,
      element: <EmailThreads majik={majik} onUpdate={handleRefreshInstance} />,
      notification: <NotificationDot count={unreadThreadCount} />,
    },
    {
      id: "contacts",
      route: "/contacts",
      name: "Contacts",
      icon: AddressBookIcon,
      element: <ContactsPanel majik={majik} onUpdate={handleRefreshInstance} />,
    },
    {
      id: "message",
      route: "/message",
      name: "Message",
      icon: EnvelopeIcon,
      element: <MessagePanel majik={majik} />,
    },
    {
      id: "files",
      route: "/files",
      name: "File Vault",
      icon: FileLockIcon,
      element: <FilePanel majik={majik} />,
    },
    {
      id: "majikah",
      route: "/majikah",
      name: "Majikah",
      icon: StarFourIcon,
      element: <MajikahPanel majik={majik} onUpdate={handleRefreshInstance} />,
    },
  ];

  const atLimit = userAccounts.length >= MAX_ACCOUNT_LIMIT;

  return (
    <RootContainer>
      <MajikMessageOnboardingGate
        majikah={majikah}
        majik={majik}
        onUpdate={handleRefreshInstance}
        onLaunchTour={() =>
          launchTutorialOnboarding(tour, () => {
            addTutorial("tutorial-majik-message-onboarding:v:0.0.1");
          })
        }
      >
        <TabRouter tabs={tabs} key={refreshKey} />
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
        <DynamicPopUp
          scrollable
          isOpen={isCreatingAccount}
          onOpenChange={setIsCreatingAccount}
          modal={{
            title: "Create Account",
            description:
              userAccounts.length >= MAX_ACCOUNT_LIMIT
                ? "Max accounts reached."
                : "Create a new account with a mnemonic seed phrase.",
          }}
          buttons={{
            cancel: {
              text: "Cancel",
            },
            confirm: {
              text: "Save Changes",
              isDisabled:
                !label?.trim() || !mnemonic?.trim() || !passphrase?.trim(),
              onClick: handleCreate,
            },
          }}
        >
          {/* Security warning */}
          <DynamicAlertBanner
            title="Keep this private"
            description={`
                Never share your seed phrase or backup JSON file with anyone.
                Anyone who has them gains full access to your account. Store
                your backup in a safe, offline location.
          `}
            level="danger"
          />
          <CustomInputField
            onChange={(e) => setLabel(e)}
            maxChar={100}
            regex="letters"
            label="Display Name"
            required
            importProp={{
              type: "txt",
            }}
            currentValue={label}
          />
          <SeedKeyInput
            importProp={{
              type: "json",
            }}
            allowGenerate={true}
            onUpdatePassphrase={handleUpdatePassphrase}
            onChange={handleSeedKeyChange}
            readonly
            currentValue={{ ...mnemonicJSON, phrase: passphrase }}
          />
        </DynamicPopUp>

        <DynamicPopUp
          scrollable
          isOpen={isImportingAccount}
          onOpenChange={setIsImportingAccount}
          modal={{
            title: "Import Account",
            description: atLimit
              ? "Maximum account limit reached."
              : "Import an account from a mnemonic seed phrase.",
          }}
          buttons={{
            cancel: { text: "Cancel", onClick: resetForm },
            confirm: {
              text: "Import Account",
              isDisabled:
                !mnemonicJSON?.id?.trim() ||
                !mnemonicJSON ||
                mnemonicJSON.seed.length === 0 ||
                !passphrase?.trim(),
              onClick: handleLoadMnemonicAccount,
            },
          }}
        >
          <CustomInputField
            onChange={(e) => setLabel(e)}
            maxChar={100}
            regex="letters"
            label="Display Name"
            currentValue={label}
            sensitive
          />
          <SeedKeyInput
            importProp={{ type: "json" }}
            requireBackupKey
            onUpdatePassphrase={handleUpdatePassphrase}
            onChange={handleSeedKeyChange}
            readonly={false}
            currentValue={{ ...mnemonicJSON, phrase: passphrase }}
          />
        </DynamicPopUp>

        <DynamicPopUp
          scrollable
          isOpen={isAddingContact}
          onOpenChange={setIsAddingContact}
          modal={{
            title: "Add Contact",
            description: "Add a new contact to your list.",
          }}
          buttons={{
            cancel: {
              text: "Cancel",
            },
            confirm: {
              text: "Save Changes",
              onClick: handleAddContact,
            },
          }}
        >
          <CustomInputField
            currentValue={inviteKey}
            onChange={(e) => setInviteKey(e)}
            maxChar={10000}
            label="Invite Key"
            required
            importProp={{
              type: "txt",
            }}
            sensitive={true}
          />
        </DynamicPopUp>
      </MajikMessageOnboardingGate>
    </RootContainer>
  );
}

export default App;
