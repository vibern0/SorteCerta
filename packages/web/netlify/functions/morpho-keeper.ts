import { createPublicClient, createWalletClient, getAddress, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  buildFinalizeUnwrapRequest,
  confidentialPrizePoolAbi,
  decodeMarketParams,
  morphoBlueAbi,
  morphoYieldAdapterAbi,
  unwrapFinalizedEvent,
  unwrapRequestedEvent,
} from "@sortecerta/protocol";
import {
  buildInclusiveBlockRanges,
  chooseMorphoKeeperActions,
  findOldestPendingMorphoUnwrap,
  normalizeKeeperMaxTransactions,
  sanitizeKeeperError,
  type MorphoKeeperAction,
  type MorphoKeeperSnapshot,
} from "../../src/lib/morpho-keeper.ts";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const UNWRAP_LOG_CHUNK_BLOCKS = 10_000n;
const PUBLIC_DECRYPT_TIMEOUT_MS = 8_000;

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
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "morphoAvailablePrincipalAssets" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "morphoAccruedYieldAssets" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "morphoPendingDepositCount" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "lastMorphoUnwrapAt" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "morphoUnwrapInterval" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "token" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "morphoYieldAdapter" }),
      publicClient.getBlock(),
    ]);

  const token = getAddress(tokenAddress);
  const adapter = getAddress(adapterAddress);
  const [suppliedPrincipalAssets, pendingUnwrapRequestId, morphoAddress, marketId] = await Promise.all([
    publicClient.readContract({ address: adapter, abi: morphoYieldAdapterAbi, functionName: "suppliedPrincipal" }),
    findPendingUnwrap(publicClient, token, adapter, startBlock, block.number),
    publicClient.readContract({ address: adapter, abi: morphoYieldAdapterAbi, functionName: "morpho" }),
    publicClient.readContract({ address: adapter, abi: morphoYieldAdapterAbi, functionName: "marketId" }),
  ]);
  const market = await publicClient.readContract({
    address: getAddress(morphoAddress),
    abi: morphoBlueAbi,
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

export async function runMorphoAction(
  action: MorphoKeeperAction,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: PrivateKeyAccount,
  pool: `0x${string}`,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  rpcUrl: string,
  decryptUnwrap?: (requestId: Hex, rpcUrl: string) => Promise<{ clearValue: bigint; decryptionProof: Hex }>,
) {
  if (action === "finalize") {
    const requestId = snapshot.pendingUnwrapRequestId;
    if (!requestId) return undefined;

    let clearValue: unknown;
    let decryptionProof: Hex;
    try {
      if (decryptUnwrap) {
        const result = await decryptUnwrap(requestId, rpcUrl);
        clearValue = result.clearValue;
        decryptionProof = result.decryptionProof;
      } else {
        const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/node");
        const zama = await createInstance({ ...SepoliaConfig, network: rpcUrl });
        const decrypted = await zama.publicDecrypt([requestId], { timeout: PUBLIC_DECRYPT_TIMEOUT_MS });
        clearValue = decrypted.clearValues[requestId];
        decryptionProof = decrypted.decryptionProof;
      }
    } catch (error) {
      console.log(JSON.stringify({ action, requestId, status: "not-ready", error: sanitizeKeeperError(error) }));
      return undefined;
    }

    if (typeof clearValue !== "bigint") {
      console.log(JSON.stringify({ action, requestId, status: "invalid-decryption-response" }));
      return undefined;
    }

    const hash = await walletClient.writeContract({
      ...buildFinalizeUnwrapRequest(snapshot.token, requestId, clearValue, decryptionProof),
      account,
      chain: sepolia,
    });
    return hash;
  }

  if (action === "accrue") {
    const [morphoAddress, marketParams] = await Promise.all([
      publicClient.readContract({ address: snapshot.adapter, abi: morphoYieldAdapterAbi, functionName: "morpho" }),
      publicClient.readContract({ address: snapshot.adapter, abi: morphoYieldAdapterAbi, functionName: "marketParams" }),
    ]);
    const params = decodeMarketParams(marketParams);
    const hash = await walletClient.writeContract({
      address: getAddress(morphoAddress),
      abi: morphoBlueAbi,
      account,
      chain: sepolia,
      functionName: "accrueInterest",
      args: [{
        loanToken: params.loanToken,
        collateralToken: params.collateralToken,
        oracle: params.oracle,
        irm: params.irm,
        lltv: params.lltv,
      }],
    });
    return hash;
  }

  const functionName =
    action === "supply"
      ? "supplyAvailableMorphoPrincipal"
      : "requestMorphoPrincipalUnwrap";
  const hash = await walletClient.writeContract({
    address: pool,
    abi: confidentialPrizePoolAbi,
    account,
    chain: sepolia,
    functionName,
    args: [],
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

    const hash = await runMorphoAction(action, publicClient, walletClient, account, pool, snapshot, rpcUrl);
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
