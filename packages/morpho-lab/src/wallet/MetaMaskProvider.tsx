import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type PropsWithChildren,
} from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  type Abi,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { sepolia } from "viem/chains";

import type { LabConfig } from "../config";
import { selectMetaMaskProvider } from "./eip1193";
import { waitForActionReceipt } from "./receipt";
import {
  transactionReducer,
  type TransactionRecord,
} from "./transaction-state";

export type SimulatedWriteArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  summary: string;
};

export type MetaMaskContextValue = {
  account?: Address;
  chainId?: number;
  status: "missing" | "disconnected" | "connecting" | "connected";
  publicClient: PublicClient;
  walletClient?: WalletClient;
  ethBalance?: bigint;
  error?: string;
  transactions: TransactionRecord[];
  connect(): Promise<void>;
  switchToConfiguredChain(): Promise<void>;
  submitSimulatedWrite(args: SimulatedWriteArgs): Promise<Hash>;
};

const MetaMaskContext = createContext<MetaMaskContextValue | undefined>(undefined);

export function MetaMaskProvider({
  children,
  config,
}: PropsWithChildren<{ config: LabConfig }>) {
  const provider = selectMetaMaskProvider(
    typeof window === "undefined" ? undefined : window.ethereum
  );
  const publicClient = useMemo(
    () => createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) }),
    [config.rpcUrl]
  );
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [status, setStatus] = useState<MetaMaskContextValue["status"]>(
    provider === undefined ? "missing" : "disconnected"
  );
  const [ethBalance, setEthBalance] = useState<bigint>();
  const [error, setError] = useState<string>();
  const [transactions, dispatchTransaction] = useReducer(transactionReducer, []);

  const walletClient = useMemo(
    () =>
      provider === undefined || account === undefined
        ? undefined
        : createWalletClient({
            account,
            chain: sepolia,
            transport: custom(provider),
          }),
    [account, provider]
  );

  useEffect(() => {
    if (provider === undefined) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccount = selectedAccount(accounts);
      setAccount(nextAccount);
      setStatus(nextAccount === undefined ? "disconnected" : "connected");
      if (nextAccount === undefined) {
        setError("Select one MetaMask account to use the lab.");
      }
    };
    const handleChainChanged = (nextChainId: unknown) => {
      setChainId(parseChainId(nextChainId));
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    void provider
      .request({ method: "eth_chainId" })
      .then(handleChainChanged)
      .catch((reason: unknown) => setError(errorMessage(reason)));

    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
    };
  }, [provider]);

  useEffect(() => {
    if (account === undefined) {
      setEthBalance(undefined);
      return;
    }

    let cancelled = false;
    void publicClient
      .getBalance({ address: getAddress(account) })
      .then((balance) => {
        if (!cancelled) setEthBalance(balance);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [account, publicClient]);

  const connect = useCallback(async () => {
    if (provider === undefined) {
      const message = "MetaMask provider is unavailable.";
      setError(message);
      throw new Error(message);
    }

    setStatus("connecting");
    setError(undefined);
    try {
      const requestedAccounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const nextAccount = selectedAccount(requestedAccounts);
      if (nextAccount === undefined) throw new Error("Select one MetaMask account to use the lab.");
      const nextChainId = parseChainId(
        await provider.request({ method: "eth_chainId" })
      );
      setAccount(nextAccount);
      setChainId(nextChainId);
      setStatus("connected");
    } catch (reason) {
      setStatus("disconnected");
      setError(errorMessage(reason));
      throw reason;
    }
  }, [provider]);

  const switchToConfiguredChain = useCallback(async () => {
    if (provider === undefined) {
      const message = "MetaMask provider is unavailable.";
      setError(message);
      throw new Error(message);
    }

    setError(undefined);
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${config.chainId.toString(16)}` }],
      });
      setChainId(config.chainId);
    } catch (reason) {
      setError(errorMessage(reason));
      throw reason;
    }
  }, [config.chainId, provider]);

  const submitSimulatedWrite = useCallback(
    async (args: SimulatedWriteArgs) => {
      const id = globalThis.crypto.randomUUID();
      try {
        if (account === undefined || walletClient === undefined) {
          throw new Error("Connect MetaMask before submitting a transaction.");
        }
        if (chainId !== config.chainId) {
          throw new Error(`Switch MetaMask to chain ID ${config.chainId} before writing.`);
        }

        const simulation = await publicClient.simulateContract({
          address: getAddress(args.address),
          abi: args.abi,
          functionName: args.functionName,
          args: args.args,
          account: getAddress(account),
          value: args.value,
        } as never);
        const hash = await walletClient.writeContract(simulation.request);
        dispatchTransaction({ type: "submitted", id, summary: args.summary, hash });

        const receipt = await waitForActionReceipt(publicClient, hash, (hash) => {
          dispatchTransaction({ type: "repriced", id, hash });
        });

        dispatchTransaction({
          type: "confirmed",
          id,
          blockNumber: receipt.blockNumber,
        });
        return receipt.transactionHash;
      } catch (reason) {
        const message = errorMessage(reason);
        dispatchTransaction({ type: "failed", id, summary: args.summary, error: message });
        setError(message);
        throw reason;
      }
    },
    [account, chainId, config.chainId, publicClient, walletClient]
  );

  const value = useMemo<MetaMaskContextValue>(
    () => ({
      account,
      chainId,
      status,
      publicClient,
      walletClient,
      ethBalance,
      error,
      transactions,
      connect,
      switchToConfiguredChain,
      submitSimulatedWrite,
    }),
    [
      account,
      chainId,
      connect,
      error,
      ethBalance,
      publicClient,
      status,
      submitSimulatedWrite,
      switchToConfiguredChain,
      transactions,
      walletClient,
    ]
  );

  return <MetaMaskContext.Provider value={value}>{children}</MetaMaskContext.Provider>;
}

export function useMetaMask(): MetaMaskContextValue {
  const context = useContext(MetaMaskContext);
  if (context === undefined) {
    throw new Error("useMetaMask must be used inside MetaMaskProvider.");
  }
  return context;
}

function selectedAccount(value: unknown): Address | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== "string"
  ) {
    return undefined;
  }
  return getAddress(value[0]);
}

function parseChainId(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 16);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
