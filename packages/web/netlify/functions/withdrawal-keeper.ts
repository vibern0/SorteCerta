import { createPublicClient, createWalletClient, getAddress, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { sanitizeKeeperError } from "../../src/lib/morpho-keeper";
import {
  chooseWithdrawalKeeperAction,
  normalizeWithdrawalKeeperLookback,
  recentWithdrawalBatchIds,
  type WithdrawalBatchStatus,
  type WithdrawalKeeperAction,
} from "../../src/lib/withdrawal-keeper";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const prizePoolAbi = parseAbi([
  "function currentWithdrawalBatchId() view returns (uint256)",
  "function withdrawalBatchStatus(uint256 batchId) view returns (uint8)",
  "function withdrawalBatchClosesAt(uint256 batchId) view returns (uint256)",
  "function withdrawalBatchRequestCount(uint256 batchId) view returns (uint256)",
  "function encryptedWithdrawalBatchTotal(uint256 batchId) view returns (bytes32)",
  "function encryptedWithdrawalBatchMorphoRestore(uint256 batchId) view returns (bytes32)",
  "function closeWithdrawalBatch(uint256 batchId)",
  "function settleWithdrawalBatch(uint256 batchId,uint64 cleartextTotal,uint64 cleartextMorphoRestore,bytes decryptionProof)",
]);

const PUBLIC_DECRYPT_TIMEOUT_MS = 8_000;
const STATUS_NAMES = ["open", "closed", "funded"] as const satisfies readonly WithdrawalBatchStatus[];

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

function statusName(status: number): WithdrawalBatchStatus {
  const name = STATUS_NAMES[status];
  if (!name) throw new Error(`Unknown withdrawal batch status: ${status}`);
  return name;
}

async function readSnapshot(
  publicClient: ReturnType<typeof createPublicClient>,
  pool: `0x${string}`,
  batchId: bigint,
) {
  const [status, closesAt, requestCount, block] = await Promise.all([
    publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "withdrawalBatchStatus", args: [batchId] }),
    publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "withdrawalBatchClosesAt", args: [batchId] }),
    publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "withdrawalBatchRequestCount", args: [batchId] }),
    publicClient.getBlock(),
  ]);

  return {
    now: block.timestamp,
    closesAt,
    requestCount,
    status: statusName(status),
  };
}

async function runAction(
  action: WithdrawalKeeperAction,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: PrivateKeyAccount,
  pool: `0x${string}`,
  batchId: bigint,
  rpcUrl: string,
) {
  if (action === "close") {
    return walletClient.writeContract({
      address: pool,
      abi: prizePoolAbi,
      account,
      chain: sepolia,
      functionName: "closeWithdrawalBatch",
      args: [batchId],
    });
  }

  const [totalHandle, restoreHandle] = await Promise.all([
    publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "encryptedWithdrawalBatchTotal", args: [batchId] }),
    publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "encryptedWithdrawalBatchMorphoRestore", args: [batchId] }),
  ]);
  const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/node");
  const zama = await createInstance({ ...SepoliaConfig, network: rpcUrl });

  let decrypted;
  try {
    decrypted = await zama.publicDecrypt([totalHandle, restoreHandle], { timeout: PUBLIC_DECRYPT_TIMEOUT_MS });
  } catch (error) {
    console.log(JSON.stringify({ action, batchId: batchId.toString(), status: "not-ready", error: sanitizeKeeperError(error) }));
    return undefined;
  }

  const clearTotal = decrypted.clearValues[totalHandle];
  const clearRestore = decrypted.clearValues[restoreHandle];
  if (typeof clearTotal !== "bigint" || typeof clearRestore !== "bigint") {
    console.log(JSON.stringify({ action, batchId: batchId.toString(), status: "invalid-decryption-response" }));
    return undefined;
  }

  return walletClient.writeContract({
    address: pool,
    abi: prizePoolAbi,
    account,
    chain: sepolia,
    functionName: "settleWithdrawalBatch",
    args: [batchId, clearTotal, clearRestore, decrypted.decryptionProof],
  });
}

export default async () => {
  const rpcUrl = env("SEPOLIA_RPC_URL") ?? requiredEnv("NEXT_PUBLIC_RPC_URL");
  const pool = getAddress(env("CONFIDENTIAL_PRIZE_POOL_ADDRESS") ?? requiredEnv("NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS"));
  const account = privateKeyToAccount(privateKeyEnv("KEEPER_PRIVATE_KEY"));
  const lookback = normalizeWithdrawalKeeperLookback(env("WITHDRAWAL_KEEPER_LOOKBACK_BATCHES"));
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  const currentBatchId = await publicClient.readContract({
    address: pool,
    abi: prizePoolAbi,
    functionName: "currentWithdrawalBatchId",
  });

  const transactions: Array<{ action: WithdrawalKeeperAction; batchId: string; hash: Hex }> = [];
  for (const batchId of recentWithdrawalBatchIds(currentBatchId, lookback)) {
    const snapshot = await readSnapshot(publicClient, pool, batchId);
    const action = chooseWithdrawalKeeperAction(snapshot);
    if (!action) continue;

    const hash = await runAction(action, publicClient, walletClient, account, pool, batchId, rpcUrl);
    if (!hash) break;
    transactions.push({ action, batchId: batchId.toString(), hash });
    break;
  }

  console.log(JSON.stringify({ transactions }));
  return new Response(JSON.stringify({ transactions }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = {
  schedule: "* * * * *",
};
