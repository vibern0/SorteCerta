import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedDependencies, makeRequest } from "./helpers";
import { registerWaitlist } from "../worker/waitlist";
import { hashInvitationCode } from "../worker/validation";

const INVITATION_CODE = "SC-ABCD-EFGH-IJKL-MNOP";
const INVALID_INVITATION = {
  ok: false,
  code: "invalid_invitation",
  message: "This invitation could not be accepted.",
};

async function seed(email: string, code: string, expiresAt: string | null = null, redeemedAt: string | null = null) {
  await env.DB.prepare("INSERT INTO invitations VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), email, await hashInvitationCode(code), "2026-09-25T10:00:00.000Z", expiresAt, redeemedAt)
    .run();
}

async function tableCounts() {
  const invitations = await env.DB.prepare("SELECT COUNT(*) count FROM invitations").first<{ count: number }>();
  const entries = await env.DB.prepare("SELECT COUNT(*) count FROM waitlist_entries").first<{ count: number }>();
  return {
    invitations: invitations?.count ?? 0,
    entries: entries?.count ?? 0,
  };
}

describe("waitlist registration", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM waitlist_entries; DELETE FROM invitations;");
  });

  it("joins once and returns idempotent success for the same pair", async () => {
    await seed("person@example.com", INVITATION_CODE);
    const dependencies = fixedDependencies("verified");

    const joined = await registerWaitlist(makeRequest("person@example.com", INVITATION_CODE), env, dependencies);
    const repeat = await registerWaitlist(makeRequest("person@example.com", INVITATION_CODE), env, dependencies);

    expect(joined.status).toBe(201);
    expect(await joined.json()).toEqual({ ok: true, status: "joined" });
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toEqual({ ok: true, status: "already_joined" });
    expect((await tableCounts()).entries).toBe(1);
  });

  it.each([
    ["other@example.com", INVITATION_CODE],
    ["person@example.com", "SC-RANDOM-CODE-VALUE"],
  ])("uses one response for invalid invitation states", async (email, code) => {
    await seed("person@example.com", INVITATION_CODE);

    const response = await registerWaitlist(makeRequest(email, code), env, fixedDependencies("verified"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(INVALID_INVITATION);
  });

  it("uses the invalid invitation response for expired codes", async () => {
    await seed("person@example.com", INVITATION_CODE, "2026-09-25T11:59:59.000Z");

    const response = await registerWaitlist(
      makeRequest("person@example.com", INVITATION_CODE),
      env,
      fixedDependencies("verified"),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(INVALID_INVITATION);
    expect((await tableCounts()).entries).toBe(0);
  });

  it("uses the invalid invitation response when another identity already redeemed it", async () => {
    await seed("person@example.com", INVITATION_CODE, null, "2026-09-25T11:00:00.000Z");

    const response = await registerWaitlist(
      makeRequest("other@example.com", INVITATION_CODE),
      env,
      fixedDependencies("verified"),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(INVALID_INVITATION);
  });

  it("verifies Turnstile before mutating D1", async () => {
    await seed("person@example.com", INVITATION_CODE);
    const dependencies = fixedDependencies("rejected");

    const response = await registerWaitlist(makeRequest("person@example.com", INVITATION_CODE), env, dependencies);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      ok: false,
      code: "verification_failed",
      message: "Please complete the verification and try again.",
    });
    expect((await tableCounts()).entries).toBe(0);
    expect(
      await env.DB.prepare("SELECT redeemed_at FROM invitations WHERE email_normalized = ?")
        .bind("person@example.com")
        .first<{ redeemed_at: string | null }>(),
    ).toEqual({ redeemed_at: null });
  });

  it("returns a temporary response when Turnstile is unavailable", async () => {
    await seed("person@example.com", INVITATION_CODE);

    const response = await registerWaitlist(
      makeRequest("person@example.com", INVITATION_CODE),
      env,
      fixedDependencies("unavailable"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      code: "temporarily_unavailable",
      message: "Please try again in a moment.",
    });
    expect((await tableCounts()).entries).toBe(0);
  });

  it("rejects malformed requests before verification", async () => {
    const dependencies = fixedDependencies("verified");

    const response = await registerWaitlist(
      makeRequest("person@example.com", INVITATION_CODE, { body: "{", contentType: "application/json" }),
      env,
      dependencies,
    );

    expect(response.status).toBe(400);
    expect(dependencies.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("allows only one row under concurrent submissions", async () => {
    await seed("person@example.com", INVITATION_CODE);
    const responses = await Promise.all([
      registerWaitlist(makeRequest("person@example.com", INVITATION_CODE), env, fixedDependencies("verified")),
      registerWaitlist(makeRequest("person@example.com", INVITATION_CODE), env, fixedDependencies("verified")),
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
      makeRequest("person@example.com", INVITATION_CODE),
      { ...env, DB: failingDb as unknown as D1Database },
      fixedDependencies("verified"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      code: "temporarily_unavailable",
      message: "Please try again in a moment.",
    });
  });
});
