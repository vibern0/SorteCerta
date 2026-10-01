import type { Attribution, Env, WaitlistResponse } from "./types";
import { parseWaitlistRequest, PublicError } from "./validation";

export type WaitlistDependencies = {
  now?: () => string;
  uuid?: () => string;
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

  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  const entryId = (dependencies.uuid ?? crypto.randomUUID.bind(crypto))();

  try {
    const existing = await findEntry(env.DB, payload.email);
    if (existing) {
      return jsonResponse({ ok: true, status: "already_joined" }, 200);
    }

    try {
      await insertEntry(env.DB, entryId, payload.email, now, payload.attribution);
      return jsonResponse({ ok: true, status: "joined" }, 201);
    } catch (error) {
      if (isExpectedD1Conflict(error)) {
        return jsonResponse({ ok: true, status: "already_joined" }, 200);
      }
      throw error;
    }
  } catch {
    return jsonResponse(TEMPORARILY_UNAVAILABLE, 503);
  }
}

async function findEntry(db: D1Database, email: string): Promise<{ id: string } | null> {
  return db
    .prepare("SELECT id FROM waitlist_entries WHERE email_normalized = ?")
    .bind(email)
    .first<{ id: string }>();
}

async function insertEntry(
  db: D1Database,
  entryId: string,
  email: string,
  now: string,
  attribution: Attribution | undefined,
) {
  await db
    .prepare(
      `INSERT INTO waitlist_entries (
        id, email_normalized, joined_at, approved_at,
        wallet_address, joined_message, joined_signature,
        source, medium, campaign, referral_code, referrer_host
      ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entryId,
      email,
      now,
      attribution?.source ?? null,
      attribution?.medium ?? null,
      attribution?.campaign ?? null,
      attribution?.referralCode ?? null,
      attribution?.referrerHost ?? null,
    )
    .run();
}

function jsonResponse(body: WaitlistResponse, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function isExpectedD1Conflict(error: unknown): boolean {
  return error instanceof Error && /constraint|unique/i.test(error.message);
}
