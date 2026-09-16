import assert from "node:assert/strict";
import test from "node:test";

import { runDrawWorker } from "../src/draw-worker.mjs";
import { runMorphoWorker } from "../src/morpho-worker.mjs";
import { runWithdrawalWorker } from "../src/withdrawal-worker.mjs";

function recordingSender() {
  const requests = [];
  return {
    requests,
    sender: {
      async send(request) {
        requests.push(request);
        return { hash: `0x${request.idempotencyKey}` };
      },
    },
  };
}

test("draw worker submits close action through the shared sender", async () => {
  const { requests, sender } = recordingSender();

  await runDrawWorker({
    snapshot: { nextDrawAt: 1_000n },
    planner: () => "close",
    sender,
    signer: "keeper",
    poolAddress: "0xpool",
  });

  assert.deepEqual(requests, [
    {
      signer: "keeper",
      idempotencyKey: "draw:0xpool:1000",
      to: "0xpool",
      action: "close",
      data: "closeDraw()",
    },
  ]);
});

test("morpho and withdrawal workers stay quiet when their planners return no action", async () => {
  const { requests, sender } = recordingSender();

  await runMorphoWorker({ snapshot: { now: 1n }, planner: () => undefined, sender, signer: "keeper", poolAddress: "0xpool" });
  await runWithdrawalWorker({
    snapshot: {},
    planner: () => undefined,
    sender,
    signer: "keeper",
    poolAddress: "0xpool",
    batchId: 1n,
  });

  assert.deepEqual(requests, []);
});

test("withdrawal worker derives stable batch-scoped idempotency keys", async () => {
  const { requests, sender } = recordingSender();

  await runWithdrawalWorker({
    snapshot: {},
    planner: () => "restore",
    sender,
    signer: "keeper",
    poolAddress: "0xpool",
    batchId: 7n,
  });

  assert.equal(requests[0].idempotencyKey, "withdrawal:0xpool:7:restore");
});
