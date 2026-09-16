export async function runMorphoWorker({ snapshot, planner, sender, signer, poolAddress }) {
  const action = planner(snapshot);
  if (!action) return undefined;

  return sender.send({
    signer,
    idempotencyKey: `morpho:${poolAddress}:${action}:${snapshot.now}`,
    to: poolAddress,
    action,
    data: action,
  });
}
