"use client";

/**
 * Web3Auth social wallet session.
 *
 * Flow:
 *   1. User clicks "Sign in with Google / Apple" → Web3Auth modal opens.
 *   2. We read the EOA address from the EIP-1193 provider.
 *   3. If Web3Auth exposes `eth_private_key`, we also prepare the legacy Safe
 *      smart account path. Social providers may not expose that RPC method.
 *
 * Zama user-decryption requires the wallet address to stay checksummed.
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
import { privateKeyToAccount } from "viem/accounts";
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
        displayName: "Sepolia",
        blockExplorerUrl: "https://sepolia.etherscan.io",
        ticker: "ETH",
        tickerName: "Sepolia Ether",
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
  eoaAddress: Address;
  smartAccountAddress: Address;
  smartAccountClient: ReturnType<typeof createSmartAccountClient> | null;
  provider: Awaited<ReturnType<typeof getWeb3Auth>>["provider"];
  logout: () => Promise<void>;
};

async function requestPrivateKey(provider: NonNullable<SmartSession["provider"]>) {
  try {
    return (await provider.request({ method: "eth_private_key" })) as Hex;
  } catch (err: any) {
    const message = String(err?.message ?? err ?? "");
    if (message.toLowerCase().includes("method not found")) return null;
    throw err;
  }
}

/**
 * Trigger the Web3Auth modal and return a ready-to-use smart-account session.
 * Throws if Web3Auth isn't configured (no client ID) or the user cancels.
 */
export async function connectSmartAccount(): Promise<SmartSession> {
  const w3a = await getWeb3Auth();
  if (!w3a.connected) await w3a.connect();

  const provider = w3a.provider;
  if (!provider) throw new Error("Web3Auth returned no provider");

  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  const eoaAddress = getAddress(accounts?.[0] ?? "");
  const privateKey = await requestPrivateKey(provider);

  if (!privateKey) {
    return {
      eoaAddress,
      smartAccountAddress: eoaAddress,
      smartAccountClient: null,
      provider,
      logout: async () => {
        await w3a.logout();
      },
    };
  }

  const eoa = privateKeyToAccount(privateKey);
  const publicClient = getPublicClient();

  const smartAccount = await SafeSmartAccount.toSafeSmartAccount({
    client: publicClient,
    owners: [eoa],
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
    eoaAddress: eoa.address,
    smartAccountAddress: smartAccount.address,
    smartAccountClient,
    provider,
    logout: async () => {
      await w3a.logout();
    },
  };
}

// ─── High-level actions (each one = one UserOp) ──────────────────────────

/** Approve USDC to the PrizePool. One-time setup per session. */
export async function approveUSDC(
  session: SmartSession,
  amount: bigint
): Promise<Hex> {
  if (!session.smartAccountClient) {
    throw new Error("Smart account actions are unavailable for this Web3Auth provider.");
  }
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
  if (!session.smartAccountClient) {
    throw new Error("Smart account actions are unavailable for this Web3Auth provider.");
  }
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
  if (!session.smartAccountClient) {
    throw new Error("Smart account actions are unavailable for this Web3Auth provider.");
  }
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
  if (!session.smartAccountClient) {
    throw new Error("Smart account actions are unavailable for this Web3Auth provider.");
  }
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
  if (!session.smartAccountClient) {
    throw new Error("Smart account actions are unavailable for this Web3Auth provider.");
  }
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
          args: [shares, session.smartAccountAddress, session.smartAccountAddress],
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
