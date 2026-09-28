import { env } from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import { makeContext, makeRequest } from "./helpers";
import worker from "../worker/index";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("never logs submitted secrets or identity", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: false })));
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

  const response = await worker.fetch(
    makeRequest("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP", { turnstileToken: "secret-token" }),
    { ...env, TURNSTILE_SECRET_KEY: "test-secret" },
    makeContext(),
  );

  expect(response.status).toBe(422);
  const output = JSON.stringify(log.mock.calls);
  expect(output).not.toContain("person@example.com");
  expect(output).not.toContain("SC-ABCD-EFGH-IJKL-MNOP");
  expect(output).not.toContain("secret-token");
});
