import assert from "node:assert/strict";
import test from "node:test";

import { chooseWithdrawalKeeperAction } from "../src/lib/withdrawal-keeper.ts";

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
