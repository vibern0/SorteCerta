import { describe, expect, it, vi } from "vitest";
import { submitWaitlist } from "../src/lib/waitlist-client";
import type { WaitlistResponse } from "../worker/types";

const baseInput = {
  email: "person@example.com",
  invitationCode: "SC-ABCD-EFGH-IJKL-MNOP",
  turnstileToken: "verified-token",
};

describe("waitlist client", () => {
  it("posts exact public payload keys to the same-origin API", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ ok: true, status: "joined" }, { status: 201 }),
    );

    await submitWaitlist(
      {
        ...baseInput,
        attribution: {
          source: "zama",
        },
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/waitlist");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "person@example.com",
      invitationCode: "SC-ABCD-EFGH-IJKL-MNOP",
      turnstileToken: "verified-token",
      attribution: {
        source: "zama",
      },
    });
  });

  it.each([
    [201, { ok: true, status: "joined" }],
    [200, { ok: true, status: "already_joined" }],
    [403, { ok: false, code: "invalid_invitation", message: "This invitation could not be accepted." }],
    [422, { ok: false, code: "verification_failed", message: "Please complete verification again." }],
    [503, { ok: false, code: "temporarily_unavailable", message: "Please try again." }],
  ] satisfies [number, WaitlistResponse][])("maps a valid %s response", async (status, body) => {
    const response = await submitWaitlist(baseInput, async () => Response.json(body, { status }));
    expect(response).toEqual(body);
  });

  it.each([
    ["invalid success", { ok: true, status: "surprise" }],
    ["invalid error", { ok: false, code: "not_public", message: "Nope" }],
    ["non-json", "not json"],
  ])("maps %s responses to the temporary public error", async (_name, body) => {
    const fetcher = async () =>
      typeof body === "string" ? new Response(body, { status: 500 }) : Response.json(body, { status: 500 });

    await expect(submitWaitlist(baseInput, fetcher)).resolves.toEqual({
      ok: false,
      code: "temporarily_unavailable",
      message: "We could not join the waitlist right now. Please try again.",
    });
  });
});
