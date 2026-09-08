import assert from "node:assert/strict";
import test from "node:test";

import { formatUSDCCompact } from "../src/lib/format.ts";

test("formats USDC action amounts with two decimals", () => {
  assert.equal(formatUSDCCompact(1_200_000n), "1.20");
  assert.equal(formatUSDCCompact(14_100_000n), "14.10");
});

test("shows the minimum USDC unit instead of rounding it away", () => {
  assert.equal(formatUSDCCompact(1n), "0.000001");
  assert.equal(formatUSDCCompact(10n), "0.00001");
});
