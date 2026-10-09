import assert from "node:assert/strict";
import test from "node:test";

import { EthSafeSignature } from "@safe-global/protocol-kit";
import { getAddress, hashTypedData } from "viem";

import {
  buildPasskeySigner,
  createPasskeyAccount,
  restorePasskeyAccount,
  signSafeTypedData,
  waitForUserOperationTransaction,
} from "../src/lib/passkey-safe.ts";

const SAFE_ADDRESS = getAddress("0x00000000000000000000000000000000000000bb");
const VERIFIER_ADDRESS = getAddress("0x00000000000000000000000000000000000000aa");
const RAW_ID = "aabbccdd";
const COORDINATES = {
  x: `0x${"11".repeat(32)}`,
  y: `0x${"22".repeat(32)}`,
};

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

function relay(address = SAFE_ADDRESS) {
  return {
    protocolKit: {
      async getAddress() {
        return address;
      },
    },
    async createTransaction() {
      return { operation: true };
    },
    async signSafeOperation(operation) {
      return { ...operation, signed: true };
    },
    async executeTransaction() {
      return `0x${"33".repeat(32)}`;
    },
    async getUserOperationReceipt() {
      return {
        success: true,
        receipt: { transactionHash: `0x${"44".repeat(32)}` },
      };
    },
  };
}

function dependencies(overrides = {}) {
  return {
    async createCredential() {
      return { id: "credential" };
    },
    async extractPasskeyData() {
      return { rawId: RAW_ID, coordinates: COORDINATES };
    },
    getVerifierAddress(chainId) {
      assert.equal(chainId, "11155111");
      return VERIFIER_ADDRESS;
    },
    async initRelay() {
      return relay();
    },
    async getCode() {
      return "0x";
    },
    async getCredential() {
      return { id: "credential" };
    },
    async sleep() {},
    ...overrides,
  };
}

test("creates a deterministic Safe 1.4.1 session and stores checksum metadata", async () => {
  const storage = createStorage();
  let initOptions;
  const deps = dependencies({
    async initRelay(options) {
      initOptions = options;
      return relay();
    },
  });

  const session = await createPasskeyAccount(
    { rpId: "app.kettigo.xyz", rpName: "Kettigo", storage },
    deps,
  );

  assert.equal(session.address, SAFE_ADDRESS);
  assert.equal(initOptions.safeModulesVersion, "0.3.0");
  assert.equal(initOptions.customContracts.entryPointAddress.toLowerCase(), "0x0000000071727de22e5e9d8baf0edac6f37da032");
  assert.deepEqual(initOptions.options.owners, []);
  assert.equal(initOptions.options.threshold, 1);
  assert.equal(initOptions.options.safeVersion, "1.4.1");
  assert.match(initOptions.options.saltNonce, /^\d+$/);
  assert.equal(initOptions.signer.verifierAddress, VERIFIER_ADDRESS);
  const persisted = JSON.parse(storage.getItem("kettigo.passkey.v1"));
  assert.equal(persisted.safeAddress, SAFE_ADDRESS);
  assert.equal(persisted.verifierAddress, VERIFIER_ADDRESS);
  assert.equal("email" in persisted, false);
});

test("restores counterfactual and deployed Safes through the correct SDK option", async () => {
  const metadata = {
    rawId: RAW_ID,
    coordinates: COORDINATES,
    verifierAddress: VERIFIER_ADDRESS,
    safeAddress: SAFE_ADDRESS,
  };

  for (const [code, expectedKey] of [["0x", "owners"], ["0x6000", "safeAddress"]]) {
    let initOptions;
    const session = await restorePasskeyAccount(
      { metadata, rpId: "app.kettigo.xyz" },
      dependencies({
        async getCode() {
          return code;
        },
        async initRelay(options) {
          initOptions = options;
          return relay();
        },
      }),
    );

    assert.equal(session.address, SAFE_ADDRESS);
    assert.equal(expectedKey in initOptions.options, true);
  }
});

test("blocks a restored signer when Safe derivation no longer matches", async () => {
  const other = getAddress("0x00000000000000000000000000000000000000cc");
  await assert.rejects(
    restorePasskeyAccount(
      {
        metadata: {
          rawId: RAW_ID,
          coordinates: COORDINATES,
          verifierAddress: VERIFIER_ADDRESS,
          safeAddress: SAFE_ADDRESS,
        },
        rpId: "app.kettigo.xyz",
      },
      dependencies({
        async initRelay() {
          return relay(other);
        },
      }),
    ),
    /does not match/i,
  );
});

test("waits for a successful UserOperation receipt and returns the transaction hash", async () => {
  let attempts = 0;
  const result = await waitForUserOperationTransaction(
    {
      async getUserOperationReceipt() {
        attempts += 1;
        return attempts === 1
          ? null
          : { success: true, receipt: { transactionHash: `0x${"44".repeat(32)}` } };
      },
    },
    `0x${"33".repeat(32)}`,
    { timeoutMs: 10, pollMs: 0, sleep: async () => {} },
  );
  assert.equal(result, `0x${"44".repeat(32)}`);
  assert.equal(attempts, 2);

  await assert.rejects(
    waitForUserOperationTransaction(
      { async getUserOperationReceipt() { return { success: false, receipt: { transactionHash: `0x${"55".repeat(32)}` } }; } },
      `0x${"33".repeat(32)}`,
      { timeoutMs: 10, pollMs: 0, sleep: async () => {} },
    ),
    /failed/i,
  );
});

test("encodes a canonical Safe signature over bigint EIP-712 data", async () => {
  const owner = getAddress("0x00000000000000000000000000000000000000dd");
  const signature = `0x${"11".repeat(64)}1b`;
  let signedHash;
  const typedData = {
    domain: { name: "Kettigo", version: "1", chainId: 11155111n, verifyingContract: SAFE_ADDRESS },
    types: { Authorization: [{ name: "expires", type: "uint256" }] },
    primaryType: "Authorization",
    message: { expires: 123n },
  };

  const encoded = await signSafeTypedData(
    {
      async signHash(hash) {
        signedHash = hash;
        return new EthSafeSignature(owner, signature);
      },
    },
    typedData,
  );

  assert.equal(signedHash, hashTypedData(typedData));
  assert.equal(encoded, signature);
});

test("builds a passkey signer whose assertion callback is scoped to the stored credential", async () => {
  let requestedRawId;
  const signer = buildPasskeySigner(
    { rawId: RAW_ID, coordinates: COORDINATES, verifierAddress: VERIFIER_ADDRESS, safeAddress: SAFE_ADDRESS },
    "app.kettigo.xyz",
    {
      async getCredential(rawId, rpId) {
        requestedRawId = rawId;
        assert.equal(rpId, "app.kettigo.xyz");
        return { id: "credential" };
      },
    },
  );
  await signer.getFn({ publicKey: { challenge: new Uint8Array([1]) } });
  assert.equal(requestedRawId, RAW_ID);
});
