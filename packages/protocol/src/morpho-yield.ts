import { getAddress, type Address, type Hex } from "viem";

import {
  confidentialPrizePoolAbi,
  morphoBlueAbi,
  morphoIrmAbi,
  morphoYieldAdapterAbi,
} from "./abis/index.ts";
import { asBigInt } from "./decoders.ts";
import { decodeMarketParams } from "./market-params.ts";
import { decodeMarketState, decodePosition, type MarketState } from "./market-state.ts";
import { accruedMarketState, toSupplyAssetsDown } from "./morpho-math.ts";

export type ProjectionInput = {
  market: MarketState;
  borrowRatePerSecond: bigint;
  blockTimestamp: bigint;
  supplyShares: bigint;
  suppliedPrincipal: bigint;
  idlePrincipal: bigint;
};

export type ProjectedMorphoYield = {
  blockNumber: bigint;
  accruedYieldAssets: bigint;
  source: "projected" | "stored";
};

export type MorphoYieldClient = {
  getBlock(args: { blockNumber: bigint }): Promise<{ timestamp: bigint }>;
  readContract(request: never): Promise<unknown>;
};

export function projectMorphoYield(input: ProjectionInput): bigint {
  const accrued = accruedMarketState(input.market, input.borrowRatePerSecond, input.blockTimestamp);
  const suppliedAssets = input.idlePrincipal + toSupplyAssetsDown(
    input.supplyShares,
    accrued.totalSupplyAssets,
    accrued.totalSupplyShares,
  );
  return suppliedAssets > input.suppliedPrincipal ? suppliedAssets - input.suppliedPrincipal : 0n;
}

export async function readProjectedMorphoYield(
  client: MorphoYieldClient,
  pool: Address,
  blockNumber: bigint,
): Promise<ProjectedMorphoYield> {
  const normalizedPool = getAddress(pool);
  const projected = await readProjection(client, normalizedPool, blockNumber).catch(() => undefined);
  if (projected !== undefined) return projected;

  return {
    blockNumber,
    accruedYieldAssets: asBigInt(await read(
      client,
      normalizedPool,
      confidentialPrizePoolAbi,
      "morphoAccruedYieldAssets",
      blockNumber,
    ), "stored accrued yield"),
    source: "stored",
  };
}

async function readProjection(
  client: MorphoYieldClient,
  normalizedPool: Address,
  blockNumber: bigint,
): Promise<ProjectedMorphoYield> {
  const [{ timestamp }, adapterValue] = await Promise.all([
      client.getBlock({ blockNumber }),
      read(client, normalizedPool, confidentialPrizePoolAbi, "morphoYieldAdapter", blockNumber),
  ]);
  const adapter = getAddress(adapterValue as Address);
  const [morphoValue, marketIdValue, suppliedPrincipalValue, idlePrincipalValue, paramsValue] = await Promise.all([
    read(client, adapter, morphoYieldAdapterAbi, "morpho", blockNumber),
    read(client, adapter, morphoYieldAdapterAbi, "marketId", blockNumber),
    read(client, adapter, morphoYieldAdapterAbi, "suppliedPrincipal", blockNumber),
    read(client, adapter, morphoYieldAdapterAbi, "idlePrincipal", blockNumber),
    read(client, adapter, morphoYieldAdapterAbi, "marketParams", blockNumber),
  ]);
  const morpho = getAddress(morphoValue as Address);
  const marketId = marketIdValue as Hex;
  const marketParams = decodeMarketParams(paramsValue);
  const [marketValue, positionValue] = await Promise.all([
    read(client, morpho, morphoBlueAbi, "market", blockNumber, [marketId]),
    read(client, morpho, morphoBlueAbi, "position", blockNumber, [marketId, adapter]),
  ]);
  const market = decodeMarketState(marketValue);
  const borrowRatePerSecond = asBigInt(await read(
    client,
    marketParams.irm,
    morphoIrmAbi,
    "borrowRateView",
    blockNumber,
    [marketParams, market],
  ), "borrow rate");
  const position = decodePosition(positionValue);

  return {
    blockNumber,
    accruedYieldAssets: projectMorphoYield({
      market,
      borrowRatePerSecond,
      blockTimestamp: timestamp,
      supplyShares: position.supplyShares,
      suppliedPrincipal: asBigInt(suppliedPrincipalValue, "supplied principal"),
      idlePrincipal: asBigInt(idlePrincipalValue, "idle principal"),
    }),
    source: "projected",
  };
}

async function read(
  client: MorphoYieldClient,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  blockNumber: bigint,
  args?: readonly unknown[],
): Promise<unknown> {
  return client.readContract({ address, abi, functionName, args, blockNumber } as never);
}
