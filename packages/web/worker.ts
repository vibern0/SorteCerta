import {
  JOINED_MESSAGE,
  claimApprovedAccess,
  isValidEmail,
  normalizeEmail,
  readAccessStatus,
  registerWaitlistInterest,
} from "./worker/access";

type D1StatementLike = {
  bind(...values: unknown[]): D1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
};

type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  DB: {
    prepare(sql: string): D1StatementLike;
  };
  NEXT_PUBLIC_CHAIN_ID?: string;
  NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS?: string;
  NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS?: string;
  NEXT_PUBLIC_PIMLICO_API_KEY?: string;
  NEXT_PUBLIC_RPC_URL?: string;
  NEXT_PUBLIC_USDC_ADDRESS?: string;
  NEXT_PUBLIC_WEB3AUTH_CLIENT_ID?: string;
};

const PUBLIC_KEYS = [
  "NEXT_PUBLIC_CHAIN_ID",
  "NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS",
  "NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS",
  "NEXT_PUBLIC_PIMLICO_API_KEY",
  "NEXT_PUBLIC_RPC_URL",
  "NEXT_PUBLIC_USDC_ADDRESS",
  "NEXT_PUBLIC_WEB3AUTH_CLIENT_ID",
] as const;

function runtimeConfig(env: Env): Record<string, string> {
  return Object.fromEntries(
    PUBLIC_KEYS.map((key) => [key, env[key] ?? ""]),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/config.js") {
      return new Response(
        `window.__SORTE_CERTA_CONFIG__ = ${JSON.stringify(runtimeConfig(env))};\n`,
        {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      );
    }

    if (url.pathname === "/api/waitlist" && request.method === "POST") {
      return handleWaitlist(request, env);
    }

    if (url.pathname === "/api/access/claim" && request.method === "POST") {
      return handleAccessClaim(request, env);
    }

    if (url.pathname === "/api/access/status" && request.method === "POST") {
      return handleAccessStatus(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, status: "invalid_request" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleWaitlist(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const email = typeof body.email === "string" ? body.email : "";
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      return json({ ok: false, status: "invalid_request" }, 400);
    }
    return json(await registerWaitlistInterest(env.DB, normalized), 200);
  } catch {
    return json({ ok: false, status: "temporarily_unavailable" }, 503);
  }
}

async function handleAccessStatus(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const email = typeof body.email === "string" ? body.email : "";
    const result = await readAccessStatus(env.DB, email);
    return json(result, result.status === "invalid_request" ? 400 : 200);
  } catch {
    return json({ ok: false, status: "temporarily_unavailable" }, 503);
  }
}

async function handleAccessClaim(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const email = typeof body.email === "string" ? body.email : "";
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : "";
    const signature = typeof body.signature === "string" ? body.signature : "";
    const result = await claimApprovedAccess(env.DB, email, walletAddress, signature);
    return json({ ...result, message: JOINED_MESSAGE }, result.ok ? 200 : result.status === "invalid_request" ? 400 : 403);
  } catch {
    return json({ ok: false, status: "temporarily_unavailable" }, 503);
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.split(";").map((part) => part.trim()).includes("application/json")) {
    throw new Error("invalid_content_type");
  }
  const parsed = await request.json();
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("invalid_body");
  }
  return parsed as Record<string, unknown>;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
