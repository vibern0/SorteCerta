import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedDependencies, makeRequest } from "./helpers";
import { registerWaitlist } from "../worker/waitlist";

async function tableCounts() {
  const entries = await env.DB.prepare("SELECT COUNT(*) count FROM waitlist_entries").first<{ count: number }>();
  return { entries: entries?.count ?? 0 };
}

describe("waitlist registration", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM waitlist_entries;");
  });

  it("joins once with only an email and returns idempotent success for repeats", async () => {
    const dependencies = fixedDependencies();

    const joined = await registerWaitlist(makeRequest("person@example.com"), env, dependencies);
    const repeat = await registerWaitlist(makeRequest("person@example.com"), env, dependencies);

    expect(joined.status).toBe(201);
    expect(await joined.json()).toEqual({ ok: true, status: "joined" });
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toEqual({ ok: true, status: "already_joined" });
    expect((await tableCounts()).entries).toBe(1);
    await expect(
      env.DB.prepare("SELECT approved_at FROM waitlist_entries WHERE email_normalized = ?")
        .bind("person@example.com")
        .first<{ approved_at: string | null }>(),
    ).resolves.toEqual({ approved_at: null });
  });

  it("rejects malformed requests before mutating D1", async () => {
    const response = await registerWaitlist(
      makeRequest("person@example.com", { body: "{", contentType: "application/json" }),
      env,
      fixedDependencies(),
    );

    expect(response.status).toBe(400);
    expect((await tableCounts()).entries).toBe(0);
  });

  it("allows only one row under concurrent submissions", async () => {
    const responses = await Promise.all([
      registerWaitlist(makeRequest("person@example.com"), env, fixedDependencies()),
      registerWaitlist(makeRequest("person@example.com"), env, fixedDependencies()),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect((await tableCounts()).entries).toBe(1);
  });

  it("returns a temporary response when D1 fails", async () => {
    const failingDb = {
      prepare() {
        throw new Error("D1 is down");
      },
    };

    const response = await registerWaitlist(
      makeRequest("person@example.com"),
      { ...env, DB: failingDb as unknown as D1Database },
      fixedDependencies(),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      code: "temporarily_unavailable",
      message: "Please try again in a moment.",
    });
  });
});
