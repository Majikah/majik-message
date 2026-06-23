import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

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

import DynamicPlaceholder from "./components/foundations/DynamicPlaceholder";
import AccountsPanel from "./components/panels/AccountsPanel";

import ContactsPanel from "./components/panels/ContactsPanel";
import UnlockModal from "./components/UnlockModal";

import {
  TabRouter,
  type RouterTabContent,
} from "./components/functional/TabRouter";

import { useMajikah } from "./components/majikah-session-wrapper/use-majikah";

import MajikMessageOnboardingGate from "./components/MajikMessageOnboardingGate";
import { launchTutorialOnboarding } from "./lib/shepherd-js/tutorials/tutorial-onboarding";
import { useShepherd } from "./lib/shepherd-js/use-shepherd";

import { listen } from "@tauri-apps/api/event";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";

import { useNavigate } from "react-router-dom";
import { toggleTheme } from "./redux/slices/system";
import { useDispatch } from "react-redux";

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

import {
  API_RESPONSE_SIGN_IN,
  API_RESPONSE_SIGN_UP,
} from "./components/majikah-session-wrapper/api-types";
import { MajikMessageDatabase } from "./components/majik-context-wrapper/majik-message-database";
import { CreateKeyModal } from "./components/panels/accounts/modals/CreateKeyModal";
import { ImportKeyModal } from "./components/panels/accounts/modals/ImportKeyModal";
import { ImportContactModal } from "./components/panels/contacts/modals";
import { MajikahAuthModal } from "./components/panels/accounts/modals/MajikahAuthModal";
import { ImportAppDataModal } from "./components/panels/modals/ImportAppDataModal";
import { ImportContactBackupModal } from "./components/panels/contacts/modals/ImportContactBackupModal";
import { AppSettingsModal } from "./components/panels/settings/AppSettingsModal";
import { ExportAccountKeyModal } from "./components/panels/accounts/modals/ExportAccountKeyModal";
import {
  AppDataSnapshot,
  ContactManagerSnapshot,
} from "@majikah/majik-message/dist/core/backup/types";
import { sendNotification } from "@tauri-apps/plugin-notification";

type ModalKeyContext =
  | "create-account"
  | "replace-account"
  | "import-account"
  | "import-contact"
  | "import-contact-backup"
  | "import-file-mjkb"
  | "export-contacts"
  | "export-backup"
  | "restore-backup"
  | "export-majik-key"
  | "validate-thread"
  | "auth-majikah"
  | "user-preferences"
  | null;

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
  const userNotifications = useMajikahNotifications();

  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [unlockResolver, setUnlockResolver] = useState<
    ((s: string) => void) | null
  >(null);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [modalKey, setModalKey] = useState<ModalKeyContext>(null);

  const [refreshKey, setRefreshKey] = useState<number>(0);

  const [pendingContactBackupSnapshot, setPendingContactBackupSnapshot] =
    useState<ContactManagerSnapshot | null>(null);

  const [pendingAppDataSnapshot, setPendingAppDataSnapshot] =
    useState<AppDataSnapshot | null>(null);

  useFirebaseTauriPush({
    config: firebaseConfig,
    publicKey: majik?.currentIdentity?.publicKey || null,
    session: majikah,
    enabled: true,
    onPushReceived: () => {
      userNotifications.notifyActivity();
    },
  });
  useEffect(() => {
    // Wire majik.keyManager.onUnlockRequested to present our React modal
    majik.keyManager.onUnlockRequested = (id: string) => {
      return new Promise<string>((resolve) => {
        setUnlockId(id);
        setUnlockResolver(() => resolve);
      });
    };

    return () => {
      majik.keyManager.onUnlockRequested = undefined;
    };
  }, []);

  useEffect(() => {
    if (!majikah) return;

    const handleSignIn = async () => {
      if (!isTauri()) return;

      invoke("set_auth_state", { signedIn: true })
        .catch(console.error)
        .finally(() => console.log("User Signed In", true));
    };

    const handleSignOut = async () => {
      if (!isTauri()) return;

      majik.clearUser();

      invoke("set_auth_state", { signedIn: false })
        .catch(console.error)
        .finally(() => console.log("User Signed Out", false));
    };

    majikah.on("sign-in", handleSignIn);
    majikah.on("sign-out", handleSignOut);
    return () => {
      majikah.off("sign-in", handleSignIn);
      majikah.off("sign-out", handleSignOut);
    };
  }, [majikah]);

  useEffect(() => {
    if (!majik) return;

    const active = majik.getActiveAccount();
    if (!active) return;

    try {
      // Try accessing private key
      majik.keyManager.getPrivateKey(active.id);

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
        listen("trigger-export-contacts", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          const backupBlob = await majik.backupContacts();
          const blobBuffer = await backupBlob.arrayBuffer();

          const backupFileName = `${activeAccount?.meta.label || activeAccount?.id || "User"}  - Contacts Backup`;

          const filePath = await save({
            defaultPath: backupFileName,
            filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
          });

          if (!filePath) {
            toast.info("Backup cancelled");
            return;
          } else {
            await writeFile(filePath, new Uint8Array(blobBuffer));
          }

          toast.success("Contacts Backup Saved", {
            description: `${backupFileName} exported successfully.`,
          });

          sendNotification({
            title: "Contacts Backup Saved",
            body: backupFileName,
          });
        }),
        listen("trigger-encrypt-file", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
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
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
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

        listen("trigger-user-preferences", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("user-preferences");
        }),

        // ─────────────────────────────────────────────────────────────
        // Tools
        // ─────────────────────────────────────────────────────────────

        listen("trigger-export-majik-key", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("export-majik-key");
        }),

        listen("trigger-start-tutorial", () => {
          launchTutorialOnboarding(tour);
        }),
        listen("trigger-create-account", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          if (userAccounts.length >= MAX_ACCOUNT_LIMIT) {
            toast.error("Account Limit Reached", {
              description: `You have reached the maximum limit of ${MAX_ACCOUNT_LIMIT} accounts.`,
              id: "toast-error-account-limit",
            });
            return;
          }
          setModalKey("create-account");
          navigate("/accounts");
        }),
        listen("trigger-import-account", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          if (userAccounts.length >= MAX_ACCOUNT_LIMIT) {
            toast.error("Account Limit Reached", {
              description: `You have reached the maximum limit of ${MAX_ACCOUNT_LIMIT} accounts.`,
              id: "toast-error-account-limit",
            });
            return;
          }
          setModalKey("import-account");
          navigate("/accounts");
        }),

        listen("trigger-import-contact", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("import-contact");
          navigate("/contacts");
        }),

        listen("trigger-import-contact-backup", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          try {
            const selected = await open({
              multiple: false,
              filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
            });
            if (!selected) return;

            const uint8 = await readFile(selected as string);
            const snapshot = await majik.readContactsBackup(uint8);

            if (snapshot.contacts.length === 0) {
              toast.warning("Empty backup", {
                description:
                  "No contacts were found in the selected backup file.",
              });
              return;
            }

            setPendingContactBackupSnapshot(snapshot);
            setModalKey("import-contact-backup");
          } catch (error) {
            console.error(error);
            toast.error("Failed to read contact backup", {
              description: (error as any)?.message || String(error),
            });
          }
        }),

        listen("trigger-import-app-data", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          try {
            const selected = await open({
              multiple: false,
              filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
            });
            if (!selected) return;

            const uint8 = await readFile(selected as string);
            const snapshot = await majik.readAppDataBackup(uint8);

            const hasAnything =
              (snapshot.chats && snapshot.chats.length > 0) ||
              snapshot.contacts.length > 0 ||
              snapshot.preferences !== null;

            if (!hasAnything) {
              toast.warning("Empty backup", {
                description: "This backup file appears to contain no data.",
              });
              return;
            }

            setPendingAppDataSnapshot(snapshot);
            setModalKey("restore-backup");
          } catch (error) {
            console.error(error);
            toast.error("Failed to read backup file", {
              description: (error as any)?.message || String(error),
            });
          }
        }),

        listen("trigger-refresh-identities", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          await majik.refreshIdentities();
          setRefreshKey((prev) => prev + 1);
        }),
        listen("trigger-auth-sign-in", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("auth-majikah");
        }),

        listen("trigger-auth-sign-out", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          if (!majikah.isAuthenticated) return;

          const run = async (): Promise<string> => {
            await majikah.signOut();
            toast.success("Signed Out");
            majik.clearUser();
            majik.clearAllCaches();

            return "Signed out from Majikah.";
          };

          toast.promise(run(), {
            loading: `Signing Out…`,
            success: (m) => {
              navigate("/muid");
              return m;
            },
            error: (err) =>
              err instanceof Error ? err.message : "Problem Signing Out.",
          });
        }),

        listen("trigger-export-app-data", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          const backupBlob = await majik.backupAppData();
          const blobBuffer = await backupBlob.arrayBuffer();

          const backupFileName = `${activeAccount?.meta.label || activeAccount?.id || "User"} - Majik Message - App Data Backup`;

          const filePath = await save({
            defaultPath: backupFileName,
            filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
          });

          if (!filePath) {
            toast.info("Backup cancelled");
            return;
          } else {
            await writeFile(filePath, new Uint8Array(blobBuffer));
          }

          toast.success("App Data Backup Saved", {
            description: `${backupFileName} exported successfully.`,
          });

          sendNotification({
            title: "App Data Backup Saved",
            body: backupFileName,
          });
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
  }, [majik, majikah, dispatch, navigate, tour, userAccounts.length, unlocked]);

  useEffect(() => {
    invoke("set_auth_state", { signedIn: majikah.isAuthenticated }).catch(
      console.error,
    );
  }, [majikah.isAuthenticated]);

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

      await majik.unlockAccount(unlockId, pass);

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

  // ── ReplaceKey success ─────────────────────────────────────────────────────
  const handleModalSuccess = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, [majik]);

  const handleAuthSuccess = useCallback(
    async (response: API_RESPONSE_SIGN_IN | API_RESPONSE_SIGN_UP) => {
      navigate("/muid");
      setRefreshKey((prev) => prev + 1);
      setModalKey(null);
      if (!!response.user) {
        await majik.refreshIdentities();
      }
    },
    [majik],
  );

  if (loading) {
    return (
      <RootContainer>
        <DynamicPlaceholder loading>Loading...</DynamicPlaceholder>
      </RootContainer>
    );
  }

  const activeAccount = useMemo(() => {
    return majik.getActiveAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

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
      notification: (
        <NotificationDot count={userNotifications.unreadChatCount} />
      ),
    },
    {
      id: "threads",
      route: "/threads",
      name: "Threads",
      icon: LinkIcon,
      element: <EmailThreads majik={majik} onUpdate={handleRefreshInstance} />,
      notification: (
        <NotificationDot count={userNotifications.unreadThreadCount} />
      ),
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

        <AppSettingsModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "user-preferences"}
          onOpenChange={(change) =>
            setModalKey(change ? "user-preferences" : null)
          }
        />
        <CreateKeyModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "create-account"}
          onOpenChange={(change) =>
            setModalKey(change ? "create-account" : null)
          }
        />

        <ImportKeyModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "import-account"}
          onOpenChange={(change) =>
            setModalKey(change ? "import-account" : null)
          }
        />

        <ExportAccountKeyModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "export-majik-key"}
          onOpenChange={(change) =>
            setModalKey(change ? "export-majik-key" : null)
          }
        />
        <ImportContactModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "import-contact"}
          onOpenChange={(change) =>
            setModalKey(change ? "import-contact" : null)
          }
        />

        <ImportContactBackupModal
          open={modalKey === "import-contact-backup"}
          onOpenChange={(change) => {
            setModalKey(change ? "import-contact-backup" : null);
            if (!change) setPendingContactBackupSnapshot(null);
          }}
          majik={majik}
          snapshot={pendingContactBackupSnapshot}
          onSuccess={handleModalSuccess}
        />

        <ImportAppDataModal
          open={modalKey === "restore-backup"}
          onOpenChange={(change) => {
            setModalKey(change ? "restore-backup" : null);
            if (!change) setPendingAppDataSnapshot(null);
          }}
          majik={majik}
          snapshot={pendingAppDataSnapshot}
          onSuccess={handleModalSuccess}
        />

        <MajikahAuthModal
          onSuccessSignIn={handleAuthSuccess}
          onSuccessSignUp={handleAuthSuccess}
          open={modalKey === "auth-majikah"}
          onOpenChange={(change) => setModalKey(change ? "auth-majikah" : null)}
        />
      </MajikMessageOnboardingGate>
    </RootContainer>
  );
}

export default App;
