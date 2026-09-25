// Contract addresses & ABIs. The active SorteCerta ABIs come from the shared
// protocol package; only the legacy prototype fragments remain local.

import { erc20Abi, erc4626Abi } from "viem";
import { publicConfig } from "./runtime-config";

export { confidentialPrizePoolAbi, confidentialUsdcAbi } from "@sortecerta/protocol";

export const CONTRACTS = {
  usdc: publicConfig("NEXT_PUBLIC_USDC_ADDRESS", process.env.NEXT_PUBLIC_USDC_ADDRESS) as `0x${string}`,
  confidentialUsdc: publicConfig("NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS", process.env.NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS) as `0x${string}`,
  confidentialPrizePool: publicConfig("NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS", process.env.NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS) as `0x${string}`,
  vault: publicConfig("NEXT_PUBLIC_VAULT_ADDRESS", process.env.NEXT_PUBLIC_VAULT_ADDRESS) as `0x${string}`,
  prizePool: publicConfig("NEXT_PUBLIC_PRIZE_POOL_ADDRESS", process.env.NEXT_PUBLIC_PRIZE_POOL_ADDRESS) as `0x${string}`,
  zamaSpike: publicConfig("NEXT_PUBLIC_ZAMA_SPIKE_ADDRESS", process.env.NEXT_PUBLIC_ZAMA_SPIKE_ADDRESS) as `0x${string}`,
} as const;

export const CHAIN_ID = Number(publicConfig("NEXT_PUBLIC_CHAIN_ID", process.env.NEXT_PUBLIC_CHAIN_ID) || 11155111);
export const RPC_URL = publicConfig("NEXT_PUBLIC_RPC_URL", process.env.NEXT_PUBLIC_RPC_URL) || "https://ethereum-sepolia-rpc.publicnode.com";
export const PIMLICO_API_KEY = publicConfig("NEXT_PUBLIC_PIMLICO_API_KEY", process.env.NEXT_PUBLIC_PIMLICO_API_KEY);
export const PIMLICO_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;
export const WEB3AUTH_CLIENT_ID = publicConfig("NEXT_PUBLIC_WEB3AUTH_CLIENT_ID", process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID);

export const zamaPrimitiveSpikeAbi = [
  {
    type: "function",
    name: "submitValue",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedValue", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getValue",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  { type: "function", name: "drawRandomForCaller", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "getLastRandom",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

// Plaintext prototype ABI retained for its separate legacy screens.
export const prizePoolAbi = [
  {
    type: "function",
    name: "currentDraw",
    stateMutability: "view",
    inputs: [],
    outputs: [{
      name: "",
      type: "tuple",
      components: [
        { name: "id", type: "uint256" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
        { name: "prizeAmount", type: "uint256" },
        { name: "winner", type: "address" },
        { name: "fulfilled", type: "bool" },
        { name: "randomWord", type: "uint256" },
      ],
    }],
  },
  {
    type: "function",
    name: "draws",
    stateMutability: "view",
    inputs: [{ name: "drawId", type: "uint256" }],
    outputs: [{
      name: "",
      type: "tuple",
      components: [
        { name: "id", type: "uint256" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
        { name: "prizeAmount", type: "uint256" },
        { name: "winner", type: "address" },
        { name: "fulfilled", type: "bool" },
        { name: "randomWord", type: "uint256" },
      ],
    }],
  },
  {
    type: "function",
    name: "depositAndBuyTickets",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fundPrizePool",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  { type: "function", name: "closeDraw", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "getTickets",
    stateMutability: "view",
    inputs: [{ name: "drawId", type: "uint256" }, { name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "drawInterval",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentDrawId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "DrawStarted",
    inputs: [
      { indexed: true, name: "drawId", type: "uint256" },
      { indexed: false, name: "startTime", type: "uint256" },
      { indexed: false, name: "endTime", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "WinnerPicked",
    inputs: [
      { indexed: true, name: "drawId", type: "uint256" },
      { indexed: true, name: "winner", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;

export { erc20Abi, erc4626Abi };
