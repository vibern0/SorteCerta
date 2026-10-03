export type WaitlistJoinResult = { ok: true; status: "joined" | "already_joined" };

export type AccessClaimResult =
  | { ok: true; status: "approved" }
  | { ok: false; status: "pending" | "claimed" | "invalid_request" };

export type AccessStatusResult =
  | { ok: true; status: "approved" }
  | { ok: false; status: "pending" | "invalid_request" };

export const JOINED_MESSAGE = "i've joined";

type D1StatementLike = {
  bind(...values: unknown[]): D1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
};

type D1Like = {
  prepare(sql: string): D1StatementLike;
};

type WaitlistRow = {
  email_normalized: string;
  approved_at: string | null;
  wallet_address: string | null;
  joined_signature: string | null;
  joined_message: string | null;
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length > 0 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function registerWaitlistInterest(
  db: D1Like,
  emailInput: string,
  uuid: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): Promise<WaitlistJoinResult> {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) {
    throw new Error("invalid_email");
  }

  const existing = await findWaitlistRow(db, email);
  if (existing) {
    return { ok: true, status: "already_joined" };
  }

  try {
    await db
      .prepare(
        `INSERT INTO waitlist_entries (
          id, email_normalized, joined_at, approved_at,
          wallet_address, joined_message, joined_signature
        ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL)`,
      )
      .bind(uuid(), email, now())
      .run();
    return { ok: true, status: "joined" };
  } catch (error) {
    if (isConflict(error)) {
      return { ok: true, status: "already_joined" };
    }
    throw error;
  }
}

export async function claimApprovedAccess(
  db: D1Like,
  emailInput: string,
  walletAddress: string,
  signature: string,
): Promise<AccessClaimResult> {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email) || walletAddress.trim() === "" || signature.trim() === "") {
    return { ok: false, status: "invalid_request" };
  }

  const row = await findWaitlistRow(db, email);
  if (!row?.approved_at) {
    return { ok: false, status: "pending" };
  }

  if (row.joined_signature) {
    return row.wallet_address === walletAddress && row.joined_signature === signature
      ? { ok: true, status: "approved" }
      : { ok: false, status: "claimed" };
  }

  await db
    .prepare(
      `UPDATE waitlist_entries
      SET wallet_address = ?, joined_signature = ?, joined_message = ?
      WHERE email_normalized = ? AND approved_at IS NOT NULL AND joined_signature IS NULL`,
    )
    .bind(walletAddress, signature, JOINED_MESSAGE, email)
    .run();

  const updated = await findWaitlistRow(db, email);
  return updated?.wallet_address === walletAddress && updated.joined_signature === signature
    ? { ok: true, status: "approved" }
    : { ok: false, status: "claimed" };
}

export async function readAccessStatus(db: D1Like, emailInput: string): Promise<AccessStatusResult> {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) {
    return { ok: false, status: "invalid_request" };
  }
  const row = await findWaitlistRow(db, email);
  return row?.approved_at ? { ok: true, status: "approved" } : { ok: false, status: "pending" };
}

async function findWaitlistRow(db: D1Like, email: string): Promise<WaitlistRow | null> {
  return db
    .prepare(
      `SELECT
        email_normalized,
        approved_at,
        wallet_address,
        joined_signature,
        joined_message
      FROM waitlist_entries
      WHERE email_normalized = ?`,
    )
    .bind(email)
    .first<WaitlistRow>();
}

function isConflict(error: unknown): boolean {
  return error instanceof Error && /constraint|unique/i.test(error.message);
}
