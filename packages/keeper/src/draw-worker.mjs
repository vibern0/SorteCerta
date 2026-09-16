export async function runDrawWorker({ snapshot, planner, sender, signer, poolAddress }) {
  const action = planner(snapshot);
  if (action !== "close") return undefined;

  return sender.send({
    signer,
    idempotencyKey: `draw:${poolAddress}:${snapshot.nextDrawAt}`,
    to: poolAddress,
    action,
    data: "closeDraw()",
  });
}
