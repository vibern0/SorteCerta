import type { Attribution, Env, WaitlistResponse } from "./types";
import { verifyTurnstile, type TurnstileOutcome } from "./turnstile";
import { hashInvitationCode, parseWaitlistRequest, PublicError } from "./validation";

export type WaitlistDependencies = {
  verifyTurnstile?: typeof verifyTurnstile;
  now?: () => string;
  uuid?: () => string;
};

type InvitationRow = {
  id: string;
  email_normalized: string;
  expires_at: string | null;
  redeemed_at: string | null;
  entry_email: string | null;
};

const INVALID_INVITATION: WaitlistResponse = {
  ok: false,
  code: "invalid_invitation",
  message: "This invitation could not be accepted.",
};
const VERIFICATION_FAILED: WaitlistResponse = {
  ok: false,
  code: "verification_failed",
  message: "Please complete the verification and try again.",
};
const TEMPORARILY_UNAVAILABLE: WaitlistResponse = {
  ok: false,
  code: "temporarily_unavailable",
  message: "Please try again in a moment.",
};

export async function registerWaitlist(
  request: Request,
  env: Env,
  dependencies: WaitlistDependencies = {},
): Promise<Response> {
  let payload: Awaited<ReturnType<typeof parseWaitlistRequest>>;
  try {
    payload = await parseWaitlistRequest(request);
  } catch (error) {
    if (error instanceof PublicError) {
      return jsonResponse({ ok: false, code: error.code, message: error.message }, error.status);
    }
    return jsonResponse(TEMPORARILY_UNAVAILABLE, 503);
  }

  const makeUuid = dependencies.uuid ?? crypto.randomUUID.bind(crypto);
  const requestId = makeUuid();
  const turnstile = await runTurnstileVerification(payload.turnstileToken, env, requestId, dependencies);
  if (turnstile === "rejected") {
    return jsonResponse(VERIFICATION_FAILED, 422);
  }
  if (turnstile === "unavailable") {
    return jsonResponse(TEMPORARILY_UNAVAILABLE, 503);
  }

  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  const entryId = makeUuid();

  try {
    const codeHash = await hashInvitationCode(payload.invitationCode);
    const invitation = await findInvitation(env.DB, codeHash);
    if (!invitation) {
      return jsonResponse(INVALID_INVITATION, 403);
    }
    if (invitation.entry_email === payload.email) {
      return jsonResponse({ ok: true, status: "already_joined" }, 200);
    }
    if (!canRedeem(invitation, payload.email, now)) {
      return jsonResponse(INVALID_INVITATION, 403);
    }

    await redeemInvitation(env.DB, invitation.id, payload.email, now, entryId, payload.attribution);
    const inserted = await findCompletedEntry(env.DB, entryId, codeHash, payload.email);
    if (inserted) {
      return jsonResponse({ ok: true, status: "joined" }, 201);
    }

    const completed = await findInvitation(env.DB, codeHash);
    if (completed?.entry_email === payload.email) {
      return jsonResponse({ ok: true, status: "already_joined" }, 200);
    }
    return jsonResponse(INVALID_INVITATION, 403);
  } catch {
    return jsonResponse(TEMPORARILY_UNAVAILABLE, 503);
  }
}

async function runTurnstileVerification(
  token: string,
  env: Env,
  requestId: string,
  dependencies: WaitlistDependencies,
): Promise<TurnstileOutcome> {
  const verifier = dependencies.verifyTurnstile ?? verifyTurnstile;
  return verifier({ secret: env.TURNSTILE_SECRET_KEY, token, requestId });
}

async function findInvitation(db: D1Database, codeHash: string): Promise<InvitationRow | null> {
  return db
    .prepare(
      `SELECT
        invitations.id,
        invitations.email_normalized,
        invitations.expires_at,
        invitations.redeemed_at,
        waitlist_entries.email_normalized AS entry_email
      FROM invitations
      LEFT JOIN waitlist_entries ON waitlist_entries.invitation_id = invitations.id
      WHERE invitations.code_hash = ?`,
    )
    .bind(codeHash)
    .first<InvitationRow>();
}

function canRedeem(invitation: InvitationRow, email: string, now: string): boolean {
  return (
    invitation.email_normalized === email &&
    invitation.redeemed_at === null &&
    (invitation.expires_at === null || invitation.expires_at > now)
  );
}

async function redeemInvitation(
  db: D1Database,
  invitationId: string,
  email: string,
  now: string,
  entryId: string,
  attribution: Attribution | undefined,
) {
  await db.batch([
    db
      .prepare(
        `UPDATE invitations
        SET redeemed_at = ?
        WHERE id = ? AND redeemed_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .bind(now, invitationId, now),
    db
      .prepare(
        `INSERT INTO waitlist_entries (
          id, invitation_id, email_normalized, joined_at,
          source, medium, campaign, referral_code, referrer_host
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE changes() = 1`,
      )
      .bind(
        entryId,
        invitationId,
        email,
        now,
        attribution?.source ?? null,
        attribution?.medium ?? null,
        attribution?.campaign ?? null,
        attribution?.referralCode ?? null,
        attribution?.referrerHost ?? null,
      ),
  ]);
}

async function findCompletedEntry(db: D1Database, entryId: string, codeHash: string, email: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT waitlist_entries.id
      FROM invitations
      JOIN waitlist_entries ON waitlist_entries.invitation_id = invitations.id
      WHERE waitlist_entries.id = ? AND invitations.code_hash = ? AND waitlist_entries.email_normalized = ?`,
    )
    .bind(entryId, codeHash, email)
    .first<{ id: string }>();
  return row !== null;
}

function jsonResponse(body: WaitlistResponse, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
