export type MorphoKeeperAction = "supply" | "harvest" | "unwrap";

export type MorphoKeeperSnapshot = {
  availablePrincipalAssets: bigint;
  accruedYieldAssets: bigint;
  morphoPendingDepositCount: bigint;
  lastMorphoUnwrapAt: bigint;
  morphoUnwrapInterval: bigint;
  now: bigint;
};

const DEFAULT_MAX_TRANSACTIONS = 3;
const HARD_MAX_TRANSACTIONS = 10;

export function normalizeKeeperMaxTransactions(value: string | undefined): number {
  const parsed = value === undefined ? DEFAULT_MAX_TRANSACTIONS : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_TRANSACTIONS;
  return Math.min(Math.max(parsed, 1), HARD_MAX_TRANSACTIONS);
}

export function chooseMorphoKeeperActions(
  snapshot: MorphoKeeperSnapshot,
  maxTransactions = 1,
): MorphoKeeperAction[] {
  const actions: MorphoKeeperAction[] = [];
  const max = Math.min(Math.max(Math.floor(maxTransactions), 1), HARD_MAX_TRANSACTIONS);

  if (snapshot.availablePrincipalAssets > 0n) actions.push("supply");
  if (snapshot.accruedYieldAssets > 0n) actions.push("harvest");

  const unwrapReadyAt = snapshot.lastMorphoUnwrapAt + snapshot.morphoUnwrapInterval;
  if (snapshot.morphoPendingDepositCount > 0n && snapshot.now >= unwrapReadyAt) {
    actions.push("unwrap");
  }

  return actions.slice(0, max);
}
