import assert from "node:assert/strict";
import test from "node:test";

import { formatUSDC, formatUSDCCompact } from "../src/lib/format.ts";

test("formats USDC action amounts with two decimals", () => {
  assert.equal(formatUSDCCompact(1_200_000n), "1.20");
  assert.equal(formatUSDCCompact(14_100_000n), "14.10");
});

test("trims trailing precision while keeping two decimals", () => {
  assert.equal(formatUSDC(1_800_000n, 6), "1.80");
  assert.equal(formatUSDC(1_234_567n, 6), "1.234567");
});
