import assert from "node:assert/strict";
import test from "node:test";

import { formatUSDCCompact } from "../src/lib/format.ts";

test("formats USDC action amounts with two decimals", () => {
  assert.equal(formatUSDCCompact(1_200_000n), "1.20");
  assert.equal(formatUSDCCompact(14_100_000n), "14.10");
});
