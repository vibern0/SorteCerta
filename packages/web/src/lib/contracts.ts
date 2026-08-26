// Contract addresses & ABIs. In production these would be loaded from a
// generated typechain bundle; for MVP we hand-curate the ABI fragments we need.

import { erc20Abi, erc4626Abi } from "viem";

export const CONTRACTS = {
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "") as `0x${string}`,
  confidentialUsdc: (process.env.NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS ?? "") as `0x${string}`,
  confidentialPrizePool: (process.env.NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS ?? "") as `0x${string}`,
  vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "") as `0x${string}`,
  prizePool: (process.env.NEXT_PUBLIC_PRIZE_POOL_ADDRESS ?? "") as `0x${string}`,
  zamaSpike: (process.env.NEXT_PUBLIC_ZAMA_SPIKE_ADDRESS ?? "") as `0x${string}`,
} as const;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111); // Sepolia

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

export const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY ?? "";
export const PIMLICO_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;

export const WEB3AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ?? "";

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
  {
    type: "function",
    name: "drawRandomForCaller",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getLastRandom",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export const confidentialUsdcAbi = [
  ...erc20Abi,
  {
    type: "event",
    name: "UnwrapRequested",
    inputs: [
      { name: "receiver", type: "address", indexed: true },
      { name: "unwrapRequestId", type: "bytes32", indexed: true },
      { name: "amount", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UnwrapFinalized",
    inputs: [
      { name: "receiver", type: "address", indexed: true },
      { name: "unwrapRequestId", type: "bytes32", indexed: false },
      { name: "encryptedAmount", type: "bytes32", indexed: false },
      { name: "cleartextAmount", type: "uint64", indexed: false },
    ],
  },
  {
    type: "function",
    name: "wrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "confidentialTransferAndCall",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "unwrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "finalizeUnwrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "unwrapRequestId", type: "bytes32" },
      { name: "unwrapAmountCleartext", type: "uint64" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "unwrapRequester",
    stateMutability: "view",
    inputs: [{ name: "unwrapRequestId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

export const confidentialPrizePoolAbi = [
  {
    type: "function",
    name: "PRIZE_FUNDING_DATA",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes4" }],
  },
  {
    type: "function",
    name: "closeDraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "claimPrize",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "withdrawToUsdc",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "encryptedPrincipalOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "encryptedWinningsOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "encryptedTotalPrincipal",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "encryptedPrizeReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "publicPrizeReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "drawId",
    stateMutability: "view",
    inputs: [],
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
    name: "nextDrawAt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "participantCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Minimal ABI fragments we need in the UI.
export const prizePoolAbi = [
  {
    type: "function",
    name: "currentDraw",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
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
      },
    ],
  },
  {
    type: "function",
    name: "draws",
    stateMutability: "view",
    inputs: [{ name: "drawId", type: "uint256" }],
    outputs: [
      {
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
      },
    ],
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
  {
    type: "function",
    name: "closeDraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getTickets",
    stateMutability: "view",
    inputs: [
      { name: "drawId", type: "uint256" },
      { name: "user", type: "address" },
    ],
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
