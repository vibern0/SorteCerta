export async function runWithdrawalWorker({ snapshot, planner, sender, signer, poolAddress, batchId }) {
  const action = planner(snapshot);
  if (!action) return undefined;

  return sender.send({
    signer,
    idempotencyKey: `withdrawal:${poolAddress}:${batchId}:${action}`,
    to: poolAddress,
    action,
    data: action,
  });
}
