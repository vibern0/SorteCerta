import type { Attribution, WaitlistRequest, WaitlistResponse } from "./types";

export type PublicErrorCode = Extract<WaitlistResponse, { ok: false }>["code"];

export class PublicError extends Error {
  readonly status: number;
  readonly code: PublicErrorCode;

  constructor(status: number, code: PublicErrorCode, message: string) {
    super(message);
    this.name = "PublicError";
    this.status = status;
    this.code = code;
  }
}

const BODY_LIMIT_BYTES = 8_192;
const EMAIL_LIMIT = 254;
const INVITATION_CODE_LIMIT = 128;
const TURNSTILE_TOKEN_LIMIT = 2_048;
const ATTRIBUTION_FIELD_LIMIT = 128;
const INVALID_REQUEST_MESSAGE = "We could not accept this request.";

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeInvitationCode(value: string): string {
  return value
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase()
    .replace(/^SC/, "SC-");
}

export async function hashInvitationCode(code: string): Promise<string> {
  const normalized = normalizeInvitationCode(code);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function parseWaitlistRequest(request: Request): Promise<WaitlistRequest> {
  assertJson(request);
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > BODY_LIMIT_BYTES) {
    throw invalidRequest();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readLimitedBody(request));
  } catch {
    throw invalidRequest();
  }

  if (!isRecord(parsed)) {
    throw invalidRequest();
  }

  const email = readRequiredString(parsed.email, EMAIL_LIMIT);
  const invitationCode = readRequiredString(parsed.invitationCode, INVITATION_CODE_LIMIT);
  const turnstileToken = readRequiredString(parsed.turnstileToken, TURNSTILE_TOKEN_LIMIT).trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedInvitationCode = normalizeInvitationCode(invitationCode);

  if (!isValidEmail(normalizedEmail) || normalizedInvitationCode.length === 0 || turnstileToken.length === 0) {
    throw invalidRequest();
  }

  const attribution = parseAttribution(parsed.attribution);
  return {
    email: normalizedEmail,
    invitationCode: normalizedInvitationCode,
    turnstileToken,
    ...(Object.keys(attribution).length > 0 ? { attribution } : {}),
  };
}

function assertJson(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType?.split(";").map((part) => part.trim()).includes("application/json")) {
    throw invalidRequest();
  }
}

async function readLimitedBody(request: Request): Promise<string> {
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > BODY_LIMIT_BYTES) {
      throw invalidRequest();
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(buffer);
}

function parseAttribution(value: unknown): Attribution {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw invalidRequest();
  }

  return {
    ...readOptionalAttribution(value.source, "source"),
    ...readOptionalAttribution(value.medium, "medium"),
    ...readOptionalAttribution(value.campaign, "campaign"),
    ...readOptionalAttribution(value.referralCode, "referralCode"),
    ...readOptionalAttribution(value.referrerHost, "referrerHost"),
  };
}

function readOptionalAttribution<T extends keyof Attribution>(value: unknown, key: T): Pick<Attribution, T> | {} {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "string") {
    throw invalidRequest();
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > ATTRIBUTION_FIELD_LIMIT) {
    return {};
  }
  return { [key]: trimmed } as Pick<Attribution, T>;
}

function readRequiredString(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw invalidRequest();
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidEmail(value: string): boolean {
  return value.length > 0 && value.length <= EMAIL_LIMIT && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function invalidRequest(): PublicError {
  return new PublicError(400, "invalid_request", INVALID_REQUEST_MESSAGE);
}
