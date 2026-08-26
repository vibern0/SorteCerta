"use client";

/**
 * Web3Auth social-login smart account session.
 *
 * Flow:
 *   1. User clicks "Sign in with Google / Apple" → Web3Auth modal opens.
 *   2. Web3Auth provides the owner key used to derive the Safe smart account.
 *   3. Every app transaction is sent as an ERC-4337 UserOp through Pimlico.
 *
 * Zama user-decryption requires the smart account address to stay checksummed.
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { SafeSmartAccount } from "permissionless/accounts/safe";
import { createSmartAccountClient } from "permissionless/clients";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";
import {
  CHAIN_NAMESPACES,
  WEB3AUTH_NETWORK,
  Web3Auth,
  type Web3AuthOptions,
} from "@web3auth/modal";

import { CONTRACTS, PIMLICO_URL, RPC_URL, prizePoolAbi } from "./contracts";
import { stringifyTypedData } from "./zama";

// ─── Web3Auth lifecycle (browser-only) ─────────────────────────────────────

let _web3auth: Web3Auth | null = null;

async function getWeb3Auth(): Promise<Web3Auth> {
  if (_web3auth) return _web3auth;
  if (typeof window === "undefined") {
    throw new Error("Web3Auth can only be initialized in the browser");
  }
  const options: Web3AuthOptions = {
    clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ?? "",
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    chains: [
      {
        chainNamespace: CHAIN_NAMESPACES.EIP155,
        chainId: "0xaa36a7", // Sepolia
        rpcTarget: RPC_URL,
        displayName: "Ethereum",
        blockExplorerUrl: "https://sepolia.etherscan.io",
        ticker: "ETH",
        tickerName: "Ether",
        logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
      },
    ],
    defaultChainId: "0xaa36a7",
    uiConfig: {
      appName: "SorteCerta",
      loginMethodsOrder: ["google", "apple"],
      defaultLanguage: "pt",
      mode: "dark",
      theme: {
        primary: "#7C5CFF",
      },
    },
  };
  _web3auth = new Web3Auth(options);
  await _web3auth.init();
  return _web3auth;
}

function getPublicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });
}

function getPimlicoClient() {
  return createPimlicoClient({
    transport: http(PIMLICO_URL),
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });
}

// ─── Session ──────────────────────────────────────────────────────────────

export type SmartSession = {
  address: Address;
  ownerAddress: Address;
  smartAccountClient: ReturnType<typeof createSmartAccountClient>;
  signOwnerTypedData: (typedData: unknown) => Promise<Hex>;
  logout: () => Promise<void>;
};

async function createSmartSession(
  w3a: Web3Auth,
  provider: NonNullable<Web3Auth["provider"]>,
  requestAccounts = false
): Promise<SmartSession> {
  const providerState = provider as any;
  let ownerAccounts = Array.isArray(providerState.state?.accounts)
    ? providerState.state.accounts
    : [];
  if (ownerAccounts.length === 0 && providerState.selectedAddress) {
    ownerAccounts = [providerState.selectedAddress];
  }
  if (ownerAccounts.length === 0 && requestAccounts) {
    ownerAccounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
  }
  if (!ownerAccounts[0]) throw new Error("Web3Auth returned no owner account");
  const ownerAddress = getAddress(ownerAccounts[0]);

  const publicClient = getPublicClient();

  const smartAccount = await SafeSmartAccount.toSafeSmartAccount({
    client: publicClient,
    owners: [provider as any],
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
    version: "1.4.1",
  });

  const pimlicoClient = getPimlicoClient();
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: sepolia,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gas = await pimlicoClient.getUserOperationGasPrice();
        return gas.fast;
      },
    },
  });

  return {
    address: getAddress(smartAccount.address),
    ownerAddress,
    smartAccountClient,
    signOwnerTypedData: async (typedData) =>
      (await provider.request({
        method: "eth_signTypedData_v4",
        params: [ownerAddress, stringifyTypedData(typedData)],
      })) as Hex,
    logout: async () => {
      await w3a.logout();
    },
  };
}

/**
 * Trigger the Web3Auth modal and return a ready-to-use smart-account session.
 * Throws if Web3Auth isn't configured (no client ID) or the user cancels.
 */
export async function connectSmartAccount(): Promise<SmartSession> {
  const w3a = await getWeb3Auth();
  const provider = w3a.connected ? w3a.provider : await w3a.connect();
  if (!provider) throw new Error("Web3Auth returned no provider");
  return createSmartSession(w3a, provider, true);
}

/**
 * Restore a previous Web3Auth login without opening the modal.
 * Returns null when there is no cached Web3Auth provider.
 */
export async function restoreSmartAccount(): Promise<SmartSession | null> {
  const w3a = await getWeb3Auth();
  if (!w3a.connected || !w3a.provider) return null;
  return createSmartSession(w3a, w3a.provider);
}

// ─── High-level actions (each one = one UserOp) ──────────────────────────

export async function sendSmartTransaction(
  session: SmartSession,
  to: Address,
  data: Hex
): Promise<Hex> {
  return session.smartAccountClient.sendTransaction({
    calls: [{ to, data }],
  });
}

export async function sendSmartTransactionBatch(
  session: SmartSession,
  calls: { to: Address; data: Hex }[]
): Promise<Hex> {
  return session.smartAccountClient.sendTransaction({ calls });
}

export async function signSmartTypedData(
  session: SmartSession,
  typedData: unknown
): Promise<Hex> {
  return session.smartAccountClient.signTypedData(typedData as any);
}

export async function signOwnerTypedData(
  session: SmartSession,
  typedData: unknown
): Promise<Hex> {
  return session.signOwnerTypedData(typedData);
}

/** Approve USDC to the PrizePool. One-time setup per session. */
export async function approveUSDC(
  session: SmartSession,
  amount: bigint
): Promise<Hex> {
  return session.smartAccountClient.sendTransaction({
    calls: [
      {
        to: CONTRACTS.usdc,
        data: encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "approve",
              stateMutability: "nonpayable",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
            },
          ],
          functionName: "approve",
          args: [CONTRACTS.prizePool, amount],
        }),
      },
    ],
  });
}

/** Deposit USDC and buy tickets for the active draw. */
export async function depositAndBuyTickets(
  session: SmartSession,
  amount: bigint
): Promise<Hex> {
  return session.smartAccountClient.sendTransaction({
    calls: [
      {
        to: CONTRACTS.prizePool,
        data: encodeFunctionData({
          abi: prizePoolAbi,
          functionName: "depositAndBuyTickets",
          args: [amount],
        }),
      },
    ],
  });
}

/** Add USDC to the active draw's prize pool (sponsor stand-in for yield). */
export async function fundPrizePool(
  session: SmartSession,
  amount: bigint
): Promise<Hex> {
  return session.smartAccountClient.sendTransaction({
    calls: [
      {
        to: CONTRACTS.prizePool,
        data: encodeFunctionData({
          abi: prizePoolAbi,
          functionName: "fundPrizePool",
          args: [amount],
        }),
      },
    ],
  });
}

/** Close the current draw (anyone can call after the period ends). */
export async function closeDraw(session: SmartSession): Promise<Hex> {
  return session.smartAccountClient.sendTransaction({
    calls: [
      {
        to: CONTRACTS.prizePool,
        data: encodeFunctionData({
          abi: prizePoolAbi,
          functionName: "closeDraw",
        }),
      },
    ],
  });
}

/** Redeem vault shares for USDC. */
export async function redeemShares(
  session: SmartSession,
  shares: bigint
): Promise<Hex> {
  return session.smartAccountClient.sendTransaction({
    calls: [
      {
        to: CONTRACTS.vault,
        data: encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "redeem",
              stateMutability: "nonpayable",
              inputs: [
                { name: "shares", type: "uint256" },
                { name: "receiver", type: "address" },
                { name: "owner", type: "address" },
              ],
              outputs: [{ name: "", type: "uint256" }],
            },
          ],
          functionName: "redeem",
          args: [shares, session.address, session.address],
        }),
      },
    ],
  });
}

export function isWeb3AuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID);
}

export function isPimlicoConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PIMLICO_API_KEY);
}
