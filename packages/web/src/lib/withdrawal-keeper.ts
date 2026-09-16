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
