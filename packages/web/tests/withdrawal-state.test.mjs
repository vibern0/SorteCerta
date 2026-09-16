import assert from "node:assert/strict";
import test from "node:test";

import {
  balanceBucketLabels,
  deriveWithdrawalStage,
  finalizationOutcome,
  mergePendingWithdrawals,
  pendingWithdrawalBatchLabel,
  pendingWithdrawalTotal,
  serializePendingWithdrawals,
  withdrawalStageCopy,
} from "../src/lib/withdrawal-state.ts";

const forbiddenProductCopy = /encrypted|confidential|public|private|mock|mocked|testnet|sepolia|prototype|faucet|leakage|decrypted/i;

test("keeps a withdrawal visible from request through unwrap finalization", () => {
  const request = { batchId: 4n, txHash: "0xrequest" };

  assert.equal(deriveWithdrawalStage(request, { batchStatus: "open", hasClaim: true }), "requested");
  assert.equal(deriveWithdrawalStage(request, { batchStatus: "closed", hasClaim: true }), "preparing");
  assert.equal(deriveWithdrawalStage(request, { batchStatus: "funded", hasClaim: true }), "claimable");
  assert.equal(
    deriveWithdrawalStage(request, { batchStatus: "funded", hasClaim: false, unwrapPending: true }),
    "finalizing",
  );
  assert.equal(
    deriveWithdrawalStage(request, { batchStatus: "funded", hasClaim: false, unwrapPending: false }),
    "complete",
  );
});

test("never treats a zero-value finalization as success", () => {
  assert.equal(finalizationOutcome(0n), "invariant-error");
  assert.equal(finalizationOutcome(2_000_000n), "complete");
});

test("uses user-facing balance and withdrawal labels", () => {
  assert.deepEqual(Object.values(balanceBucketLabels), [
    "Wallet USDC",
    "Prize tokens",
    "Savings balance",
    "Withdrawal in progress",
  ]);
});

test("totals only known pending withdrawal amounts", () => {
  assert.equal(
    pendingWithdrawalTotal([
      { batchId: 1n, txHash: "0xaaa", amount: 1_000_000n },
      { batchId: 2n, txHash: "0xbbb" },
      { batchId: 3n, txHash: "0xccc", amount: 2_500_000n },
    ]),
    3_500_000n,
  );
});

test("merges onchain-discovered withdrawals with locally known amounts", () => {
  assert.deepEqual(
    mergePendingWithdrawals(
      [{ batchId: 4n, txHash: "0xlocal", amount: 1_000_000n }],
      [
        { batchId: 4n, txHash: "0xchain" },
        { batchId: 2n, txHash: "0xolder" },
      ],
    ),
    [
      { batchId: 4n, txHash: "0xlocal", amount: 1_000_000n },
      { batchId: 2n, txHash: "0xolder" },
    ],
  );
});

test("serializes pending withdrawals without view-only bigint fields", () => {
  const serialized = serializePendingWithdrawals([
    {
      batchId: 4n,
      txHash: "0xlocal",
      amount: 1_000_000n,
      closesAt: 1_783_456_789n,
      stage: "requested",
    },
  ]);

  assert.doesNotThrow(() => JSON.stringify(serialized));
  assert.deepEqual(serialized, [{ batchId: "4", txHash: "0xlocal", amount: "1000000" }]);
});

test("labels pending withdrawal batches distinctly", () => {
  assert.equal(pendingWithdrawalBatchLabel({ batchId: 12n, txHash: "0xlocal" }), "Batch 12");
});

test("withdrawal model copy avoids restricted product terms", () => {
  for (const phrase of [...Object.values(withdrawalStageCopy), ...Object.values(balanceBucketLabels)]) {
    assert.equal(forbiddenProductCopy.test(phrase), false, phrase);
  }
});
