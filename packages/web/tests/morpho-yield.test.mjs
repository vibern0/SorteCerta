import assert from "node:assert/strict";
import test from "node:test";

import {
  createLatestBlockRefresher,
} from "../src/lib/morpho-yield.ts";

test("does not let an older overlapping refresh replace a newer block", async () => {
  const pending = new Map();
  const applied = [];
  const refresher = createLatestBlockRefresher(
    (blockNumber) => new Promise((resolve) => pending.set(blockNumber, resolve)),
    (snapshot) => applied.push(snapshot.blockNumber),
  );

  const older = refresher.refresh(10n);
  const newer = refresher.refresh(11n);
  pending.get(11n)({ blockNumber: 11n });
  await newer;
  pending.get(10n)({ blockNumber: 10n });
  await older;

  assert.deepEqual(applied, [11n]);
});

test("a stale request started later does not cancel an in-flight newer block", async () => {
  const pending = new Map();
  const applied = [];
  const refresher = createLatestBlockRefresher(
    (blockNumber) => new Promise((resolve) => pending.set(blockNumber, resolve)),
    (snapshot) => applied.push(snapshot.blockNumber),
  );

  const newer = refresher.refresh(11n);
  const stale = refresher.refresh(10n);
  pending.get(11n)({ blockNumber: 11n });
  await newer;
  pending.get(10n)({ blockNumber: 10n });
  await stale;

  assert.deepEqual(applied, [11n]);
});

test("a failed higher-block request does not cancel valid in-flight or subsequent blocks", async () => {
  const pending = new Map();
  const applied = [];
  const errors = [];
  const refresher = createLatestBlockRefresher(
    (blockNumber) => new Promise((resolve, reject) => pending.set(blockNumber, { resolve, reject })),
    (snapshot) => applied.push(snapshot.blockNumber),
    (error) => errors.push(error.message),
  );

  const inFlight = refresher.refresh(11n);
  const failed = refresher.refresh(12n);
  pending.get(12n).reject(new Error("Block 12 unavailable"));
  await failed;
  pending.get(11n).resolve({ blockNumber: 11n });
  await inFlight;

  const subsequent = refresher.refresh(13n);
  pending.get(13n).resolve({ blockNumber: 13n });
  await subsequent;

  assert.deepEqual(applied, [11n, 13n]);
  assert.deepEqual(errors, ["Block 12 unavailable"]);
});

test("a stored fallback cannot replace projected data for the same block", async () => {
  const pending = [];
  const applied = [];
  const refresher = createLatestBlockRefresher(
    () => new Promise((resolve) => pending.push(resolve)),
    (snapshot) => applied.push(snapshot.source),
  );

  const olderStored = refresher.refresh(77n);
  const newerProjected = refresher.refresh(77n);
  pending[1]({ blockNumber: 77n, source: "projected" });
  await newerProjected;
  pending[0]({ blockNumber: 77n, source: "stored" });
  await olderStored;

  assert.deepEqual(applied, ["projected"]);
});

test("an unpinned refresh cannot regress a watcher projection for the same block", async () => {
  const pending = new Map();
  const applied = [];
  const refresher = createLatestBlockRefresher(
    (blockNumber) => new Promise((resolve) => pending.set(blockNumber, resolve)),
    (snapshot) => applied.push(snapshot.source),
  );

  const unpinned = refresher.refresh();
  const watcher = refresher.refresh(77n);
  pending.get(77n)({ blockNumber: 77n, source: "projected" });
  await watcher;
  pending.get(undefined)({ blockNumber: 77n, source: "stored" });
  await unpinned;

  assert.deepEqual(applied, ["projected"]);
});

test("projected data upgrades a stored result for the same block", async () => {
  const pending = [];
  const applied = [];
  const refresher = createLatestBlockRefresher(
    () => new Promise((resolve) => pending.push(resolve)),
    (snapshot) => applied.push(snapshot.source),
  );

  const stored = refresher.refresh(77n);
  const projected = refresher.refresh(77n);
  pending[0]({ blockNumber: 77n, source: "stored" });
  await stored;
  pending[1]({ blockNumber: 77n, source: "projected" });
  await projected;

  assert.deepEqual(applied, ["stored", "projected"]);
});

test("disposal prevents an in-flight refresh from updating state", async () => {
  let resolveRead;
  const applied = [];
  const refresher = createLatestBlockRefresher(
    () => new Promise((resolve) => { resolveRead = resolve; }),
    (snapshot) => applied.push(snapshot.blockNumber),
  );

  const refresh = refresher.refresh(12n);
  refresher.dispose();
  resolveRead({ blockNumber: 12n });
  await refresh;

  assert.deepEqual(applied, []);
});
