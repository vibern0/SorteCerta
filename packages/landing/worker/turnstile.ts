export type TurnstileOutcome = "verified" | "rejected" | "unavailable";

export type TurnstileInput = {
  secret: string;
  token: string;
  requestId: string;
};

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 8_000;

export async function verifyTurnstile(input: TurnstileInput, fetcher: Fetcher = fetch): Promise<TurnstileOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const form = new FormData();
    form.set("secret", input.secret);
    form.set("response", input.token);
    form.set("idempotency_key", input.requestId);

    const response = await fetcher(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      return "unavailable";
    }

    const parsed: unknown = await response.json();
    if (!isSiteverifyResponse(parsed)) {
      return "unavailable";
    }

    return parsed.success ? "verified" : "rejected";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
}

function isSiteverifyResponse(value: unknown): value is { success: boolean } {
  return typeof value === "object" && value !== null && "success" in value && typeof value.success === "boolean";
}
