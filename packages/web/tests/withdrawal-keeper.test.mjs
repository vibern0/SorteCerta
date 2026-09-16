import assert from "node:assert/strict";
import test from "node:test";

import { chooseWithdrawalKeeperAction } from "../src/lib/withdrawal-keeper.ts";

const baseSnapshot = {
  requestCount: 1n,
  funded: false,
  aggregateDecryptRequested: false,
  aggregateAmountReady: false,
};

test("requests aggregate decryption for an unfunded batch with requests", () => {
  assert.equal(chooseWithdrawalKeeperAction(baseSnapshot), "request_decrypt");
});

test("restores liquidity once the aggregate amount is ready", () => {
  assert.equal(
    chooseWithdrawalKeeperAction({
      ...baseSnapshot,
      aggregateDecryptRequested: true,
      aggregateAmountReady: true,
    }),
    "restore",
  );
});

test("does nothing for empty, funded, or waiting batches", () => {
  assert.equal(chooseWithdrawalKeeperAction({ ...baseSnapshot, requestCount: 0n }), undefined);
  assert.equal(chooseWithdrawalKeeperAction({ ...baseSnapshot, funded: true }), undefined);
  assert.equal(chooseWithdrawalKeeperAction({ ...baseSnapshot, aggregateDecryptRequested: true }), undefined);
});
