import { getAddress, type Address, type Hex } from "viem";

import {
  confidentialPrizePoolAbi,
  confidentialUsdcAbi,
  erc20Abi,
  morphoBlueAbi,
  morphoIrmAbi,
  morphoOracleAbi,
  morphoYieldAdapterAbi,
} from "./abis/index.ts";
import { asBigInt } from "./decoders.ts";
import { decodeMarketParams, sameMarketParams, type MarketParams } from "./market-params.ts";
import { decodeMarketState, decodePosition, type MarketState } from "./market-state.ts";
import {
  accruedMarketState,
  positionHealth,
  safeBorrowCapacity,
  toBorrowAssetsUp,
  toSupplyAssetsDown,
  utilizationWad,
  WAD,
} from "./morpho-math.ts";
import type {
  DeploymentSnapshot,
  ProtocolDeploymentConfig,
  ProtocolSnapshotData,
} from "./snapshot-types.ts";

export type ProtocolReadClient = {
  getBlock(request: { blockNumber: bigint }): Promise<{ timestamp: bigint }>;
  getBalance(request: { address: Address; blockNumber?: bigint }): Promise<bigint>;
  readContract(request: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
  }): Promise<unknown>;
};

type SnapshotReadClient = ProtocolReadClient & { blockNumber: bigint };

export async function readProtocolSnapshotAtBlock(
  client: ProtocolReadClient,
  config: ProtocolDeploymentConfig,
  blockNumber: bigint,
  account?: Address,
): Promise<ProtocolSnapshotData> {
  const deployment = normalizeDeployment(config);
  const normalizedAccount = account === undefined ? undefined : getAddress(account);
  const { timestamp: blockTimestamp } = await client.getBlock({ blockNumber });
  const snapshotClient = atBlock(client, blockNumber);
  const activeAdapter = getAddress(await readAddress(
    snapshotClient,
    deployment.pool,
    confidentialPrizePoolAbi,
    "morphoYieldAdapter",
  ));
  assertActiveAdapter(deployment.adapter, activeAdapter);

  const [
    drawId, nextDrawAt, participantCount, publicPrizeReserve,
    morphoPendingDepositCount, lastMorphoUnwrapAt, morphoUnwrapInterval,
    encryptedTotalPrincipalHandle, encryptedPrizeReserveHandle,
    encryptedPendingMorphoPrincipalHandle, withdrawalBatchId,
    adapterUsdc, adapterConfidentialUsdc, adapterPrizePool, adapterMorpho,
    adapterMarketId, suppliedPrincipal, idlePrincipal, availablePrincipalAssets,
    accruedYieldAssets, suppliedAssets, adapterMarketParamsRaw,
    marketParamsRaw, marketStateRaw,
  ] = await Promise.all([
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "drawId"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "nextDrawAt"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "participantCount"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "publicPrizeReserve"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "morphoPendingDepositCount"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "lastMorphoUnwrapAt"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "morphoUnwrapInterval"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "encryptedTotalPrincipal"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "encryptedPrizeReserve"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "encryptedPendingMorphoPrincipal"),
    read(snapshotClient, deployment.pool, confidentialPrizePoolAbi, "currentWithdrawalBatchId"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "usdc"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "confidentialUsdc"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "prizePool"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "morpho"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "marketId"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "suppliedPrincipal"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "idlePrincipal"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "availablePrincipalAssets"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "accruedYieldAssets"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "suppliedAssets"),
    read(snapshotClient, deployment.adapter, morphoYieldAdapterAbi, "marketParams"),
    read(snapshotClient, deployment.morpho, morphoBlueAbi, "idToMarketParams", [deployment.marketId]),
    read(snapshotClient, deployment.morpho, morphoBlueAbi, "market", [deployment.marketId]),
  ]);

  const adapterMarketParams = decodeMarketParams(adapterMarketParamsRaw);
  const marketParams = decodeMarketParams(marketParamsRaw);
  assertBindings(
    deployment, adapterUsdc, adapterConfidentialUsdc, adapterPrizePool,
    adapterMorpho, adapterMarketId, adapterMarketParams, marketParams,
  );
  const marketState = decodeMarketState(marketStateRaw);
  const [withdrawalBatch, oraclePrice, borrowRatePerSecond, adapterUsdcBalance, adapterPositionRaw] = await Promise.all([
    readWithdrawalBatch(snapshotClient, deployment.pool, asBigInt(withdrawalBatchId, "withdrawal batch id")),
    read(snapshotClient, marketParams.oracle, morphoOracleAbi, "price").then((value) => asBigInt(value, "oracle price")),
    readBorrowRate(snapshotClient, marketParams, marketState),
    read(snapshotClient, deployment.usdc, erc20Abi, "balanceOf", [deployment.adapter]),
    read(snapshotClient, deployment.morpho, morphoBlueAbi, "position", [deployment.marketId, deployment.adapter]),
  ]);
  const accruedState =
    borrowRatePerSecond === undefined && marketState.totalBorrowAssets > 0n && blockTimestamp > marketState.lastUpdate
      ? undefined
      : accruedMarketState(marketState, borrowRatePerSecond, blockTimestamp);
  const utilization = accruedState === undefined
    ? undefined
    : utilizationWad(accruedState.totalBorrowAssets, accruedState.totalSupplyAssets);
  const accountSnapshot = normalizedAccount === undefined
    ? undefined
    : await readAccount(snapshotClient, deployment, normalizedAccount, accruedState, marketParams, oraclePrice);
  const adapterPosition = decodePosition(adapterPositionRaw);
  const rawSuppliedAssets = asBigInt(suppliedAssets, "supplied assets");
  const rawAccruedYieldAssets = asBigInt(accruedYieldAssets, "accrued yield assets");
  const trackedPrincipal = asBigInt(suppliedPrincipal, "supplied principal");
  const trackedIdlePrincipal = asBigInt(idlePrincipal, "idle principal");
  const projectedSuppliedAssets = accruedState === undefined
    ? rawSuppliedAssets
    : trackedIdlePrincipal + toSupplyAssetsDown(
      adapterPosition.supplyShares,
      accruedState.totalSupplyAssets,
      accruedState.totalSupplyShares,
    );
  const projectedAccruedYieldAssets = accruedState === undefined
    ? rawAccruedYieldAssets
    : projectedSuppliedAssets > trackedPrincipal ? projectedSuppliedAssets - trackedPrincipal : 0n;

  return {
    blockNumber,
    blockTimestamp,
    deployment,
    pool: {
      drawId: asBigInt(drawId, "draw id"),
      nextDrawAt: asBigInt(nextDrawAt, "next draw time"),
      participantCount: asBigInt(participantCount, "participant count"),
      publicPrizeReserve: asBigInt(publicPrizeReserve, "prize reserve"),
      morphoPendingDepositCount: asBigInt(morphoPendingDepositCount, "pending deposit count"),
      lastMorphoUnwrapAt: asBigInt(lastMorphoUnwrapAt, "last unwrap time"),
      morphoUnwrapInterval: asBigInt(morphoUnwrapInterval, "unwrap interval"),
      encryptedTotalPrincipalHandle: encryptedTotalPrincipalHandle as Hex,
      encryptedPrizeReserveHandle: encryptedPrizeReserveHandle as Hex,
      encryptedPendingMorphoPrincipalHandle: encryptedPendingMorphoPrincipalHandle as Hex,
      withdrawalBatch,
    },
    adapter: {
      usdcBalance: asBigInt(adapterUsdcBalance, "adapter USDC balance"),
      supplyShares: adapterPosition.supplyShares,
      backingDifference: projectedSuppliedAssets - trackedPrincipal,
      usdc: getAddress(adapterUsdc as Address),
      confidentialUsdc: getAddress(adapterConfidentialUsdc as Address),
      prizePool: getAddress(adapterPrizePool as Address),
      morpho: getAddress(adapterMorpho as Address),
      marketId: adapterMarketId as Hex,
      suppliedPrincipal: trackedPrincipal,
      idlePrincipal: trackedIdlePrincipal,
      availablePrincipalAssets: asBigInt(availablePrincipalAssets, "available principal assets"),
      accruedYieldAssets: projectedAccruedYieldAssets,
      suppliedAssets: projectedSuppliedAssets,
      marketParams: adapterMarketParams,
    },
    market: {
      liquidity: marketState.totalSupplyAssets > marketState.totalBorrowAssets
        ? marketState.totalSupplyAssets - marketState.totalBorrowAssets : 0n,
      supplierRatePerSecond: borrowRatePerSecond === undefined || utilization === undefined
        ? undefined
        : (((borrowRatePerSecond * utilization) / WAD) * (WAD - marketState.fee)) / WAD,
      state: marketState,
      params: marketParams,
      oraclePrice,
      borrowRatePerSecond,
      utilizationWad: utilization,
    },
    account: accountSnapshot,
  };
}

function normalizeDeployment(config: ProtocolDeploymentConfig): DeploymentSnapshot {
  return {
    usdc: getAddress(config.usdc),
    weth: getAddress(config.weth),
    wrapper: getAddress(config.wrapper),
    pool: getAddress(config.pool),
    adapter: getAddress(config.adapter),
    morpho: getAddress(config.morpho),
    marketId: config.marketId,
  };
}

async function readWithdrawalBatch(client: SnapshotReadClient, pool: Address, id: bigint) {
  const [status, closesAt, funded, restoredAmount, requestCount, claimantCount] = await Promise.all([
    read(client, pool, confidentialPrizePoolAbi, "withdrawalBatchStatus", [id]),
    read(client, pool, confidentialPrizePoolAbi, "withdrawalBatchClosesAt", [id]),
    read(client, pool, confidentialPrizePoolAbi, "withdrawalBatchFunded", [id]),
    read(client, pool, confidentialPrizePoolAbi, "withdrawalBatchRestoredAmount", [id]),
    read(client, pool, confidentialPrizePoolAbi, "withdrawalBatchRequestCount", [id]),
    read(client, pool, confidentialPrizePoolAbi, "withdrawalBatchClaimantCount", [id]),
  ]);
  return {
    id,
    status: Number(status),
    closesAt: asBigInt(closesAt, "withdrawal close time"),
    funded: Boolean(funded),
    restoredAmount: asBigInt(restoredAmount, "restored amount"),
    requestCount: asBigInt(requestCount, "withdrawal request count"),
    claimantCount: asBigInt(claimantCount, "withdrawal claimant count"),
  };
}

function readBorrowRate(
  client: SnapshotReadClient,
  marketParams: MarketParams,
  marketState: MarketState,
): Promise<bigint | undefined> {
  return Promise.resolve()
    .then(() => read(client, marketParams.irm, morphoIrmAbi, "borrowRateView", [marketParams, marketState]))
    .then((value) => asBigInt(value, "borrow rate"))
    .catch(() => undefined);
}

async function readAccount(
  client: SnapshotReadClient,
  deployment: DeploymentSnapshot,
  account: Address,
  marketState: MarketState | undefined,
  marketParams: MarketParams,
  oraclePrice: bigint,
) {
  const [
    positionRaw, ethBalance, wethBalance, morphoUsdcAllowance, morphoWethAllowance,
    usdcBalance, usdcAllowance, confidentialUsdcHandle,
    encryptedPrincipalHandle, encryptedWinningsHandle,
  ] = await Promise.all([
    read(client, deployment.morpho, morphoBlueAbi, "position", [deployment.marketId, account]),
    client.getBalance({ address: account, blockNumber: client.blockNumber }),
    read(client, deployment.weth, erc20Abi, "balanceOf", [account]),
    read(client, deployment.usdc, erc20Abi, "allowance", [account, deployment.morpho]),
    read(client, deployment.weth, erc20Abi, "allowance", [account, deployment.morpho]),
    read(client, deployment.usdc, erc20Abi, "balanceOf", [account]),
    read(client, deployment.usdc, erc20Abi, "allowance", [account, deployment.wrapper]),
    read(client, deployment.wrapper, confidentialUsdcAbi, "confidentialBalanceOf", [account]),
    read(client, deployment.pool, confidentialPrizePoolAbi, "encryptedPrincipalOf", [account]),
    read(client, deployment.pool, confidentialPrizePoolAbi, "encryptedWinningsOf", [account]),
  ]);
  const position = decodePosition(positionRaw);
  const borrowAssets = marketState === undefined ? undefined : toBorrowAssetsUp(
    position.borrowShares, marketState.totalBorrowAssets, marketState.totalBorrowShares,
  );
  const health = borrowAssets === undefined ? undefined : positionHealth({
    collateralAssets: position.collateralAssets,
    collateralPrice: oraclePrice,
    borrowAssets,
    lltv: marketParams.lltv,
  });
  return {
    address: account,
    position,
    health,
    suppliedAssets: marketState === undefined ? undefined : toSupplyAssetsDown(
      position.supplyShares, marketState.totalSupplyAssets, marketState.totalSupplyShares,
    ),
    remainingBorrowCapacity: health === undefined ? undefined : safeBorrowCapacity(health, marketParams.lltv),
    tokens: {
      ethBalance,
      wethBalance: asBigInt(wethBalance, "WETH balance"),
      morphoUsdcAllowance: asBigInt(morphoUsdcAllowance, "Morpho USDC allowance"),
      morphoWethAllowance: asBigInt(morphoWethAllowance, "Morpho WETH allowance"),
      usdcBalance: asBigInt(usdcBalance, "USDC balance"),
      usdcAllowance: asBigInt(usdcAllowance, "USDC allowance"),
      confidentialUsdcHandle: confidentialUsdcHandle as Hex,
    },
    encryptedPrincipalHandle: encryptedPrincipalHandle as Hex,
    encryptedWinningsHandle: encryptedWinningsHandle as Hex,
  };
}

function assertBindings(
  deployment: DeploymentSnapshot,
  usdc: unknown,
  wrapper: unknown,
  pool: unknown,
  morpho: unknown,
  marketId: unknown,
  adapterParams: MarketParams,
  registeredParams: MarketParams,
): void {
  if (
    getAddress(usdc as Address) !== deployment.usdc ||
    getAddress(wrapper as Address) !== deployment.wrapper ||
    getAddress(pool as Address) !== deployment.pool ||
    getAddress(morpho as Address) !== deployment.morpho ||
    marketId !== deployment.marketId ||
    !sameMarketParams(adapterParams, registeredParams) ||
    adapterParams.loanToken !== deployment.usdc ||
    adapterParams.collateralToken !== deployment.weth
  ) throw new Error("Adapter market parameters or deployment bindings do not match the configured values");
}

function assertActiveAdapter(configuredAdapter: Address, activeAdapter: Address): void {
  if (configuredAdapter !== activeAdapter) {
    throw new Error("Configured adapter is not the pool's active Morpho adapter");
  }
}

function readAddress(
  client: SnapshotReadClient,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
): Promise<Address> {
  return read(client, address, abi, functionName) as Promise<Address>;
}

function read(
  client: SnapshotReadClient,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args?: readonly unknown[],
) {
  return client.readContract({ address, abi, functionName, args, blockNumber: client.blockNumber });
}

function atBlock(client: ProtocolReadClient, blockNumber: bigint): SnapshotReadClient {
  return {
    getBlock: client.getBlock.bind(client),
    getBalance: client.getBalance.bind(client),
    readContract: client.readContract.bind(client),
    blockNumber,
  };
}
