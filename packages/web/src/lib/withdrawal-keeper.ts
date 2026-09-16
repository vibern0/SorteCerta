export type WithdrawalBatchStatus = "open" | "closed" | "funded";
export type WithdrawalKeeperAction = "close" | "settle";

export type WithdrawalKeeperSnapshot = {
  now: bigint;
  closesAt: bigint;
  requestCount: bigint;
  status: WithdrawalBatchStatus;
};

export function chooseWithdrawalKeeperAction(snapshot: WithdrawalKeeperSnapshot): WithdrawalKeeperAction | undefined {
  if (snapshot.requestCount <= 0n) return undefined;
  if (snapshot.status === "closed") return "settle";
  if (snapshot.status === "open" && snapshot.now >= snapshot.closesAt) return "close";
  return undefined;
}

export function normalizeWithdrawalKeeperLookback(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return 8;
  return Math.min(Math.max(parsed, 1), 32);
}

export function recentWithdrawalBatchIds(currentBatchId: bigint, lookback: number): bigint[] {
  const count = Math.max(Math.floor(lookback), 1);
  const ids: bigint[] = [];
  for (let i = 0n; i < BigInt(count) && currentBatchId > i; i++) {
    ids.push(currentBatchId - i);
  }
  return ids;
}
