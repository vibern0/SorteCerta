import assert from "node:assert/strict";
import test from "node:test";

import {
  hasCachedApprovedAccess,
  hasCachedApprovedSession,
  readCachedApprovedEmail,
  rememberApprovedAccess,
  rememberApprovedEmail,
  shouldBypassAccessGate,
} from "../src/lib/access-cache.ts";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("stores an approved email so refresh can return directly to sign-in", () => {
  const storage = createStorage();

  rememberApprovedEmail(" Person@Example.COM ", storage);

  assert.equal(readCachedApprovedEmail(storage), "person@example.com");
});

test("approved access cache only matches the same email and wallet", () => {
  const storage = createStorage();

  rememberApprovedAccess(
    {
      email: "person@example.com",
      walletAddress: "0x00000000000000000000000000000000000000aa",
    },
    storage,
  );

  assert.equal(
    hasCachedApprovedAccess(
      {
        email: " PERSON@example.com ",
        walletAddress: "0x00000000000000000000000000000000000000AA",
      },
      storage,
    ),
    true,
  );
  assert.equal(
    hasCachedApprovedAccess(
      {
        email: "person@example.com",
        walletAddress: "0x00000000000000000000000000000000000000bb",
      },
      storage,
    ),
    false,
  );
});

test("only a completed approved access pass can bypass the gate screen", () => {
  const storage = createStorage();

  rememberApprovedEmail("person@example.com", storage);
  assert.equal(hasCachedApprovedSession(storage), false);

  rememberApprovedAccess(
    {
      email: "person@example.com",
      walletAddress: "0x00000000000000000000000000000000000000aa",
    },
    storage,
  );
  assert.equal(hasCachedApprovedSession(storage), true);
});

test("does not bypass the gate while wallet restore is still pending", () => {
  assert.equal(
    shouldBypassAccessGate({
      walletReady: false,
      hasApprovedSession: true,
      hasMatchingApprovedAccess: false,
      hasSession: false,
    }),
    false,
  );
});

test("bypasses only after restore or a matching restored session", () => {
  assert.equal(
    shouldBypassAccessGate({
      walletReady: true,
      hasApprovedSession: true,
      hasMatchingApprovedAccess: false,
      hasSession: false,
    }),
    true,
  );
  assert.equal(
    shouldBypassAccessGate({
      walletReady: true,
      hasApprovedSession: true,
      hasMatchingApprovedAccess: true,
      hasSession: true,
    }),
    true,
  );
  assert.equal(
    shouldBypassAccessGate({
      walletReady: true,
      hasApprovedSession: true,
      hasMatchingApprovedAccess: false,
      hasSession: true,
    }),
    false,
  );
});
