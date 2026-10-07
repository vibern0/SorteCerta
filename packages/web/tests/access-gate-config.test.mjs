import assert from "node:assert/strict";
import test from "node:test";

import { shouldBypassAccessGate } from "../src/lib/access-gate-config.ts";

test("local development bypasses the access gate unless explicitly disabled", () => {
  assert.equal(shouldBypassAccessGate({ nodeEnv: "development" }), true);
  assert.equal(shouldBypassAccessGate({ nodeEnv: "development", envValue: "false" }), false);
});

test("production keeps the access gate unless the public bypass env is enabled", () => {
  assert.equal(shouldBypassAccessGate({ nodeEnv: "production" }), false);
  assert.equal(shouldBypassAccessGate({ nodeEnv: "production", envValue: "true" }), true);
  assert.equal(shouldBypassAccessGate({ nodeEnv: "production", envValue: "1" }), true);
});
