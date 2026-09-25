import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("allows OAuth popups to keep opener access on Cloudflare", async () => {
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");

  assert.match(headers, /^\/\*/m);
  assert.match(
    headers,
    /^\s+Cross-Origin-Opener-Policy:\s*same-origin-allow-popups$/m,
  );
});
