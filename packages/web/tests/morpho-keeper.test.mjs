import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInclusiveBlockRanges,
  chooseMorphoKeeperActions,
  findOldestPendingMorphoUnwrap,
  normalizeKeeperMaxTransactions,
  sanitizeKeeperError,
} from "../src/lib/morpho-keeper.ts";
import { runMorphoAction } from "../netlify/functions/morpho-keeper.ts";

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

test("keeper write paths preserve supply, accrue, and finalize request arguments", async () => {
  const pool = "0x1111111111111111111111111111111111111111";
  const adapter = "0x2222222222222222222222222222222222222222";
  const morpho = "0x3333333333333333333333333333333333333333";
  const requestId = `0x${"ab".repeat(32)}`;
  const proof = "0x1234";
  const writes = [];
  const params = [
    "0x4444444444444444444444444444444444444444",
    "0x5555555555555555555555555555555555555555",
    "0x6666666666666666666666666666666666666666",
    "0x7777777777777777777777777777777777777777",
    945_000_000_000_000_000n,
  ];
  const publicClient = {
    async readContract({ functionName }) {
      if (functionName === "morpho") return morpho;
      if (functionName === "marketParams") return params;
      throw new Error(`Unexpected read: ${functionName}`);
    },
  };
  const walletClient = { async writeContract(request) { writes.push(request); return requestId; } };
  const snapshot = { adapter, token: pool, pendingUnwrapRequestId: requestId };
  const account = { address: pool };

  await runMorphoAction("supply", publicClient, walletClient, account, pool, snapshot, "unused");
  await runMorphoAction("accrue", publicClient, walletClient, account, pool, snapshot, "unused");
  await runMorphoAction(
    "finalize", publicClient, walletClient, account, pool, snapshot, "unused",
    async () => ({ clearValue: 7n, decryptionProof: proof }),
  );

  assert.equal(writes[0].functionName, "supplyAvailableMorphoPrincipal");
  assert.deepEqual(writes[0].args, []);
  assert.equal(writes[1].functionName, "accrueInterest");
  assert.deepEqual(writes[1].args, [{
    loanToken: params[0], collateralToken: params[1], oracle: params[2], irm: params[3], lltv: params[4],
  }]);
  assert.equal(writes[2].functionName, "finalizeUnwrap");
  assert.deepEqual(writes[2].args, [requestId, 7n, proof]);
});
