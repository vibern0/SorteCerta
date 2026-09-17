import { getAddress, type Address, type Hex } from "viem";

import {
  adapterReadAbi,
  confidentialTokenReadAbi,
  erc20ReadAbi,
  irmReadAbi,
  morphoReadAbi,
  oracleReadAbi,
  prizePoolReadAbi,
} from "../abis";
import type { LabConfig } from "../config";
import { positionHealth, toBorrowAssetsUp, utilizationWad } from "./math";
import type {
  MarketParams,
  MarketState,
  Position,
  ProtocolSnapshot,
} from "../types";

export type ProtocolReadClient = {
  getBlockNumber(): Promise<bigint>;
  readContract(request: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
  }): Promise<unknown>;
};

type SnapshotReadClient = ProtocolReadClient & { blockNumber: bigint };

export async function readProtocolSnapshot(
  client: ProtocolReadClient,
  config: LabConfig,
  account?: Address
): Promise<ProtocolSnapshot> {
  const deployment = normalizeDeployment(config);
  const normalizedAccount =
    account === undefined ? undefined : getAddress(account);
  const blockNumber = await client.getBlockNumber();
  const snapshotClient = atBlock(client, blockNumber);
  const activeAdapter = getAddress(
    (await read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "morphoYieldAdapter"
    )) as Address
  );
  assertActiveAdapter(deployment.adapter, activeAdapter);
  const [
    drawId,
    nextDrawAt,
    participantCount,
    publicPrizeReserve,
    morphoPendingDepositCount,
    lastMorphoUnwrapAt,
    morphoUnwrapInterval,
    encryptedTotalPrincipalHandle,
    encryptedPrizeReserveHandle,
    encryptedPendingMorphoPrincipalHandle,
    withdrawalBatchId,
    adapterUsdc,
    adapterConfidentialUsdc,
    adapterPrizePool,
    adapterMorpho,
    adapterMarketId,
    suppliedPrincipal,
    idlePrincipal,
    availablePrincipalAssets,
    accruedYieldAssets,
    suppliedAssets,
    adapterMarketParamsRaw,
    marketParamsRaw,
    marketStateRaw,
  ] = await Promise.all([
    read(snapshotClient, deployment.pool, prizePoolReadAbi, "drawId"),
    read(snapshotClient, deployment.pool, prizePoolReadAbi, "nextDrawAt"),
    read(snapshotClient, deployment.pool, prizePoolReadAbi, "participantCount"),
    read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "publicPrizeReserve"
    ),
    read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "morphoPendingDepositCount"
    ),
    read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "lastMorphoUnwrapAt"
    ),
    read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "morphoUnwrapInterval"
    ),
    read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "encryptedTotalPrincipal"
    ),
    read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "encryptedPrizeReserve"
    ),
    read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "encryptedPendingMorphoPrincipal"
    ),
    read(
      snapshotClient,
      deployment.pool,
      prizePoolReadAbi,
      "currentWithdrawalBatchId"
    ),
    read(snapshotClient, deployment.adapter, adapterReadAbi, "usdc"),
    read(
      snapshotClient,
      deployment.adapter,
      adapterReadAbi,
      "confidentialUsdc"
    ),
    read(snapshotClient, deployment.adapter, adapterReadAbi, "prizePool"),
    read(snapshotClient, deployment.adapter, adapterReadAbi, "morpho"),
    read(snapshotClient, deployment.adapter, adapterReadAbi, "marketId"),
    read(
      snapshotClient,
      deployment.adapter,
      adapterReadAbi,
      "suppliedPrincipal"
    ),
    read(snapshotClient, deployment.adapter, adapterReadAbi, "idlePrincipal"),
    read(
      snapshotClient,
      deployment.adapter,
      adapterReadAbi,
      "availablePrincipalAssets"
    ),
    read(
      snapshotClient,
      deployment.adapter,
      adapterReadAbi,
      "accruedYieldAssets"
    ),
    read(snapshotClient, deployment.adapter, adapterReadAbi, "suppliedAssets"),
    read(snapshotClient, deployment.adapter, adapterReadAbi, "marketParams"),
    read(snapshotClient, deployment.morpho, morphoReadAbi, "idToMarketParams", [
      deployment.marketId,
    ]),
    read(snapshotClient, deployment.morpho, morphoReadAbi, "market", [
      deployment.marketId,
    ]),
  ]);

  const adapterMarketParams = parseMarketParams(adapterMarketParamsRaw);
  const marketParams = parseMarketParams(marketParamsRaw);
  assertBindings(
    deployment,
    adapterUsdc,
    adapterConfidentialUsdc,
    adapterPrizePool,
    adapterMorpho,
    adapterMarketId,
    adapterMarketParams,
    marketParams
  );
  const marketState = parseMarketState(marketStateRaw);
  const [withdrawalBatch, oraclePrice, borrowRatePerSecond, accountSnapshot] =
    await Promise.all([
      readWithdrawalBatch(
        snapshotClient,
        deployment.pool,
        asBigInt(withdrawalBatchId)
      ),
      read(snapshotClient, marketParams.oracle, oracleReadAbi, "price").then(
        asBigInt
      ),
      readBorrowRate(snapshotClient, marketParams, marketState),
      normalizedAccount === undefined
        ? undefined
        : readAccount(
            snapshotClient,
            deployment,
            normalizedAccount,
            marketState,
            marketParams
          ),
    ]);

  return {
    blockNumber,
    refreshedAt: Date.now(),
    deployment,
    pool: {
      drawId: asBigInt(drawId),
      nextDrawAt: asBigInt(nextDrawAt),
      participantCount: asBigInt(participantCount),
      publicPrizeReserve: asBigInt(publicPrizeReserve),
      morphoPendingDepositCount: asBigInt(morphoPendingDepositCount),
      lastMorphoUnwrapAt: asBigInt(lastMorphoUnwrapAt),
      morphoUnwrapInterval: asBigInt(morphoUnwrapInterval),
      encryptedTotalPrincipalHandle: encryptedTotalPrincipalHandle as Hex,
      encryptedPrizeReserveHandle: encryptedPrizeReserveHandle as Hex,
      encryptedPendingMorphoPrincipalHandle:
        encryptedPendingMorphoPrincipalHandle as Hex,
      withdrawalBatch,
    },
    adapter: {
      usdc: getAddress(adapterUsdc as Address),
      confidentialUsdc: getAddress(adapterConfidentialUsdc as Address),
      prizePool: getAddress(adapterPrizePool as Address),
      morpho: getAddress(adapterMorpho as Address),
      marketId: adapterMarketId as Hex,
      suppliedPrincipal: asBigInt(suppliedPrincipal),
      idlePrincipal: asBigInt(idlePrincipal),
      availablePrincipalAssets: asBigInt(availablePrincipalAssets),
      accruedYieldAssets: asBigInt(accruedYieldAssets),
      suppliedAssets: asBigInt(suppliedAssets),
      marketParams: adapterMarketParams,
    },
    market: {
      state: marketState,
      params: marketParams,
      oraclePrice,
      borrowRatePerSecond,
      utilizationWad: utilizationWad(
        marketState.totalBorrowAssets,
        marketState.totalSupplyAssets
      ),
    },
    account: accountSnapshot,
  };
}

function normalizeDeployment(config: LabConfig) {
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

async function readWithdrawalBatch(
  client: SnapshotReadClient,
  pool: Address,
  id: bigint
) {
  const [
    status,
    closesAt,
    funded,
    restoredAmount,
    requestCount,
    claimantCount,
  ] = await Promise.all([
    read(client, pool, prizePoolReadAbi, "withdrawalBatchStatus", [id]),
    read(client, pool, prizePoolReadAbi, "withdrawalBatchClosesAt", [id]),
    read(client, pool, prizePoolReadAbi, "withdrawalBatchFunded", [id]),
    read(client, pool, prizePoolReadAbi, "withdrawalBatchRestoredAmount", [id]),
    read(client, pool, prizePoolReadAbi, "withdrawalBatchRequestCount", [id]),
    read(client, pool, prizePoolReadAbi, "withdrawalBatchClaimantCount", [id]),
  ]);
  return {
    id,
    status: Number(status),
    closesAt: asBigInt(closesAt),
    funded: Boolean(funded),
    restoredAmount: asBigInt(restoredAmount),
    requestCount: asBigInt(requestCount),
    claimantCount: asBigInt(claimantCount),
  };
}

async function readBorrowRate(
  client: SnapshotReadClient,
  marketParams: MarketParams,
  marketState: MarketState
): Promise<bigint | undefined> {
  try {
    return asBigInt(
      await read(client, marketParams.irm, irmReadAbi, "borrowRateView", [
        marketParams,
        marketState,
      ])
    );
  } catch {
    return undefined;
  }
}

async function readAccount(
  client: SnapshotReadClient,
  deployment: ProtocolSnapshot["deployment"],
  account: Address,
  marketState: MarketState,
  marketParams: MarketParams
) {
  const [
    positionRaw,
    usdcBalance,
    usdcAllowance,
    confidentialUsdcHandle,
    encryptedPrincipalHandle,
    encryptedWinningsHandle,
    oraclePrice,
  ] = await Promise.all([
    read(client, deployment.morpho, morphoReadAbi, "position", [
      deployment.marketId,
      account,
    ]),
    read(client, deployment.usdc, erc20ReadAbi, "balanceOf", [account]),
    read(client, deployment.usdc, erc20ReadAbi, "allowance", [
      account,
      deployment.wrapper,
    ]),
    read(
      client,
      deployment.wrapper,
      confidentialTokenReadAbi,
      "confidentialBalanceOf",
      [account]
    ),
    read(client, deployment.pool, prizePoolReadAbi, "encryptedPrincipalOf", [
      account,
    ]),
    read(client, deployment.pool, prizePoolReadAbi, "encryptedWinningsOf", [
      account,
    ]),
    read(client, marketParams.oracle, oracleReadAbi, "price"),
  ]);
  const position = parsePosition(positionRaw);
  const borrowAssets = toBorrowAssetsUp(
    position.borrowShares,
    marketState.totalBorrowAssets,
    marketState.totalBorrowShares
  );
  return {
    address: account,
    position,
    health: positionHealth({
      collateralAssets: position.collateralAssets,
      collateralPrice: asBigInt(oraclePrice),
      borrowAssets,
      lltv: marketParams.lltv,
    }),
    tokens: {
      usdcBalance: asBigInt(usdcBalance),
      usdcAllowance: asBigInt(usdcAllowance),
      confidentialUsdcHandle: confidentialUsdcHandle as Hex,
    },
    encryptedPrincipalHandle: encryptedPrincipalHandle as Hex,
    encryptedWinningsHandle: encryptedWinningsHandle as Hex,
  };
}

function assertBindings(
  deployment: ProtocolSnapshot["deployment"],
  usdc: unknown,
  wrapper: unknown,
  pool: unknown,
  morpho: unknown,
  marketId: unknown,
  adapterParams: MarketParams,
  registeredParams: MarketParams
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
  )
    throw new Error(
      "Adapter market parameters or deployment bindings do not match the configured values"
    );
}

function assertActiveAdapter(
  configuredAdapter: Address,
  activeAdapter: Address
): void {
  if (configuredAdapter !== activeAdapter) {
    throw new Error(
      "Configured adapter is not the pool's active Morpho adapter"
    );
  }
}

function sameMarketParams(left: MarketParams, right: MarketParams): boolean {
  return (
    left.loanToken === right.loanToken &&
    left.collateralToken === right.collateralToken &&
    left.oracle === right.oracle &&
    left.irm === right.irm &&
    left.lltv === right.lltv
  );
}
function parseMarketParams(value: unknown): MarketParams {
  const [loanToken, collateralToken, oracle, irm, lltv] = value as readonly [
    Address,
    Address,
    Address,
    Address,
    bigint
  ];
  return {
    loanToken: getAddress(loanToken),
    collateralToken: getAddress(collateralToken),
    oracle: getAddress(oracle),
    irm: getAddress(irm),
    lltv: asBigInt(lltv),
  };
}
function parseMarketState(value: unknown): MarketState {
  const [
    totalSupplyAssets,
    totalSupplyShares,
    totalBorrowAssets,
    totalBorrowShares,
    lastUpdate,
    fee,
  ] = value as readonly bigint[];
  return {
    totalSupplyAssets,
    totalSupplyShares,
    totalBorrowAssets,
    totalBorrowShares,
    lastUpdate,
    fee,
  };
}
function parsePosition(value: unknown): Position {
  const [supplyShares, borrowShares, collateralAssets] =
    value as readonly bigint[];
  return { supplyShares, borrowShares, collateralAssets };
}
function asBigInt(value: unknown): bigint {
  if (typeof value !== "bigint")
    throw new Error("Expected bigint result from protocol read");
  return value;
}
function read(
  client: SnapshotReadClient,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args?: readonly unknown[]
) {
  return client.readContract({
    address,
    abi,
    functionName,
    args,
    blockNumber: client.blockNumber,
  });
}

function atBlock(
  client: ProtocolReadClient,
  blockNumber: bigint
): SnapshotReadClient {
  return {
    getBlockNumber: client.getBlockNumber.bind(client),
    readContract: client.readContract.bind(client),
    blockNumber,
  };
}
