import React, { useEffect, useState } from "react";
import { EnvelopeCache, KeyStore } from "@majikah/majik-message";
import { MajikContext } from "./majik-context";
import DynamicPlaceholder from "../foundations/DynamicPlaceholder";
import { MajikMessageDatabase } from "./majik-message-database";
import { useMajikah } from "../majikah-session-wrapper/use-majikah";
import styled from "styled-components";

export const MajikMessageWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [majik, setMajik] = useState<MajikMessageDatabase | null>(null);

  const { majikah, loading: majikahLoading } = useMajikah();

  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeMajik = async (): Promise<void> => {
      try {
        // Wait for majikah to finish loading
        if (majikahLoading) return; // wait until user exists

        const userProfile: string = import.meta.env.VITE_USER_PROFILE;

        const instance =
          await MajikMessageDatabase.loadOrCreate<MajikMessageDatabase>(
            {
              keyStore: KeyStore,
              envelopeCache: new EnvelopeCache(undefined, userProfile),
            },
            userProfile,
          );

        if (majikah.isAuthenticated && majikah.user) {
          // Assign user before calling any user-dependent methods
          instance.user = majikah.user;
          await instance.refreshIdentities();
          console.log("User Loaded", majikah.user.email);
        } else {
          console.warn("No authenticated user found.");
        }

        if (!mounted) return;

        setMajik(instance);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pinHash = (instance as any).getPinHash?.();
        setLocked(!!pinHash);
      } catch (e) {
        console.error("Failed to initialize MajikMessage:", e);

        if (!mounted) return;

        const instance = new MajikMessageDatabase({
          keyStore: KeyStore,
          envelopeCache: new EnvelopeCache(),
        });

        if (!majikahLoading && !!majikah.user) {
          instance.user = majikah.user;
        }

        setMajik(instance);
        setLocked(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeMajik();

    return () => {
      mounted = false;
    };
  }, [majikahLoading, majikah.isAuthenticated, majikah.user]);

  const updateInstance = (data: MajikMessageDatabase): void => {
    setMajik(data);
  };

  const setPin = async (pin: string): Promise<void> => {
    if (!majik) throw new Error("Majik not initialized");
    await majik.setPIN(pin);
    setLocked(false);
  };

  const clearPin = async (): Promise<void> => {
    if (!majik) throw new Error("Majik not initialized");
    await majik.clearPIN();
    setLocked(false);
  };

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    if (!majik) throw new Error("Majik not initialized");
    const ok = await majik.isValidPIN(pin);
    if (ok) setLocked(false);
    return ok;
  };

  if (loading || !majik) {
    return (
      <RootContainer>
        <DynamicPlaceholder loading>
          Loading Majik Message...
        </DynamicPlaceholder>
      </RootContainer>
    );
  }

  return (
    <MajikContext.Provider
      value={{
        majik,
        loading,
        locked,
        setPin,
        clearPin,
        unlockWithPin,
        updateInstance,
      }}
    >
      {children}
    </MajikContext.Provider>
  );
};

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: inherit;
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  height: 100vh;
  width: 100vw;
`;
