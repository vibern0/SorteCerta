import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const webWrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const publicRuntimeVars = [
  ["NEXT_PUBLIC_CHAIN_ID", "11155111"],
  ["NEXT_PUBLIC_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"],
  ["NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS", "0xe65D6459a7Ce01315FbB0998C37233c6FeE3aB8b"],
  ["NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS", "0x6B26B258436bcCE719Be8F9B30F87FDFD9BdFA8a"],
  ["NEXT_PUBLIC_USDC_ADDRESS", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"],
];

test("web Worker config binds the shared waitlist D1 database", () => {
  assert.match(webWrangler, /"d1_databases"\s*:/);
  assert.match(webWrangler, /"binding": "DB"/);
  assert.match(webWrangler, /"database_name": "kettigo"/);
  assert.match(webWrangler, /"database_id": "d6cfede8-60bb-45dc-b342-60e6da48f1e4"/);
  assert.match(webWrangler, /"migrations_dir": "\.\.\/landing\/migrations"/);
  assert.match(webWrangler, /"previews"\s*:/);
});

test("web Worker config preserves public runtime variables across deploys", () => {
  assert.match(webWrangler, /"vars"\s*:/);
  assert.match(webWrangler, /"previews"\s*:/);
  for (const [name, value] of publicRuntimeVars) {
    const assignment = `"${name}": "${value}"`;
    assert.equal(webWrangler.split(assignment).length, 3, `${name} should be set for production and previews`);
  }
});
