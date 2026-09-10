import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  chooseMorphoKeeperActions,
  normalizeKeeperMaxTransactions,
  type MorphoKeeperAction,
  type MorphoKeeperSnapshot,
} from "../../src/lib/morpho-keeper";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const prizePoolAbi = parseAbi([
  "function morphoAvailablePrincipalAssets() view returns (uint256)",
  "function morphoAccruedYieldAssets() view returns (uint256)",
  "function morphoPendingDepositCount() view returns (uint256)",
  "function lastMorphoUnwrapAt() view returns (uint256)",
  "function morphoUnwrapInterval() view returns (uint256)",
  "function supplyAvailableMorphoPrincipal() returns (uint256 assetsSupplied,uint256 sharesSupplied)",
  "function harvestMorphoYield(uint256 maxAssets) returns (uint256 harvestedAssets)",
  "function requestMorphoPrincipalUnwrap() returns (bytes32 unwrapRequestId)",
]);

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

async function readSnapshot(publicClient: ReturnType<typeof createPublicClient>, pool: `0x${string}`) {
  const [availablePrincipalAssets, accruedYieldAssets, morphoPendingDepositCount, lastMorphoUnwrapAt, morphoUnwrapInterval, block] =
    await Promise.all([
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoAvailablePrincipalAssets" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoAccruedYieldAssets" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoPendingDepositCount" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "lastMorphoUnwrapAt" }),
      publicClient.readContract({ address: pool, abi: prizePoolAbi, functionName: "morphoUnwrapInterval" }),
      publicClient.getBlock(),
    ]);

  return {
    availablePrincipalAssets,
    accruedYieldAssets,
    morphoPendingDepositCount,
    lastMorphoUnwrapAt,
    morphoUnwrapInterval,
    now: block.timestamp,
  } satisfies MorphoKeeperSnapshot;
}

async function runAction(
  action: MorphoKeeperAction,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: PrivateKeyAccount,
  pool: `0x${string}`,
) {
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
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export default async () => {
  const rpcUrl = env("SEPOLIA_RPC_URL") ?? requiredEnv("NEXT_PUBLIC_RPC_URL");
  const pool = (env("CONFIDENTIAL_PRIZE_POOL_ADDRESS") ?? requiredEnv("NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS")) as `0x${string}`;
  const privateKey = privateKeyEnv("KEEPER_PRIVATE_KEY");
  const maxTransactions = normalizeKeeperMaxTransactions(env("MORPHO_KEEPER_MAX_TXS"));
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  const transactions: Array<{ action: MorphoKeeperAction; hash: Hex }> = [];

  for (let i = 0; i < maxTransactions; i++) {
    const snapshot = await readSnapshot(publicClient, pool);
    const [action] = chooseMorphoKeeperActions(snapshot, 1);
    if (!action) break;

    const hash = await runAction(action, publicClient, walletClient, account, pool);
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
