import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../worker/turnstile";

describe("Turnstile verification", () => {
  it("posts secret and token to Siteverify without an IP address", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(String(url)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      expect(init?.method).toBe("POST");
      expect(form.get("secret")).toBe("secret");
      expect(form.get("response")).toBe("token");
      expect(form.get("idempotency_key")).toBe("request-id");
      expect(form.has("remoteip")).toBe(false);
      return Response.json({ success: true });
    });

    await expect(
      verifyTurnstile({ secret: "secret", token: "token", requestId: "request-id" }, fetcher),
    ).resolves.toBe("verified");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    [Response.json({ success: false }), "rejected"],
    [new Response("bad gateway", { status: 502 }), "unavailable"],
  ] as const)("maps Siteverify outcomes", async (response, outcome) => {
    await expect(
      verifyTurnstile({ secret: "secret", token: "token", requestId: "request-id" }, async () => response),
    ).resolves.toBe(outcome);
  });

  it.each([
    [Response.json({ success: "true" })],
    [new Response("{", { headers: { "content-type": "application/json" } })],
  ])("treats malformed Siteverify responses as unavailable", async (response) => {
    await expect(
      verifyTurnstile({ secret: "secret", token: "token", requestId: "request-id" }, async () => response),
    ).resolves.toBe("unavailable");
  });
});
