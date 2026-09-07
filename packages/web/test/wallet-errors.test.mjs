import test from "node:test";
import assert from "node:assert/strict";

import { getWalletErrorMessage } from "../src/lib/wallet-errors.ts";

test("maps Google userinfo fetch failures to a useful sign-in message", () => {
  const error = new Error("Failed to connect with wallet. Failed to fetch (www.googleapis.com)", {
    cause: new TypeError("Failed to fetch (www.googleapis.com)"),
  });

  assert.equal(
    getWalletErrorMessage(error),
    "Could not reach Google sign-in. Check your connection or content blocker, then try again."
  );
});

test("keeps a generic message for unknown wallet failures", () => {
  assert.equal(getWalletErrorMessage(new Error("user closed popup")), "Could not sign you in.");
});
