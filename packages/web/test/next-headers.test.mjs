import test from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../next.config.js";

test("allows OAuth popups to keep opener access", async () => {
  const headers = await nextConfig.headers();
  const globalHeaders = headers.find((entry) => entry.source === "/(.*)");

  assert.ok(globalHeaders);
  assert.deepEqual(globalHeaders.headers, [
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin-allow-popups",
    },
  ]);
});
