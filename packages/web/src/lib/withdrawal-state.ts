export type WithdrawalBatchStatus = "open" | "closed" | "funded";
export type WithdrawalStage = "requested" | "preparing" | "claimable" | "finalizing" | "complete";

export type PendingWithdrawal = {
  batchId: bigint;
  txHash: `0x${string}`;
  amount?: bigint;
  unwrapRequestId?: `0x${string}`;
};

export type WithdrawalStageInputs = {
  batchStatus: WithdrawalBatchStatus;
  hasClaim: boolean;
  unwrapPending?: boolean;
};

export const withdrawalStageCopy: Record<WithdrawalStage, string> = {
  requested: "Withdrawal requested",
  preparing: "Preparing your funds",
  claimable: "Ready to receive",
  finalizing: "Finalizing withdrawal",
  complete: "Complete",
};

export const balanceBucketLabels = {
  walletUsdc: "Wallet USDC",
  prizeTokens: "Prize tokens",
  savingsBalance: "Savings balance",
  withdrawalInProgress: "Withdrawal in progress",
} as const;

export function pendingWithdrawalTotal(requests: readonly PendingWithdrawal[]) {
  return requests.reduce((total, request) => total + (request.amount ?? 0n), 0n);
}

export function mergePendingWithdrawals(
  localRequests: readonly PendingWithdrawal[],
  discoveredRequests: readonly PendingWithdrawal[],
) {
  const byBatch = new Map<bigint, PendingWithdrawal>();

  for (const request of discoveredRequests) {
    byBatch.set(request.batchId, request);
  }

  for (const request of localRequests) {
    const discovered = byBatch.get(request.batchId);
    const unwrapRequestId = request.unwrapRequestId ?? discovered?.unwrapRequestId;
    const next: PendingWithdrawal = {
      ...discovered,
      ...request,
      amount: request.amount ?? discovered?.amount,
    };
    if (unwrapRequestId) next.unwrapRequestId = unwrapRequestId;
    byBatch.set(request.batchId, next);
  }

  return Array.from(byBatch.values()).sort((a, b) => Number(b.batchId - a.batchId));
}

export function deriveWithdrawalStage(
  _request: PendingWithdrawal,
  state: WithdrawalStageInputs,
): WithdrawalStage {
  if (state.hasClaim && state.batchStatus === "open") return "requested";
  if (state.hasClaim && state.batchStatus === "closed") return "preparing";
  if (state.hasClaim && state.batchStatus === "funded") return "claimable";
  if (!state.hasClaim && state.unwrapPending) return "finalizing";
  return "complete";
}

export function finalizationOutcome(cleartextAmount: bigint) {
  return cleartextAmount === 0n ? "invariant-error" : "complete";
}
