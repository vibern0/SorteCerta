"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  connectSmartAccount,
  type SmartSession,
  isWeb3AuthConfigured,
  isPimlicoConfigured,
} from "./web3auth";

type WalletState = {
  session: SmartSession | null;
  connecting: boolean;
  error: string | null;
  ready: boolean;
};

type WalletContextValue = WalletState & {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  web3AuthReady: boolean;
  pimlicoReady: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    session: null,
    connecting: false,
    error: null,
    ready: false,
  });

  useEffect(() => {
    setState((s) => ({ ...s, ready: true }));
  }, []);

  const connect = useCallback(async () => {
    if (!isWeb3AuthConfigured()) {
      setState((s) => ({
        ...s,
        error:
          "Web3Auth client ID not set. Add NEXT_PUBLIC_WEB3AUTH_CLIENT_ID to .env.local.",
      }));
      return;
    }
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const session = await connectSmartAccount();
      setState({ session, connecting: false, error: null, ready: true });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: err?.message ?? "Failed to connect",
      }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (state.session) {
      try {
        await state.session.logout();
      } catch {
        // best-effort
      }
    }
    setState({ session: null, connecting: false, error: null, ready: true });
  }, [state.session]);

  const value = useMemo<WalletContextValue>(
    () => ({
      ...state,
      connect,
      disconnect,
      web3AuthReady: isWeb3AuthConfigured(),
      pimlicoReady: isPimlicoConfigured(),
    }),
    [state, connect, disconnect]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
