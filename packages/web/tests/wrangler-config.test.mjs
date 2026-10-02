import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootWrangler = readFileSync(new URL("../../../wrangler.toml", import.meta.url), "utf8");
const packageWrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");

test("root app Worker config binds the shared waitlist D1 database", () => {
  assert.match(rootWrangler, /\[\[d1_databases\]\]/);
  assert.match(rootWrangler, /binding = "DB"/);
  assert.match(rootWrangler, /database_name = "sortecerta-landing"/);
  assert.match(rootWrangler, /database_id = "f6f8c304-fa39-495d-8307-d01f3899968a"/);
  assert.match(rootWrangler, /migrations_dir = "packages\/landing\/migrations"/);
});

test("package app Worker config binds the same shared waitlist D1 database", () => {
  assert.match(packageWrangler, /\[\[d1_databases\]\]/);
  assert.match(packageWrangler, /binding = "DB"/);
  assert.match(packageWrangler, /database_name = "sortecerta-landing"/);
  assert.match(packageWrangler, /database_id = "f6f8c304-fa39-495d-8307-d01f3899968a"/);
  assert.match(packageWrangler, /migrations_dir = "\.\.\/landing\/migrations"/);
});
