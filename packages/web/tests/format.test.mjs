import assert from "node:assert/strict";
import test from "node:test";

import { formatUSDC, formatUSDCCompact } from "../src/lib/format.ts";

test("formats USDC action amounts with two decimals", () => {
  assert.equal(formatUSDCCompact(1_200_000n), "1.20");
  assert.equal(formatUSDCCompact(14_100_000n), "14.10");
});

test("keeps compact amounts at two decimals by default", () => {
  assert.equal(formatUSDCCompact(1n), "0.00");
  assert.equal(formatUSDC(1n), "0.00");
});

test("shows the minimum USDC unit when six decimals are requested", () => {
  assert.equal(formatUSDC(1n, 6), "0.000001");
  assert.equal(formatUSDC(10n, 6), "0.000010");
});
