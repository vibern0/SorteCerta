import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootWrangler = readFileSync(new URL("../../../wrangler.toml", import.meta.url), "utf8");
const publicRuntimeVars = [
  ["NEXT_PUBLIC_CHAIN_ID", "11155111"],
  ["NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS", "0x9c23E5f7143612dc1232FC643A57300291e0d719"],
  ["NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS", "0x3B4F71c77e288d92871Cda495891Cd42f543A3f5"],
  ["NEXT_PUBLIC_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"],
  ["NEXT_PUBLIC_USDC_ADDRESS", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"],
];

test("root app Worker config binds the shared waitlist D1 database", () => {
  assert.match(rootWrangler, /\[\[d1_databases\]\]/);
  assert.match(rootWrangler, /binding = "DB"/);
  assert.match(rootWrangler, /database_name = "sortecerta-landing"/);
  assert.match(rootWrangler, /database_id = "f6f8c304-fa39-495d-8307-d01f3899968a"/);
  assert.match(rootWrangler, /migrations_dir = "packages\/landing\/migrations"/);
  assert.match(rootWrangler, /\[\[previews\.d1_databases\]\]/);
});

test("root app Worker config preserves public runtime variables across deploys", () => {
  assert.match(rootWrangler, /\[vars\]/);
  assert.match(rootWrangler, /\[previews\.vars\]/);
  for (const [name, value] of publicRuntimeVars) {
    const assignment = `${name} = "${value}"`;
    assert.equal(rootWrangler.split(assignment).length, 3, `${name} should be set for production and previews`);
  }
});
