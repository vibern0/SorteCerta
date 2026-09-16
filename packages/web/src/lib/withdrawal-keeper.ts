export type WithdrawalKeeperAction = "request_decrypt" | "restore";

export type WithdrawalKeeperSnapshot = {
  requestCount: bigint;
  funded: boolean;
  aggregateDecryptRequested: boolean;
  aggregateAmountReady: boolean;
};

export function chooseWithdrawalKeeperAction(snapshot: WithdrawalKeeperSnapshot): WithdrawalKeeperAction | undefined {
  if (snapshot.funded || snapshot.requestCount <= 0n) return undefined;
  if (!snapshot.aggregateDecryptRequested) return "request_decrypt";
  if (snapshot.aggregateAmountReady) return "restore";
  return undefined;
}
