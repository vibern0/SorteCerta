import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseWithdrawalKeeperAction,
  normalizeWithdrawalKeeperLookback,
  recentWithdrawalBatchIds,
} from "../src/lib/withdrawal-keeper.ts";

const baseSnapshot = {
  now: 1_000n,
  closesAt: 900n,
  requestCount: 1n,
  status: "open",
};

test("closes an expired nonempty open batch", () => {
  assert.equal(chooseWithdrawalKeeperAction(baseSnapshot), "close");
});

test("settles a closed batch", () => {
  assert.equal(chooseWithdrawalKeeperAction({ ...baseSnapshot, status: "closed" }), "settle");
});

test("does nothing for empty, funded, or unexpired batches", () => {
  assert.equal(chooseWithdrawalKeeperAction({ ...baseSnapshot, requestCount: 0n }), undefined);
  assert.equal(chooseWithdrawalKeeperAction({ ...baseSnapshot, status: "funded" }), undefined);
  assert.equal(chooseWithdrawalKeeperAction({ ...baseSnapshot, now: 899n }), undefined);
});

test("normalizes bounded batch lookback", () => {
  assert.equal(normalizeWithdrawalKeeperLookback(undefined), 8);
  assert.equal(normalizeWithdrawalKeeperLookback("0"), 1);
  assert.equal(normalizeWithdrawalKeeperLookback("99"), 32);
  assert.equal(normalizeWithdrawalKeeperLookback("4"), 4);
});

test("scans recent withdrawal batch ids from newest to oldest", () => {
  assert.deepEqual(recentWithdrawalBatchIds(3n, 8), [3n, 2n, 1n]);
  assert.deepEqual(recentWithdrawalBatchIds(10n, 3), [10n, 9n, 8n]);
});
