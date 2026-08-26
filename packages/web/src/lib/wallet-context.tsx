"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  connectSmartAccount,
  restoreSmartAccount,
  type SmartSession,
  isWeb3AuthConfigured,
  isPimlicoConfigured,
} from "./web3auth";
import { decryptConfidentialBalances } from "./confidential-balances";

type WalletState = {
  session: SmartSession | null;
  connecting: boolean;
  error: string | null;
  ready: boolean;
};

type WalletContextValue = WalletState & {
  confidentialBalance: bigint | undefined;
  principal: bigint | undefined;
  confidentialBalancesLoading: boolean;
  confidentialBalancesError: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshConfidentialBalances: () => Promise<void>;
  web3AuthReady: boolean;
  pimlicoReady: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    session: null,
    connecting: true,
    error: null,
    ready: false,
  });
  const [confidentialBalance, setConfidentialBalance] = useState<bigint | undefined>();
  const [principal, setPrincipal] = useState<bigint | undefined>();
  const [confidentialBalancesLoading, setConfidentialBalancesLoading] = useState(false);
  const [confidentialBalancesError, setConfidentialBalancesError] = useState<string | null>(null);
  const balanceLoadId = useRef(0);

  const loadConfidentialBalances = useCallback(async (currentSession: SmartSession) => {
    const loadId = balanceLoadId.current + 1;
    balanceLoadId.current = loadId;
    setConfidentialBalancesLoading(true);
    setConfidentialBalancesError(null);
    try {
      const balances = await decryptConfidentialBalances(currentSession);
      if (balanceLoadId.current !== loadId) return;
      setConfidentialBalance(balances.confidentialBalance);
      setPrincipal(balances.principal);
    } catch {
      if (balanceLoadId.current !== loadId) return;
      setConfidentialBalancesError("Could not load your savings balance.");
    } finally {
      if (balanceLoadId.current === loadId) setConfidentialBalancesLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!isWeb3AuthConfigured()) {
        setState((s) => ({ ...s, connecting: false, ready: true }));
        return;
      }

      try {
        const session = await restoreSmartAccount();
        if (cancelled) return;
        setState({ session, connecting: false, error: null, ready: true });
      } catch {
        if (cancelled) return;
        setState({
          session: null,
          connecting: false,
          error: "Could not restore your login.",
          ready: true,
        });
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    if (!isWeb3AuthConfigured()) {
      setState((s) => ({
        ...s,
        error: "Sign-in is unavailable right now.",
      }));
      return;
    }
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const session = await connectSmartAccount();
      setState({ session, connecting: false, error: null, ready: true });
    } catch {
      setState((s) => ({
        ...s,
        connecting: false,
        error: "Could not sign you in.",
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
    balanceLoadId.current += 1;
    setConfidentialBalance(undefined);
    setPrincipal(undefined);
    setConfidentialBalancesError(null);
    setConfidentialBalancesLoading(false);
    setState({ session: null, connecting: false, error: null, ready: true });
  }, [state.session]);

  useEffect(() => {
    if (!state.session) {
      balanceLoadId.current += 1;
      setConfidentialBalance(undefined);
      setPrincipal(undefined);
      setConfidentialBalancesError(null);
      setConfidentialBalancesLoading(false);
      return;
    }

    void loadConfidentialBalances(state.session);
  }, [state.session, loadConfidentialBalances]);

  const refreshConfidentialBalances = useCallback(async () => {
    if (!state.session) return;
    await loadConfidentialBalances(state.session);
  }, [state.session, loadConfidentialBalances]);

  const value = useMemo<WalletContextValue>(
    () => ({
      ...state,
      confidentialBalance,
      principal,
      confidentialBalancesLoading,
      confidentialBalancesError,
      connect,
      disconnect,
      refreshConfidentialBalances,
      web3AuthReady: isWeb3AuthConfigured(),
      pimlicoReady: isPimlicoConfigured(),
    }),
    [
      state,
      confidentialBalance,
      principal,
      confidentialBalancesLoading,
      confidentialBalancesError,
      connect,
      disconnect,
      refreshConfidentialBalances,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
