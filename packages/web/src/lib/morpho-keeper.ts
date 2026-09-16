export type MorphoKeeperAction = "supply" | "harvest" | "finalize" | "unwrap" | "accrue";

export type MorphoKeeperSnapshot = {
  availablePrincipalAssets: bigint;
  accruedYieldAssets: bigint;
  morphoPendingDepositCount: bigint;
  morphoLastAccrualAt: bigint;
  lastMorphoUnwrapAt: bigint;
  morphoUnwrapInterval: bigint;
  now: bigint;
  pendingUnwrapRequestId?: `0x${string}`;
  suppliedPrincipalAssets: bigint;
};

const HARD_MAX_TRANSACTIONS = 1;
const MIN_MORPHO_ACCRUAL_INTERVAL = 3_600n;

export function normalizeKeeperMaxTransactions(value: string | undefined): number {
  void value;
  return HARD_MAX_TRANSACTIONS;
}

export function buildInclusiveBlockRanges(fromBlock: bigint, toBlock: bigint, maxBlocks: bigint) {
  if (maxBlocks < 1n) throw new Error("maxBlocks must be positive");
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let start = fromBlock; start <= toBlock; start += maxBlocks) {
    const end = start + maxBlocks - 1n;
    ranges.push({ fromBlock: start, toBlock: end < toBlock ? end : toBlock });
  }
  return ranges;
}

export function sanitizeKeeperError(error: unknown) {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : undefined;
  const name = typeof candidate?.name === "string" ? candidate.name : "Error";
  const rawMessage = typeof candidate?.message === "string" ? candidate.message : "Keeper action failed";
  const message = rawMessage.replace(/https?:\/\/\S+/gi, "[redacted-url]");
  const sanitized: { name: string; message: string; code?: string | number; status?: string | number } = { name, message };
  if (typeof candidate?.code === "string" || typeof candidate?.code === "number") sanitized.code = candidate.code;
  if (typeof candidate?.status === "string" || typeof candidate?.status === "number") sanitized.status = candidate.status;
  return sanitized;
}

export function findOldestPendingMorphoUnwrap(
  requestedIds: readonly `0x${string}`[],
  finalizedIds: readonly `0x${string}`[],
) {
  const finalized = new Set(finalizedIds.map((id) => id.toLowerCase()));
  return requestedIds.find((id) => !finalized.has(id.toLowerCase()));
}

export function chooseMorphoKeeperActions(
  snapshot: MorphoKeeperSnapshot,
  maxTransactions = 1,
): MorphoKeeperAction[] {
  const actions: MorphoKeeperAction[] = [];
  const max = Math.min(Math.max(Math.floor(maxTransactions), 1), HARD_MAX_TRANSACTIONS);

  if (snapshot.availablePrincipalAssets > 0n) actions.push("supply");
  if (snapshot.accruedYieldAssets > 0n) actions.push("harvest");

  if (snapshot.pendingUnwrapRequestId) {
    actions.push("finalize");
    return actions.slice(0, max);
  }

  const unwrapReadyAt = snapshot.lastMorphoUnwrapAt + snapshot.morphoUnwrapInterval;
  if (snapshot.morphoPendingDepositCount > 0n && snapshot.now >= unwrapReadyAt) {
    actions.push("unwrap");
  }

  const accrualReadyAt = snapshot.morphoLastAccrualAt + MIN_MORPHO_ACCRUAL_INTERVAL;
  if (snapshot.suppliedPrincipalAssets > 0n && snapshot.now >= accrualReadyAt) actions.push("accrue");

  return actions.slice(0, max);
}

export function chooseMorphoKeeperAction(snapshot: MorphoKeeperSnapshot): MorphoKeeperAction | undefined {
  return chooseMorphoKeeperActions(snapshot, 1)[0];
}
