import { parseAbi } from "viem";

export const erc20ReadAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "spender" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const confidentialTokenReadAbi = [
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const prizePoolReadAbi = [
  {
    type: "function",
    name: "morphoYieldAdapter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "drawId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextDrawAt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "participantCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "publicPrizeReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "morphoPendingDepositCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "lastMorphoUnwrapAt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "morphoUnwrapInterval",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "encryptedTotalPrincipal",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "encryptedPrizeReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "encryptedPendingMorphoPrincipal",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "currentWithdrawalBatchId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "withdrawalBatchStatus",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "batchId" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "withdrawalBatchClosesAt",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "batchId" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "withdrawalBatchFunded",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "batchId" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "withdrawalBatchRestoredAmount",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "batchId" }],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "withdrawalBatchRequestCount",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "batchId" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "withdrawalBatchClaimantCount",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "batchId" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "encryptedPrincipalOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "encryptedWinningsOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

const marketParams = [
  { type: "address", name: "loanToken" },
  { type: "address", name: "collateralToken" },
  { type: "address", name: "oracle" },
  { type: "address", name: "irm" },
  { type: "uint256", name: "lltv" },
] as const;

const market = [
  { type: "uint128", name: "totalSupplyAssets" },
  { type: "uint128", name: "totalSupplyShares" },
  { type: "uint128", name: "totalBorrowAssets" },
  { type: "uint128", name: "totalBorrowShares" },
  { type: "uint128", name: "lastUpdate" },
  { type: "uint128", name: "fee" },
] as const;

export const morphoReadAbi = [
  {
    type: "function",
    name: "idToMarketParams",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "id" }],
    outputs: [{ type: "tuple", components: marketParams }],
  },
  {
    type: "function",
    name: "market",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "id" }],
    outputs: [{ type: "tuple", components: market }],
  },
  {
    type: "function",
    name: "position",
    stateMutability: "view",
    inputs: [
      { type: "bytes32", name: "id" },
      { type: "address", name: "user" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "supplyShares" },
          { type: "uint128", name: "borrowShares" },
          { type: "uint128", name: "collateral" },
        ],
      },
    ],
  },
] as const;

export const adapterReadAbi = [
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "confidentialUsdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "prizePool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "morpho",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "marketId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "suppliedPrincipal",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "idlePrincipal",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "availablePrincipalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "accruedYieldAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "suppliedAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "marketParams",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "tuple", components: marketParams }],
  },
] as const;

export const oracleReadAbi = [
  {
    type: "function",
    name: "price",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const irmReadAbi = [
  {
    type: "function",
    name: "borrowRateView",
    stateMutability: "view",
    inputs: [
      { type: "tuple", components: marketParams, name: "marketParams" },
      { type: "tuple", components: market, name: "market" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const erc20WriteAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const wethWriteAbi = parseAbi([
  "function deposit() payable",
  "function withdraw(uint256 amount)",
]);

export const morphoWriteAbi = parseAbi([
  "struct MarketParams { address loanToken; address collateralToken; address oracle; address irm; uint256 lltv; }",
  "function supply(MarketParams marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256, uint256)",
  "function withdraw(MarketParams marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)",
  "function supplyCollateral(MarketParams marketParams, uint256 assets, address onBehalf, bytes data)",
  "function borrow(MarketParams marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)",
  "function repay(MarketParams marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256, uint256)",
  "function withdrawCollateral(MarketParams marketParams, uint256 assets, address onBehalf, address receiver)",
]);
