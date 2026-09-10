import assert from "node:assert/strict";
import test from "node:test";

import { chooseMorphoKeeperActions, normalizeKeeperMaxTransactions } from "../src/lib/morpho-keeper.ts";

const baseSnapshot = {
  availablePrincipalAssets: 0n,
  accruedYieldAssets: 0n,
  morphoPendingDepositCount: 0n,
  lastMorphoUnwrapAt: 1_000n,
  morphoUnwrapInterval: 300n,
  now: 1_400n,
};

test("prioritizes finalized principal supply before harvest and unwrap", () => {
  const actions = chooseMorphoKeeperActions({
    ...baseSnapshot,
    availablePrincipalAssets: 100n,
    accruedYieldAssets: 1n,
    morphoPendingDepositCount: 1n,
  });

  assert.deepEqual(actions, ["supply"]);
});

test("can plan multiple keeper transactions up to a configured cap", () => {
  const actions = chooseMorphoKeeperActions(
    {
      ...baseSnapshot,
      availablePrincipalAssets: 100n,
      accruedYieldAssets: 1n,
      morphoPendingDepositCount: 1n,
    },
    3,
  );

  assert.deepEqual(actions, ["supply", "harvest", "unwrap"]);
});

test("waits until the timed unwrap interval has elapsed", () => {
  assert.deepEqual(
    chooseMorphoKeeperActions({
      ...baseSnapshot,
      morphoPendingDepositCount: 1n,
      now: 1_299n,
    }),
    [],
  );

  assert.deepEqual(
    chooseMorphoKeeperActions({
      ...baseSnapshot,
      morphoPendingDepositCount: 1n,
      now: 1_300n,
    }),
    ["unwrap"],
  );
});

test("normalizes keeper max transactions to a bounded positive integer", () => {
  assert.equal(normalizeKeeperMaxTransactions(undefined), 3);
  assert.equal(normalizeKeeperMaxTransactions("0"), 1);
  assert.equal(normalizeKeeperMaxTransactions("99"), 10);
  assert.equal(normalizeKeeperMaxTransactions("4"), 4);
});
