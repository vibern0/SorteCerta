import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInclusiveBlockRanges,
  chooseMorphoKeeperActions,
  findOldestPendingMorphoUnwrap,
  normalizeKeeperMaxTransactions,
  sanitizeKeeperError,
} from "../src/lib/morpho-keeper.ts";

const baseSnapshot = {
  availablePrincipalAssets: 0n,
  accruedYieldAssets: 0n,
  morphoPendingDepositCount: 0n,
  lastMorphoUnwrapAt: 1_000n,
  morphoLastAccrualAt: 0n,
  morphoUnwrapInterval: 300n,
  now: 1_400n,
  pendingUnwrapRequestId: undefined,
  suppliedPrincipalAssets: 0n,
};

test("prioritizes finalized principal supply before other Morpho work", () => {
  const actions = chooseMorphoKeeperActions({
    ...baseSnapshot,
    availablePrincipalAssets: 100n,
    accruedYieldAssets: 1n,
    morphoPendingDepositCount: 1n,
  });

  assert.deepEqual(actions, ["supply"]);
});

test("does not schedule a Morpho transaction for accrued yield alone", () => {
  assert.deepEqual(
    chooseMorphoKeeperActions({
      ...baseSnapshot,
      accruedYieldAssets: 1n,
    }),
    [],
  );
});

test("does not let accrued yield outrank a pending unwrap finalization", () => {
  assert.deepEqual(
    chooseMorphoKeeperActions({
      ...baseSnapshot,
      accruedYieldAssets: 1n,
      pendingUnwrapRequestId: "0xaaa",
    }),
    ["finalize"],
  );
});

test("limits planning to one transaction for the scheduled runtime", () => {
  const actions = chooseMorphoKeeperActions(
    {
      ...baseSnapshot,
      availablePrincipalAssets: 100n,
      accruedYieldAssets: 1n,
      morphoPendingDepositCount: 1n,
    },
    3,
  );

  assert.deepEqual(actions, ["supply"]);
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

test("finalizes an existing unwrap before requesting another batch", () => {
  assert.deepEqual(
    chooseMorphoKeeperActions(
      {
        ...baseSnapshot,
        pendingUnwrapRequestId: "0xaaa",
        morphoPendingDepositCount: 1n,
      },
      3,
    ),
    ["finalize"],
  );
});

test("accrues interest when supplied principal has no higher-priority work", () => {
  assert.deepEqual(
    chooseMorphoKeeperActions({
      ...baseSnapshot,
      now: 3_600n,
      suppliedPrincipalAssets: 31_900_000n,
    }),
    ["accrue"],
  );
});

test("does not accrue before an hour has elapsed since Morpho's last update", () => {
  assert.deepEqual(
    chooseMorphoKeeperActions({
      ...baseSnapshot,
      morphoLastAccrualAt: 1_000n,
      now: 4_599n,
      suppliedPrincipalAssets: 31_900_000n,
    }),
    [],
  );

  assert.deepEqual(
    chooseMorphoKeeperActions({
      ...baseSnapshot,
      morphoLastAccrualAt: 1_000n,
      now: 4_600n,
      suppliedPrincipalAssets: 31_900_000n,
    }),
    ["accrue"],
  );
});

test("selects the oldest requested unwrap that has not been finalized", () => {
  assert.equal(findOldestPendingMorphoUnwrap(["0xaaa", "0xbbb", "0xccc"], ["0xbbb"]), "0xaaa");
  assert.equal(findOldestPendingMorphoUnwrap(["0xaaa"], ["0xaaa"]), undefined);
});

test("normalizes keeper max transactions to a bounded positive integer", () => {
  assert.equal(normalizeKeeperMaxTransactions(undefined), 1);
  assert.equal(normalizeKeeperMaxTransactions("0"), 1);
  assert.equal(normalizeKeeperMaxTransactions("99"), 1);
  assert.equal(normalizeKeeperMaxTransactions("4"), 1);
});

test("builds exact inclusive block ranges without gaps or oversized queries", () => {
  assert.deepEqual(buildInclusiveBlockRanges(100n, 20_105n, 10_000n), [
    { fromBlock: 100n, toBlock: 10_099n },
    { fromBlock: 10_100n, toBlock: 20_099n },
    { fromBlock: 20_100n, toBlock: 20_105n },
  ]);
  assert.deepEqual(buildInclusiveBlockRanges(10n, 9n, 10_000n), []);
});

test("sanitizes keeper errors without logging credential-bearing URLs", () => {
  const sanitized = sanitizeKeeperError(new Error("request failed https://rpc.example/key?token=secret"));
  assert.deepEqual(sanitized, { name: "Error", message: "request failed [redacted-url]" });
});
