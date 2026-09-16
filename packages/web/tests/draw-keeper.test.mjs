import assert from "node:assert/strict";
import test from "node:test";

import { chooseDrawKeeperAction } from "../src/lib/draw-keeper.ts";

const baseSnapshot = {
  now: 1_000n,
  nextDrawAt: 1_000n,
  participantCount: 1n,
  publicPrizeReserve: 1_000_000n,
  minimumPrize: 1_000_000n,
};

test("closes a draw exactly at the deadline when participants and prize are ready", () => {
  assert.equal(chooseDrawKeeperAction(baseSnapshot), "close");
});

test("does not close before the deadline", () => {
  assert.equal(chooseDrawKeeperAction({ ...baseSnapshot, now: 999n }), undefined);
});

test("does not close empty or underfunded rounds", () => {
  assert.equal(chooseDrawKeeperAction({ ...baseSnapshot, participantCount: 0n }), undefined);
  assert.equal(chooseDrawKeeperAction({ ...baseSnapshot, publicPrizeReserve: 999_999n }), undefined);
});
