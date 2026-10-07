import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const webWrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const publicRuntimeVars = [
  ["NEXT_PUBLIC_CHAIN_ID", "11155111"],
  ["NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS", "0x9c23E5f7143612dc1232FC643A57300291e0d719"],
  ["NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS", "0x3B4F71c77e288d92871Cda495891Cd42f543A3f5"],
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
