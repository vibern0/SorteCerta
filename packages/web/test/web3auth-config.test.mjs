import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("disables Web3Auth analytics requests", () => {
  const source = readFileSync(new URL("../src/lib/web3auth.ts", import.meta.url), "utf8");

  assert.match(source, /disableAnalytics:\s*true/);
});

test("does not request accounts after Web3Auth connect", () => {
  const source = readFileSync(new URL("../src/lib/web3auth.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /eth_requestAccounts/);
});
