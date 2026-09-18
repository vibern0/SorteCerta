import { getAddress, type Address, type Hex, type PublicClient } from "viem";

const WAD = 10n ** 18n;
const VIRTUAL_SHARES = 1_000_000n;
const VIRTUAL_ASSETS = 1n;

type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

type MarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

type ProjectionInput = {
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

type MorphoYieldClient = Pick<PublicClient, "getBlock" | "readContract">;

type BlockSnapshot = { blockNumber: bigint };

const marketParamsComponents = [
  { type: "address", name: "loanToken" },
  { type: "address", name: "collateralToken" },
  { type: "address", name: "oracle" },
  { type: "address", name: "irm" },
  { type: "uint256", name: "lltv" },
] as const;

const marketComponents = [
  { type: "uint128", name: "totalSupplyAssets" },
  { type: "uint128", name: "totalSupplyShares" },
  { type: "uint128", name: "totalBorrowAssets" },
  { type: "uint128", name: "totalBorrowShares" },
  { type: "uint128", name: "lastUpdate" },
  { type: "uint128", name: "fee" },
] as const;

const poolYieldAbi = [
  {
    type: "function",
    name: "morphoYieldAdapter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "morphoAccruedYieldAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const adapterYieldAbi = [
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
    name: "marketParams",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "tuple", components: marketParamsComponents }],
  },
] as const;

const morphoYieldAbi = [
  {
    type: "function",
    name: "market",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "id" }],
    outputs: [{ type: "tuple", components: marketComponents }],
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

const irmYieldAbi = [
  {
    type: "function",
    name: "borrowRateView",
    stateMutability: "view",
    inputs: [
      { type: "tuple", components: marketParamsComponents, name: "marketParams" },
      { type: "tuple", components: marketComponents, name: "market" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export function projectMorphoYield(input: ProjectionInput): bigint {
  const accruedMarket = accrueMarket(
    input.market,
    input.borrowRatePerSecond,
    input.blockTimestamp,
  );
  const suppliedAssets =
    input.idlePrincipal +
    toSupplyAssetsDown(
      input.supplyShares,
      accruedMarket.totalSupplyAssets,
      accruedMarket.totalSupplyShares,
    );

  return suppliedAssets > input.suppliedPrincipal
    ? suppliedAssets - input.suppliedPrincipal
    : 0n;
}

export async function readProjectedMorphoYield(
  client: MorphoYieldClient,
  pool: Address,
  blockNumber: bigint,
): Promise<ProjectedMorphoYield> {
  const normalizedPool = getAddress(pool);
  const storedYield = asBigInt(
    await read(client, normalizedPool, poolYieldAbi, "morphoAccruedYieldAssets", blockNumber),
  );

  try {
    const [{ timestamp }, adapterValue] = await Promise.all([
      client.getBlock({ blockNumber }),
      read(client, normalizedPool, poolYieldAbi, "morphoYieldAdapter", blockNumber),
    ]);
    const adapter = getAddress(adapterValue as Address);
    const [morphoValue, marketIdValue, suppliedPrincipalValue, idlePrincipalValue, paramsValue] =
      await Promise.all([
        read(client, adapter, adapterYieldAbi, "morpho", blockNumber),
        read(client, adapter, adapterYieldAbi, "marketId", blockNumber),
        read(client, adapter, adapterYieldAbi, "suppliedPrincipal", blockNumber),
        read(client, adapter, adapterYieldAbi, "idlePrincipal", blockNumber),
        read(client, adapter, adapterYieldAbi, "marketParams", blockNumber),
      ]);
    const morpho = getAddress(morphoValue as Address);
    const marketId = marketIdValue as Hex;
    const marketParams = parseMarketParams(paramsValue);
    const [marketValue, positionValue] = await Promise.all([
      read(client, morpho, morphoYieldAbi, "market", blockNumber, [marketId]),
      read(client, morpho, morphoYieldAbi, "position", blockNumber, [marketId, adapter]),
    ]);
    const market = parseMarket(marketValue);
    const borrowRatePerSecond = asBigInt(
      await read(
        client,
        marketParams.irm,
        irmYieldAbi,
        "borrowRateView",
        blockNumber,
        [marketParams, market],
      ),
    );
    const [supplyShares] = tupleValues(positionValue, [
      "supplyShares",
      "borrowShares",
      "collateral",
    ]);

    return {
      blockNumber,
      accruedYieldAssets: projectMorphoYield({
        market,
        borrowRatePerSecond,
        blockTimestamp: timestamp,
        supplyShares: asBigInt(supplyShares),
        suppliedPrincipal: asBigInt(suppliedPrincipalValue),
        idlePrincipal: asBigInt(idlePrincipalValue),
      }),
      source: "projected",
    };
  } catch {
    return {
      blockNumber,
      accruedYieldAssets: storedYield,
      source: "stored",
    };
  }
}

export function createLatestBlockRefresher<T extends BlockSnapshot>(
  readSnapshot: (blockNumber?: bigint) => Promise<T>,
  applySnapshot: (snapshot: T) => void,
  onError: (error: unknown) => void = () => undefined,
) {
  let requestId = 0;
  let latestBlock = -1n;
  let disposed = false;

  return {
    async refresh(blockNumber?: bigint): Promise<void> {
      const currentRequestId = ++requestId;
      if (blockNumber !== undefined && blockNumber > latestBlock) {
        latestBlock = blockNumber;
      }

      try {
        const snapshot = await readSnapshot(blockNumber);
        if (
          disposed ||
          currentRequestId !== requestId ||
          snapshot.blockNumber < latestBlock
        ) {
          return;
        }
        latestBlock = snapshot.blockNumber;
        applySnapshot(snapshot);
      } catch (error) {
        if (!disposed && currentRequestId === requestId) onError(error);
      }
    },
    dispose(): void {
      disposed = true;
      requestId += 1;
    },
  };
}

function accrueMarket(
  market: MarketState,
  ratePerSecond: bigint,
  timestamp: bigint,
): MarketState {
  if (timestamp < market.lastUpdate) throw new Error("Invalid accrual timestamp.");
  if (timestamp === market.lastUpdate || market.totalBorrowAssets === 0n) return market;

  const totalBorrowAssets = accruedBorrowAssets(
    market.totalBorrowAssets,
    ratePerSecond,
    timestamp - market.lastUpdate,
  );
  const interest = totalBorrowAssets - market.totalBorrowAssets;
  const totalSupplyAssets = market.totalSupplyAssets + interest;
  const feeAssets = (interest * market.fee) / WAD;
  const feeShares =
    (feeAssets * (market.totalSupplyShares + VIRTUAL_SHARES)) /
    (totalSupplyAssets - feeAssets + VIRTUAL_ASSETS);

  return {
    ...market,
    totalBorrowAssets,
    totalSupplyAssets,
    totalSupplyShares: market.totalSupplyShares + feeShares,
    lastUpdate: timestamp,
  };
}

function accruedBorrowAssets(
  totalAssets: bigint,
  ratePerSecond: bigint,
  elapsed: bigint,
): bigint {
  if (totalAssets < 0n || ratePerSecond < 0n || elapsed < 0n) {
    throw new Error("Invalid accrual inputs.");
  }
  const first = ratePerSecond * elapsed;
  const second = (first * first) / (2n * WAD);
  const third = (second * first) / (3n * WAD);
  return totalAssets + (totalAssets * (first + second + third)) / WAD;
}

function toSupplyAssetsDown(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return (
    (shares * (totalAssets + VIRTUAL_ASSETS)) /
    (totalShares + VIRTUAL_SHARES)
  );
}

async function read(
  client: MorphoYieldClient,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  blockNumber: bigint,
  args?: readonly unknown[],
): Promise<unknown> {
  return client.readContract({
    address,
    abi,
    functionName,
    args,
    blockNumber,
  } as never);
}

function parseMarketParams(value: unknown): MarketParams {
  const [loanToken, collateralToken, oracle, irm, lltv] = tupleValues(value, [
    "loanToken",
    "collateralToken",
    "oracle",
    "irm",
    "lltv",
  ]);
  return {
    loanToken: getAddress(loanToken as Address),
    collateralToken: getAddress(collateralToken as Address),
    oracle: getAddress(oracle as Address),
    irm: getAddress(irm as Address),
    lltv: asBigInt(lltv),
  };
}

function parseMarket(value: unknown): MarketState {
  const values = tupleValues(value, [
    "totalSupplyAssets",
    "totalSupplyShares",
    "totalBorrowAssets",
    "totalBorrowShares",
    "lastUpdate",
    "fee",
  ]).map(asBigInt);
  return {
    totalSupplyAssets: values[0],
    totalSupplyShares: values[1],
    totalBorrowAssets: values[2],
    totalBorrowShares: values[3],
    lastUpdate: values[4],
    fee: values[5],
  };
}

function tupleValues(value: unknown, names: readonly string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object") {
    return names.map((name) => (value as Record<string, unknown>)[name]);
  }
  throw new Error("Invalid tuple response.");
}

function asBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") return BigInt(value);
  throw new Error("Invalid integer response.");
}
