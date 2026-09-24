import { createPublicClient, createWalletClient, getAddress, http, parseAbi, parseAbiItem, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  buildInclusiveBlockRanges,
  chooseMorphoKeeperActions,
  findOldestPendingMorphoUnwrap,
  normalizeKeeperMaxTransactions,
  sanitizeKeeperError,
  type MorphoKeeperAction,
  type MorphoKeeperSnapshot,
} from "../../src/lib/morpho-keeper";
import { decryptPublicHandles } from "../../src/lib/zama-node";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const prizePoolAbi = parseAbi([
  "function token() view returns (address)",
  "function morphoYieldAdapter() view returns (address)",
  "function morphoAvailablePrincipalAssets() view returns (uint256)",
  "function morphoAccruedYieldAssets() view returns (uint256)",
  "function morphoPendingDepositCount() view returns (uint256)",
  "function lastMorphoUnwrapAt() view returns (uint256)",
  "function morphoUnwrapInterval() view returns (uint256)",
  "function supplyAvailableMorphoPrincipal() returns (uint256 assetsSupplied,uint256 sharesSupplied)",
  "function harvestMorphoYield(uint256 maxAssets) returns (uint256 harvestedAssets)",
  "function requestMorphoPrincipalUnwrap() returns (bytes32 unwrapRequestId)",
]);

const morphoAdapterAbi = parseAbi([
  "function suppliedPrincipal() view returns (uint256)",
  "function morpho() view returns (address)",
  "function marketId() view returns (bytes32)",
  "function marketParams() view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)",
]);

const confidentialUsdcAbi = parseAbi([
  "function finalizeUnwrap(bytes32 unwrapRequestId,uint64 unwrapAmountCleartext,bytes decryptionProof)",
]);

const morphoAbi = parseAbi([
  "function market(bytes32 marketId) view returns (uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint128 lastUpdate,uint128 fee)",
  "function accrueInterest((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams)",
]);

const unwrapRequestedEvent = parseAbiItem(
  "event UnwrapRequested(address indexed receiver,bytes32 indexed unwrapRequestId,bytes32 amount)",
);
const unwrapFinalizedEvent = parseAbiItem(
  "event UnwrapFinalized(address indexed receiver,bytes32 indexed unwrapRequestId,bytes32 encryptedAmount,uint64 cleartextAmount)",
);
const UNWRAP_LOG_CHUNK_BLOCKS = 10_000n;

type MorphoKeeperRuntimeSnapshot = MorphoKeeperSnapshot & {
  token: `0x${string}`;
  adapter: `0x${string}`;
};

function env(name: string): string | undefined {
  return typeof Netlify !== "undefined" ? Netlify.env.get(name) : process.env[name];
}

function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function privateKeyEnv(name: string): Hex {
  const value = requiredEnv(name);
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}

async function findPendingUnwrap(
  publicClient: ReturnType<typeof createPublicClient>,
  token: `0x${string}`,
  adapter: `0x${string}`,
  startBlock: bigint,
  latestBlock: bigint,
) {
  const requested: Array<{ args: { unwrapRequestId?: `0x${string}` } }> = [];
  const finalized: Array<{ args: { unwrapRequestId?: `0x${string}` } }> = [];
  for (const range of buildInclusiveBlockRanges(startBlock, latestBlock, UNWRAP_LOG_CHUNK_BLOCKS)) {
    const [requestedChunk, finalizedChunk] = await Promise.all([
      publicClient.getLogs({ address: token, event: unwrapRequestedEvent, args: { receiver: adapter }, ...range }),
      publicClient.getLogs({ address: token, event: unwrapFinalizedEvent, args: { receiver: adapter }, ...range }),
    ]);
    requested.push(...requestedChunk);
    finalized.push(...finalizedChunk);
  }

  return findOldestPendingMorphoUnwrap(
    requested.flatMap((event) => event.args.unwrapRequestId ? [event.args.unwrapRequestId] : []),
    finalized.flatMap((event) => event.args.unwrapRequestId ? [event.args.unwrapRequestId] : []),
  );
}

async function readSnapshot(publicClient: ReturnType<typeof createPublicClient>, pool: `0x${string}`, startBlock: bigint) {
  const [availablePrincipalAssets, accruedYieldAssets, morphoPendingDepositCount, lastMorphoUnwrapAt, morphoUnwrapInterval, tokenAddress, adapterAddress, block] =
    await Promise.all([
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoAvailablePrincipalAssets" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoAccruedYieldAssets" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoPendingDepositCount" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "lastMorphoUnwrapAt" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoUnwrapInterval" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "token" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoYieldAdapter" }),
      publicClient.getBlock(),
    ]);

  const token = getAddress(tokenAddress);
  const adapter = getAddress(adapterAddress);
  const [suppliedPrincipalAssets, pendingUnwrapRequestId, morphoAddress, marketId] = await Promise.all([
    publicClient.readContract({ address: adapter, abi: morphoAdapterAbi, functionName: "suppliedPrincipal" }),
    findPendingUnwrap(publicClient, token, adapter, startBlock, block.number),
    publicClient.readContract({ address: adapter, abi: morphoAdapterAbi, functionName: "morpho" }),
    publicClient.readContract({ address: adapter, abi: morphoAdapterAbi, functionName: "marketId" }),
  ]);
  const market = await publicClient.readContract({
    address: getAddress(morphoAddress),
    abi: morphoAbi,
    functionName: "market",
    args: [marketId],
  });

  return {
    availablePrincipalAssets,
    accruedYieldAssets,
    morphoPendingDepositCount,
    morphoLastAccrualAt: market[4],
    lastMorphoUnwrapAt,
    morphoUnwrapInterval,
    now: block.timestamp,
    pendingUnwrapRequestId,
    suppliedPrincipalAssets,
    token,
    adapter,
  } satisfies MorphoKeeperRuntimeSnapshot;
}

async function runAction(
  action: MorphoKeeperAction,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: PrivateKeyAccount,
  pool: `0x${string}`,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  rpcUrl: string,
) {
  if (action === "finalize") {
    const requestId = snapshot.pendingUnwrapRequestId;
    if (!requestId) return undefined;

    let decrypted;
    try {
      decrypted = await decryptPublicHandles([requestId], rpcUrl);
    } catch (error) {
      console.log(JSON.stringify({ action, requestId, status: "not-ready", error: sanitizeKeeperError(error) }));
      return undefined;
    }

    const clearValue = decrypted.clearValues[requestId];
    if (typeof clearValue !== "bigint") {
      console.log(JSON.stringify({ action, requestId, status: "invalid-decryption-response" }));
      return undefined;
    }

    const hash = await walletClient.writeContract({
      address: snapshot.token,
      abi: confidentialUsdcAbi,
      account,
      chain: sepolia,
      functionName: "finalizeUnwrap",
      args: [requestId, clearValue, decrypted.decryptionProof],
    });
    return hash;
  }

  if (action === "accrue") {
    const [morphoAddress, marketParams] = await Promise.all([
      publicClient.readContract({ address: snapshot.adapter, abi: morphoAdapterAbi, functionName: "morpho" }),
      publicClient.readContract({ address: snapshot.adapter, abi: morphoAdapterAbi, functionName: "marketParams" }),
    ]);
    const hash = await walletClient.writeContract({
      address: getAddress(morphoAddress),
      abi: morphoAbi,
      account,
      chain: sepolia,
      functionName: "accrueInterest",
      args: [{
        loanToken: marketParams[0],
        collateralToken: marketParams[1],
        oracle: marketParams[2],
        irm: marketParams[3],
        lltv: marketParams[4],
      }],
    });
    return hash;
  }

  const functionName =
    action === "supply"
      ? "supplyAvailableMorphoPrincipal"
      : action === "harvest"
        ? "harvestMorphoYield"
        : "requestMorphoPrincipalUnwrap";
  const args = action === "harvest" ? [0n] as const : [] as const;
  const hash = await walletClient.writeContract({
    address: pool,
    abi: prizePoolAbi,
    account,
    chain: sepolia,
    functionName,
    args,
  });
  return hash;
}

export default async () => {
  const rpcUrl = env("SEPOLIA_RPC_URL") ?? requiredEnv("NEXT_PUBLIC_RPC_URL");
  const pool = getAddress(env("CONFIDENTIAL_PRIZE_POOL_ADDRESS") ?? requiredEnv("NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS"));
  const privateKey = privateKeyEnv("KEEPER_PRIVATE_KEY");
  const maxTransactions = normalizeKeeperMaxTransactions(env("MORPHO_KEEPER_MAX_TXS"));
  const startBlock = BigInt(requiredEnv("MORPHO_KEEPER_START_BLOCK"));
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  const transactions: Array<{ action: MorphoKeeperAction; hash: Hex }> = [];

  for (let i = 0; i < maxTransactions; i++) {
    const snapshot = await readSnapshot(publicClient, pool, startBlock);
    const [action] = chooseMorphoKeeperActions(snapshot, 1);
    if (!action) break;

    const hash = await runAction(action, publicClient, walletClient, account, pool, snapshot, rpcUrl);
    if (!hash) break;
    transactions.push({ action, hash });
  }

  console.log(JSON.stringify({ transactions }));
  return new Response(JSON.stringify({ transactions }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = {
  schedule: "*/5 * * * *",
};
