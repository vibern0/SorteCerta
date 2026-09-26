import type { Attribution, WaitlistRequest, WaitlistResponse } from "../../worker/types";

type SubmitInput = {
  email: string;
  invitationCode: string;
  turnstileToken: string;
  attribution?: Attribution;
};

type Fetcher = typeof fetch;

const TEMPORARY_ERROR: WaitlistResponse = {
  ok: false,
  code: "temporarily_unavailable",
  message: "We could not join the waitlist right now. Please try again.",
};

const ERROR_CODES = new Set([
  "invalid_request",
  "invalid_invitation",
  "verification_failed",
  "temporarily_unavailable",
]);

export async function submitWaitlist(input: SubmitInput, fetcher: Fetcher = fetch): Promise<WaitlistResponse> {
  const payload: WaitlistRequest = {
    email: input.email,
    invitationCode: input.invitationCode,
    turnstileToken: input.turnstileToken,
    ...(input.attribution !== undefined && Object.keys(input.attribution).length > 0 ? { attribution: input.attribution } : {}),
  };

  try {
    const response = await fetcher("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readPublicResponse(await response.json());
  } catch {
    return TEMPORARY_ERROR;
  }
}

function readPublicResponse(value: unknown): WaitlistResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return TEMPORARY_ERROR;
  }

  if (value.ok) {
    return value.status === "joined" || value.status === "already_joined"
      ? { ok: true, status: value.status }
      : TEMPORARY_ERROR;
  }

  if (typeof value.code === "string" && ERROR_CODES.has(value.code) && typeof value.message === "string") {
    return {
      ok: false,
      code: value.code as Extract<WaitlistResponse, { ok: false }>["code"],
      message: value.message,
    };
  }

  return TEMPORARY_ERROR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
