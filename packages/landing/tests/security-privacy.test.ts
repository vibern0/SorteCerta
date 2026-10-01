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

  const response = await worker.fetch(makeRequest("person@example.com"), { ...env }, makeContext());

  expect(response.status).toBe(201);
  const output = JSON.stringify(log.mock.calls);
  expect(output).not.toContain("person@example.com");
});
