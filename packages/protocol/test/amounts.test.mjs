import assert from "node:assert/strict";
import test from "node:test";

import { parseAmount } from "../src/index.ts";

test("parses canonical non-negative token amounts", () => {
  assert.equal(parseAmount("0", 6), 0n);
  assert.equal(parseAmount(" 1 ", 6), 1_000_000n);
  assert.equal(parseAmount("1.", 6), 1_000_000n);
  assert.equal(parseAmount("1.000001", 6), 1_000_001n);
  assert.equal(parseAmount("1,000.25", 6), 1_000_250_000n);
  assert.equal(parseAmount("1,000.", 6), 1_000_000_000n);
});

test("rejects invalid syntax and misplaced grouping", () => {
  for (const value of [
    "",
    ".5",
    "-1",
    "+1",
    "1e3",
    "1,2",
    "12,34",
    "1,,000",
    "1 000",
    "1.2.3",
  ]) {
    assert.throws(() => parseAmount(value, 6), /valid amount/i);
  }
});

test("reports precision and validates decimals before arithmetic", () => {
  assert.throws(
    () => parseAmount("1.0000001", 6),
    /at most 6 decimal places/i,
  );
  for (const decimals of [
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Infinity,
  ]) {
    assert.throws(
      () => parseAmount("1", decimals),
      /non-negative safe integer/i,
    );
  }
});

test("rejects hostile long input without coercing a partial value", () => {
  assert.throws(
    () => parseAmount(`${"1".repeat(100_000)}x`, 6),
    /valid amount/i,
  );
});
