import { createExecutionContext, env } from "cloudflare:test";
import { vi, type MockedFunction } from "vitest";
import type { Env, WaitlistRequest } from "../worker/types";
import type { TurnstileOutcome } from "../worker/turnstile";
import type { WaitlistDependencies } from "../worker/waitlist";

let uuidIndex = 0;

type RequestOverrides = {
  body?: unknown;
  contentType?: string;
  turnstileToken?: string;
  attribution?: WaitlistRequest["attribution"];
};

export function makeRequest(email: string, invitationCode: string, overrides: RequestOverrides = {}): Request {
  const body =
    overrides.body ??
    ({
      email,
      invitationCode,
      turnstileToken: overrides.turnstileToken ?? "turnstile-token",
      ...(overrides.attribution ? { attribution: overrides.attribution } : {}),
    } satisfies WaitlistRequest);

  return new Request("https://sortecerta.com/api/waitlist", {
    method: "POST",
    headers: { "content-type": overrides.contentType ?? "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function fixedDependencies(
  turnstileOutcome: TurnstileOutcome,
  overrides: Partial<WaitlistDependencies> = {},
): TestDependencies {
  const verifier = vi.fn(async () => turnstileOutcome) as MockedFunction<
    NonNullable<WaitlistDependencies["verifyTurnstile"]>
  >;
  const dependencies: TestDependencies = {
    verifyTurnstile: verifier,
    now: () => "2026-09-25T12:00:00.000Z",
    uuid: () => `00000000-0000-4000-8000-${String(++uuidIndex).padStart(12, "0")}`,
  };
  return {
    ...dependencies,
    ...overrides,
  } as TestDependencies;
}

export function makeEnv(assetsFetcher = async () => new Response("asset")): Env {
  return {
    ...env,
    ASSETS: { fetch: assetsFetcher },
    TURNSTILE_SECRET_KEY: "test-secret",
  } as Env;
}

export function makeContext(): ExecutionContext {
  return createExecutionContext();
}

type TestDependencies = Required<WaitlistDependencies> & {
  verifyTurnstile: MockedFunction<NonNullable<WaitlistDependencies["verifyTurnstile"]>>;
};
