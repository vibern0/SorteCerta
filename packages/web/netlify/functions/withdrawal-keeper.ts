import { createPublicClient, createWalletClient, getAddress, http, parseAbi, zeroAddress, zeroHash, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { sanitizeKeeperError } from "../../src/lib/morpho-keeper";
import {
  chooseWithdrawalKeeperAction,
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
  "function token() view returns (address)",
  "function withdrawalAccounts(uint256 batchId) view returns (address[])",
  "function hasWithdrawalClaim(uint256 batchId,address account) view returns (bool)",
  "function withdrawalUnwrapRequest(uint256 batchId,address account) view returns (bytes32)",
  "function processWithdrawal(uint256 batchId,address account) returns (bytes32)",
]);
const wrapperAbi = parseAbi([
  "function unwrapRequester(bytes32 requestId) view returns (address)",
  "function finalizeUnwrap(bytes32 requestId,uint64 amount,bytes proof)",
]);

const PUBLIC_DECRYPT_TIMEOUT_MS = 8_000;
const STATUS_NAMES = ["open", "closed", "funded"] as const satisfies readonly WithdrawalBatchStatus[];

async function decryptHandles(handles: Hex[], rpcUrl: string) {
  const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/node");
  const zama = await createInstance({ ...SepoliaConfig, network: rpcUrl });
  return zama.publicDecrypt(handles, { timeout: PUBLIC_DECRYPT_TIMEOUT_MS });
}

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
  decrypt = decryptHandles,
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
  let decrypted;
  try {
    decrypted = await decrypt([totalHandle, restoreHandle], rpcUrl);
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
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  return runWithdrawalKeeper({ rpcUrl, pool, account, publicClient, walletClient });
};

export async function runWithdrawalKeeper({ rpcUrl, pool, account, publicClient, walletClient, decrypt = decryptHandles }: {
  rpcUrl: string;
  pool: Hex;
  account: PrivateKeyAccount;
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  decrypt?: typeof decryptHandles;
}) {
  const currentBatchId = await publicClient.readContract({
    address: pool,
    abi: prizePoolAbi,
    functionName: "currentWithdrawalBatchId",
  });

  const token = getAddress(await publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "token" }));
  const transactions: Array<{ action: string; batchId: string; hash: Hex }> = [];
  const pending: Array<{ batchId: string; account?: string; status: string; error?: ReturnType<typeof sanitizeKeeperError> }> = [];
  async function confirmed(hash: Hex, action: string, batchId: bigint) {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${action} transaction reverted: ${hash}`);
    transactions.push({ action, batchId: batchId.toString(), hash });
  }

  // Scan oldest first: a request must not expire out of a rolling lookback window.
  for (let batchId = 1n; batchId <= currentBatchId; batchId++) {
    try {
      let snapshot = await readSnapshot(publicClient, pool, batchId);
      if (snapshot.requestCount === 0n) continue;
      for (let step = 0; step < 2; step++) {
        const action = chooseWithdrawalKeeperAction(snapshot);
        if (!action) break;
        const hash = await runAction(action, publicClient, walletClient, account, pool, batchId, rpcUrl, decrypt);
        if (!hash) break;
        await confirmed(hash, action, batchId);
        snapshot = await readSnapshot(publicClient, pool, batchId);
      }
      if (snapshot.status !== "funded") {
        pending.push({ batchId: batchId.toString(), status: snapshot.status === "open" ? "waiting-for-batch" : "waiting-for-settlement" });
        continue;
      }
      const claimants = await publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "withdrawalAccounts", args: [batchId] });
      for (const claimant of claimants) {
        try {
          const hasClaim = await publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "hasWithdrawalClaim", args: [batchId, claimant] });
          if (hasClaim) {
            await confirmed(await walletClient.writeContract({ account, chain: sepolia, address: pool, abi: prizePoolAbi, functionName: "processWithdrawal", args: [batchId, claimant] }), "payout", batchId);
          }
          const requestId = await publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "withdrawalUnwrapRequest", args: [batchId, claimant] });
          if (requestId === zeroHash) throw new Error("Missing payout request");
          const receiver = await publicClient.readContract({ address: token, abi: wrapperAbi, functionName: "unwrapRequester", args: [requestId] });
          if (receiver === zeroAddress) continue;
          const decrypted = await decrypt([requestId], rpcUrl);
          const amount = decrypted.clearValues[requestId];
          if (typeof amount !== "bigint") throw new Error("Invalid payout proof response");
          await confirmed(await walletClient.writeContract({ account, chain: sepolia, address: token, abi: wrapperAbi, functionName: "finalizeUnwrap", args: [requestId, amount, decrypted.decryptionProof] }), "deliver", batchId);
        } catch (error) {
          pending.push({ batchId: batchId.toString(), account: claimant, status: "retrying-delivery", error: sanitizeKeeperError(error) });
        }
      }
    } catch (error) {
      pending.push({ batchId: batchId.toString(), status: "retrying", error: sanitizeKeeperError(error) });
    }
  }

  console.log(JSON.stringify({ transactions, pending }));
  return new Response(JSON.stringify({ transactions, pending }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = {
  schedule: "* * * * *",
};
