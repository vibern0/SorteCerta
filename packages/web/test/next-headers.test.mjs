import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

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

test("replaces Segment analytics with a local no-op module", () => {
  const config = { resolve: { alias: {} } };

  const nextWebpackConfig = nextConfig.webpack(config);

  assert.equal(nextWebpackConfig, config);
  assert.ok(config.resolve.alias["@segment/analytics-next"].endsWith("src/lib/segment-noop.ts"));
  assert.equal(existsSync(config.resolve.alias["@segment/analytics-next"]), true);
});
