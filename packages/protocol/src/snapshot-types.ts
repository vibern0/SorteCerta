import type { Address, Hex } from "viem";

import type { MarketState, Position, PositionHealth } from "./market-state.ts";

export type ProtocolDeploymentConfig = {
  usdc: Address;
  weth: Address;
  wrapper: Address;
  pool: Address;
  adapter: Address;
  morpho: Address;
  marketId: Hex;
};

export type DeploymentSnapshot = ProtocolDeploymentConfig;

export type NormalizedMarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

export type WithdrawalBatchSnapshot = {
  id: bigint;
  status: number;
  closesAt: bigint;
  funded: boolean;
  restoredAmount: bigint;
  requestCount: bigint;
  claimantCount: bigint;
};

export type PoolSnapshot = {
  drawId: bigint;
  nextDrawAt: bigint;
  participantCount: bigint;
  publicPrizeReserve: bigint;
  morphoPendingDepositCount: bigint;
  lastMorphoUnwrapAt: bigint;
  morphoUnwrapInterval: bigint;
  encryptedTotalPrincipalHandle: Hex;
  encryptedPrizeReserveHandle: Hex;
  encryptedPendingMorphoPrincipalHandle: Hex;
  withdrawalBatch: WithdrawalBatchSnapshot;
};

export type AdapterSnapshot = {
  usdcBalance: bigint;
  supplyShares: bigint;
  backingDifference: bigint;
  usdc: Address;
  confidentialUsdc: Address;
  prizePool: Address;
  morpho: Address;
  marketId: Hex;
  suppliedPrincipal: bigint;
  idlePrincipal: bigint;
  availablePrincipalAssets: bigint;
  accruedYieldAssets: bigint;
  suppliedAssets: bigint;
  marketParams: NormalizedMarketParams;
};

export type MorphoMarketSnapshot = {
  liquidity: bigint;
  supplierRatePerSecond?: bigint;
  state: MarketState;
  params: NormalizedMarketParams;
  oraclePrice: bigint;
  borrowRatePerSecond?: bigint;
  utilizationWad?: bigint;
};

export type TokenSnapshot = {
  ethBalance: bigint;
  wethBalance: bigint;
  morphoUsdcAllowance: bigint;
  morphoWethAllowance: bigint;
  usdcBalance: bigint;
  usdcAllowance: bigint;
  confidentialUsdcHandle: Hex;
};

export type AccountSnapshot = {
  address: Address;
  position: Position;
  health?: PositionHealth;
  suppliedAssets?: bigint;
  remainingBorrowCapacity?: bigint;
  tokens: TokenSnapshot;
  encryptedPrincipalHandle: Hex;
  encryptedWinningsHandle: Hex;
};

export type ProtocolSnapshotData = {
  blockNumber: bigint;
  blockTimestamp: bigint;
  deployment: DeploymentSnapshot;
  pool: PoolSnapshot;
  adapter: AdapterSnapshot;
  market: MorphoMarketSnapshot;
  account?: AccountSnapshot;
};
