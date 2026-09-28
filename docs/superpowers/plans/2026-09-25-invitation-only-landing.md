# Invitation-Only Landing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independently deployable SorteCerta marketing site whose same-origin Cloudflare Worker admits only valid, email-bound, single-use invitations to a D1-backed waitlist.

**Architecture:** A Vite React bundle supplies the public page and form. A native Worker routes `/api/waitlist`, verifies Turnstile, atomically redeems invitations in D1, and delegates every other request to the `ASSETS` binding. Browser, domain, persistence, and operator concerns stay in focused modules with typed interfaces.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Cloudflare Workers Static Assets, D1, Turnstile, Wrangler, Node cryptography.

**Spec:** `docs/superpowers/specs/2026-09-25-invitation-only-landing-design.md`

## Global Constraints

- Create only the independent `packages/landing` workspace plus additive root scripts; do not modify the behavior or styling of `packages/web`, contracts, keeper, protocol, or Morpho lab.
- Use a fixed dark theme with the approved graphite, teal, plum, and warm-accent direction; support 320px through large desktop widths without horizontal scrolling.
- User-facing copy must follow the issue's prize-first hierarchy, describe eligibility only at the end of a draw, avoid guaranteed winnings or yield, and contain no fabricated live metrics.
- Keep the form to approved email and invitation code; Turnstile is verification, not a third user-entered field.
- Store only normalized email and SHA-256 invitation-code hashes; never store or log plaintext codes, Turnstile tokens, IP addresses, user agents, or full referrer URLs.
- Verify Turnstile before D1 mutation and make redemption replay-safe under concurrent requests through a D1 batch plus uniqueness constraints.
- Keep the API same-origin, require JSON, reject bodies over 8 KiB, cap every string, return only the documented public response vocabulary, and set `Cache-Control: no-store`.
- Normalize email with `trim().toLowerCase()` and invitation codes by trimming, removing separator whitespace, and uppercasing before hashing.
- Generate invitation codes from 16 random bytes (128 bits), exceeding the 100-bit minimum, and print the plaintext value exactly once only after successful insertion.
- Use checksum address rules from `AGENTS.md` if any address handling is introduced; this feature is expected to introduce none.
- Do not invent Cloudflare account identifiers or secrets. Use a zero UUID for local D1 configuration and document the owner-operated production replacement.

## Review Focus

- A request with a valid code but a different email must fail with the same `invalid_invitation` response as unknown, expired, or redeemed codes; Task 5 exercises this.
- Two simultaneous requests for the same invitation must yield one `joined` result and one `already_joined` result without two rows; Task 5 exercises this against isolated D1.
- A forged browser `Origin` or non-JSON request must be rejected before Turnstile or D1 calls; Task 6 exercises call order through real routing and injected boundaries.
- Attribution with malformed URLs, oversized values, or unknown query keys must be narrowed rather than crash or persist extra data; Task 7 exercises this.
- A Siteverify network error or malformed response must preserve form values, discard the token, and surface only a temporary public error; Tasks 4 and 8 exercise both server and client behavior.

---

### Task 1: Scaffold the independent workspace

**Files:**
- Create: `packages/landing/package.json`
- Create: `packages/landing/tsconfig.json`
- Create: `packages/landing/vite.config.ts`
- Create: `packages/landing/vitest.worker.config.ts`
- Create: `packages/landing/wrangler.jsonc`
- Create: `packages/landing/.dev.vars.example`
- Create: `packages/landing/index.html`
- Create: `packages/landing/src/env.d.ts`
- Create: `packages/landing/src/main.tsx`
- Create: `packages/landing/src/App.tsx`
- Create: `packages/landing/tests/app-shell.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: root `packages/*` workspace discovery.
- Produces: package scripts `dev`, `build`, `typecheck`, `test`, and `test:worker`; Worker bindings `DB`, `ASSETS`, `TURNSTILE_SECRET_KEY`; public build variable `VITE_TURNSTILE_SITE_KEY`.

- [ ] **Step 1: Add the shell test before the React shell exists**

```tsx
// packages/landing/tests/app-shell.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("landing shell", () => {
  it("renders one main region and the waitlist target", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(document.querySelector("#waitlist")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the shell test and observe the missing module failure**

Run: `npm run test --workspace @sortecerta/landing -- tests/app-shell.test.tsx`

Expected: FAIL because `packages/landing` and `src/App.tsx` do not exist.

- [ ] **Step 3: Add package configuration, root scripts, and a minimal shell**

Use this package shape so the browser and Worker suites have separate runners while `npm test` executes both:

```json
{
  "name": "@sortecerta/landing",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "npm run test:browser && npm run test:worker",
    "test:browser": "vitest run --config vite.config.ts",
    "test:worker": "vitest run --config vitest.worker.config.ts",
    "invitation:create": "node --experimental-strip-types scripts/create-invitation.mts"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@cloudflare/vitest-plugin": "^1.2.7",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/node": "^22.20.4",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "jsdom": "^30.1.1",
    "typescript": "^5.6.2",
    "vite": "^8.3.1",
    "vitest": "^4.1.11",
    "wrangler": "^4.140.0"
  }
}
```

Configure browser tests with `jsdom` and worker tests through `vitest.worker.config.ts` using `@cloudflare/vitest-plugin` and `wrangler.jsonc`.

```json
// packages/landing/wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "sortecerta-landing",
  "main": "worker/index.ts",
  "compatibility_date": "2026-09-25",
  "observability": { "enabled": true },
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"],
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "sortecerta-landing-local",
      "database_id": "00000000-0000-0000-0000-000000000000",
      "migrations_dir": "migrations"
    }
  ]
}
```

```tsx
// packages/landing/src/App.tsx
export default function App() {
  return (
    <main>
      <h1>Make your USDC feel lucky.</h1>
      <section id="waitlist" aria-labelledby="waitlist-title">
        <h2 id="waitlist-title">Join the waitlist</h2>
      </section>
    </main>
  );
}
```

Add only these root scripts:

```json
"landing:dev": "npm run dev -w @sortecerta/landing",
"landing:build": "npm run build -w @sortecerta/landing",
"landing:typecheck": "npm run typecheck -w @sortecerta/landing",
"landing:test": "npm run test -w @sortecerta/landing"
```

`.dev.vars.example` contains only:

```dotenv
TURNSTILE_SECRET_KEY=
VITE_TURNSTILE_SITE_KEY=
```

- [ ] **Step 4: Install and prove the shell**

Run:

```bash
npm install
npm run landing:typecheck
npm run test:browser --workspace @sortecerta/landing -- tests/app-shell.test.tsx
npm run landing:build
```

Expected: install exits 0; the shell test passes; typecheck and production build exit 0.

- [ ] **Step 5: Commit the scaffold**

```bash
git add package.json package-lock.json pnpm-lock.yaml packages/landing
git commit -m "feat(landing): scaffold independent worker site"
```

### Task 2: Define request types and strict validation

**Files:**
- Create: `packages/landing/worker/types.ts`
- Create: `packages/landing/worker/validation.ts`
- Create: `packages/landing/tests/validation.test.ts`

**Interfaces:**
- Consumes: standard `Request`, `crypto.subtle`.
- Produces: `WaitlistRequest`, `WaitlistResponse`, `Attribution`, `Env`, `normalizeEmail(value)`, `normalizeInvitationCode(value)`, `hashInvitationCode(code)`, and `parseWaitlistRequest(request)`.

- [ ] **Step 1: Write failing normalization and payload tests**

```ts
import { describe, expect, it } from "vitest";
import {
  hashInvitationCode,
  normalizeEmail,
  normalizeInvitationCode,
  parseWaitlistRequest,
} from "../worker/validation";

describe("waitlist validation", () => {
  it("normalizes email and invitation separators", async () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeInvitationCode(" sc-abcd efgh-ijkl ")).toBe("SC-ABCDEFGHIJKL");
    expect(await hashInvitationCode("sc-abcd efgh-ijkl")).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["text/plain", "{}", "invalid_request"],
    ["application/json", "{", "invalid_request"],
    ["application/json", JSON.stringify({ email: "bad", invitationCode: "x", turnstileToken: "t" }), "invalid_request"],
  ])("rejects invalid request data", async (contentType, body, code) => {
    const request = new Request("https://sortecerta.com/api/waitlist", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    await expect(parseWaitlistRequest(request)).rejects.toMatchObject({ code });
  });

  it("rejects a declared body larger than 8 KiB", async () => {
    const request = new Request("https://sortecerta.com/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "8193" },
      body: "{}",
    });
    await expect(parseWaitlistRequest(request)).rejects.toMatchObject({ code: "invalid_request" });
  });
});
```

- [ ] **Step 2: Run the validation tests and observe the missing module failure**

Run: `npm run test:browser --workspace @sortecerta/landing -- tests/validation.test.ts`

Expected: FAIL because `worker/validation.ts` does not exist.

- [ ] **Step 3: Implement typed parsing and fixed limits**

Define limits of 254 email characters, 128 invitation-code characters, 2,048 Turnstile-token characters, 128 characters per attribution field, and 8,192 body bytes. Read streams with an incremental byte counter when no reliable `Content-Length` is present.

```ts
export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  referralCode?: string;
  referrerHost?: string;
};

export type WaitlistRequest = {
  email: string;
  invitationCode: string;
  turnstileToken: string;
  attribution?: Attribution;
};

export type WaitlistResponse =
  | { ok: true; status: "joined" | "already_joined" }
  | { ok: false; code: "invalid_request" | "invalid_invitation" | "verification_failed" | "temporarily_unavailable"; message: string };

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeInvitationCode(value: string): string {
  return value.trim().replace(/[\s-]+/g, "").toUpperCase().replace(/^SC/, "SC-");
}
```

Return a validated object with normalized bounded attribution; throw a `PublicError` carrying `status`, `code`, and generic `message` for invalid requests. Derive the SHA-256 hex string from the normalized code with `crypto.subtle.digest`.

- [ ] **Step 4: Run the focused and package tests**

Run:

```bash
npm run test:browser --workspace @sortecerta/landing -- tests/validation.test.ts
npm run landing:typecheck
```

Expected: all validation cases pass; typecheck exits 0.

- [ ] **Step 5: Commit validation**

```bash
git add packages/landing/worker packages/landing/tests/validation.test.ts
git commit -m "feat(landing): validate waitlist requests"
```

### Task 3: Add the D1 schema and invitation issuer

**Files:**
- Create: `packages/landing/migrations/0001_waitlist.sql`
- Create: `packages/landing/scripts/invitation.ts`
- Create: `packages/landing/scripts/create-invitation.mts`
- Create: `packages/landing/tests/invitation.test.ts`
- Modify: `packages/landing/package.json`

**Interfaces:**
- Consumes: normalized email from Task 2, Node `randomBytes`, `createHash`, `spawn`.
- Produces: `generateInvitationCode()`, `hashCodeForStorage(code)`, `buildWranglerArgs(input)`, and CLI `npm run invitation:create -- --email person@example.com [--expires ISO] [--remote]`.

- [ ] **Step 1: Write failing entropy, hashing, and argument tests**

```ts
import { describe, expect, it } from "vitest";
import { buildWranglerArgs, generateInvitationCode, hashCodeForStorage } from "../scripts/invitation";

describe("invitation issuer", () => {
  it("formats 128 random bits without reducing entropy", () => {
    const code = generateInvitationCode(Buffer.alloc(16, 0xab));
    expect(code).toBe("SC-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB");
  });

  it("hashes the normalized code", () => {
    expect(hashCodeForStorage(" sc-abcd efgh ")).toHaveLength(64);
    expect(hashCodeForStorage(" sc-abcd efgh ")).toBe(hashCodeForStorage("SC-ABCDEFGH"));
  });

  it("passes SQL bindings without shell interpolation", () => {
    const args = buildWranglerArgs({
      email: "person@example.com",
      codeHash: "a".repeat(64),
      id: "invite-id",
      createdAt: "2026-09-25T12:00:00.000Z",
      expiresAt: null,
      remote: false,
    });
    expect(args).toContain("--local");
    expect(args.join(" ")).not.toContain("person@example.com');");
  });
});
```

- [ ] **Step 2: Run the issuer tests and observe the missing module failure**

Run: `npm run test:browser --workspace @sortecerta/landing -- tests/invitation.test.ts`

Expected: FAIL because `scripts/invitation.ts` does not exist.

- [ ] **Step 3: Add the migration and issuer implementation**

Use the exact two-table schema from the approved spec. Generate 16 random bytes, encode all 32 uppercase hexadecimal characters in eight four-character groups, and prefix `SC-`; the displayed code therefore retains all 128 random bits. Hash the normalized code with SHA-256. Validate the optional expiration as a future ISO timestamp.

Invoke Wrangler with `spawn(process.execPath, [wranglerBin, "d1", "execute", "sortecerta-landing-local", mode, "--command", sql], { stdio: ["ignore", "pipe", "pipe"] })`. Encode values as SQL literals with a helper that doubles single quotes; never invoke a shell. Print the code only after exit code 0, exactly once.

```sql
CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  redeemed_at TEXT
);
CREATE INDEX invitations_email_idx ON invitations(email_normalized);
CREATE TABLE waitlist_entries (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL UNIQUE,
  joined_at TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  referral_code TEXT,
  referrer_host TEXT,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);
```

- [ ] **Step 4: Apply the migration locally and run tests**

Run:

```bash
npm run test:browser --workspace @sortecerta/landing -- tests/invitation.test.ts
npm exec --workspace @sortecerta/landing wrangler d1 migrations apply sortecerta-landing-local --local
npm run landing:typecheck
```

Expected: tests pass; Wrangler applies `0001_waitlist.sql`; typecheck exits 0.

- [ ] **Step 5: Commit schema and operator tooling**

```bash
git add packages/landing/migrations packages/landing/scripts packages/landing/tests/invitation.test.ts packages/landing/package.json package-lock.json pnpm-lock.yaml
git commit -m "feat(landing): add invitation issuance"
```

### Task 4: Implement the Turnstile boundary

**Files:**
- Create: `packages/landing/worker/turnstile.ts`
- Create: `packages/landing/tests/turnstile.test.ts`

**Interfaces:**
- Consumes: secret key, token, request ID, injected `fetch`.
- Produces: `verifyTurnstile(input, fetcher): Promise<"verified" | "rejected" | "unavailable">`.

- [ ] **Step 1: Write failing boundary tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../worker/turnstile";

describe("Turnstile verification", () => {
  it("posts secret and token to Siteverify without an IP address", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("secret")).toBe("secret");
      expect(form.get("response")).toBe("token");
      expect(form.has("remoteip")).toBe(false);
      return Response.json({ success: true });
    });
    await expect(verifyTurnstile({ secret: "secret", token: "token", requestId: "request-id" }, fetcher)).resolves.toBe("verified");
  });

  it.each([
    [Response.json({ success: false }), "rejected"],
    [new Response("bad gateway", { status: 502 }), "unavailable"],
  ])("maps Siteverify outcomes", async (response, outcome) => {
    await expect(verifyTurnstile({ secret: "secret", token: "token", requestId: "request-id" }, async () => response)).resolves.toBe(outcome);
  });
});
```

- [ ] **Step 2: Run the tests and observe the missing module failure**

Run: `npm run test:browser --workspace @sortecerta/landing -- tests/turnstile.test.ts`

Expected: FAIL because `worker/turnstile.ts` does not exist.

- [ ] **Step 3: Implement Siteverify with timeout and idempotency**

POST `FormData` to `https://challenges.cloudflare.com/turnstile/v0/siteverify`, include `secret`, `response`, and `idempotency_key` equal to the request ID, omit `remoteip`, abort after 8 seconds, and parse only an object with boolean `success`. Map explicit verification failure to `rejected`; map transport, timeout, non-2xx, and malformed JSON to `unavailable`. Never log input values.

- [ ] **Step 4: Run Turnstile and type tests**

Run:

```bash
npm run test:browser --workspace @sortecerta/landing -- tests/turnstile.test.ts
npm run landing:typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit the boundary**

```bash
git add packages/landing/worker/turnstile.ts packages/landing/tests/turnstile.test.ts
git commit -m "feat(landing): verify Turnstile server-side"
```

### Task 5: Implement atomic waitlist registration against isolated D1

**Files:**
- Create: `packages/landing/worker/waitlist.ts`
- Create: `packages/landing/tests/worker.setup.ts`
- Create: `packages/landing/tests/helpers.ts`
- Create: `packages/landing/tests/waitlist-worker.test.ts`
- Modify: `packages/landing/vitest.worker.config.ts`

**Interfaces:**
- Consumes: `D1Database`, validated payload, normalized code hash, injected Turnstile verifier, current time, UUID factory.
- Produces: `registerWaitlist(request, env, dependencies): Promise<Response>`.

- [ ] **Step 1: Configure isolated D1 and write failing lifecycle tests**

Load migrations with the Cloudflare Vitest integration's `readD1Migrations` and apply them in `tests/worker.setup.ts` with `applyD1Migrations(env.DB, migrations)`. Use isolated storage per test.

`tests/helpers.ts` defines `makeRequest(email, code, overrides?)`, `fixedDependencies(turnstileOutcome)`, `makeEnv(assetsFetcher?)`, and `makeContext()` with complete request, dependency, binding, and execution-context shapes. These helpers remain test-only.

```ts
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerWaitlist } from "../worker/waitlist";
import { hashInvitationCode } from "../worker/validation";

async function seed(email: string, code: string, expiresAt: string | null = null) {
  await env.DB.prepare("INSERT INTO invitations VALUES (?, ?, ?, ?, ?, NULL)")
    .bind(crypto.randomUUID(), email, await hashInvitationCode(code), "2026-09-25T10:00:00.000Z", expiresAt)
    .run();
}

describe("waitlist registration", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM waitlist_entries; DELETE FROM invitations;");
  });

  it("joins once and returns idempotent success for the same pair", async () => {
    await seed("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP");
    const request = makeRequest("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP");
    const dependencies = fixedDependencies("verified");
    expect((await registerWaitlist(request, env, dependencies)).status).toBe(201);
    expect((await registerWaitlist(makeRequest("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP"), env, dependencies)).status).toBe(200);
    expect((await env.DB.prepare("SELECT COUNT(*) count FROM waitlist_entries").first<{ count: number }>())?.count).toBe(1);
  });

  it.each([
    ["other@example.com", "SC-ABCD-EFGH-IJKL-MNOP"],
    ["person@example.com", "SC-RANDOM-CODE-VALUE"],
  ])("uses one response for invalid invitation states", async (email, code) => {
    await seed("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP");
    const response = await registerWaitlist(makeRequest(email, code), env, fixedDependencies("verified"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, code: "invalid_invitation", message: "This invitation could not be accepted." });
  });

  it("allows only one row under concurrent submissions", async () => {
    await seed("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP");
    const responses = await Promise.all([
      registerWaitlist(makeRequest("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP"), env, fixedDependencies("verified")),
      registerWaitlist(makeRequest("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP"), env, fixedDependencies("verified")),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
  });
});
```

Add cases for expired, already-redeemed by another identity, failed Turnstile, unavailable Turnstile, malformed request, and forced D1 failure. Assert Turnstile failure leaves both tables unchanged.

- [ ] **Step 2: Run isolated-D1 tests and observe the missing use case**

Run: `npm run test:worker --workspace @sortecerta/landing -- tests/waitlist-worker.test.ts`

Expected: FAIL because `worker/waitlist.ts` does not exist.

- [ ] **Step 3: Implement registration and race reconciliation**

Parse first, verify Turnstile second, then compute the hash. Query by `code_hash` only to distinguish idempotent repeats without exposing details. If an existing waitlist row joins the invitation and normalized email, return `already_joined`. Otherwise require matching email, no redemption timestamp, and no expiry before executing a D1 batch containing:

```sql
UPDATE invitations
SET redeemed_at = ?
WHERE id = ? AND redeemed_at IS NULL AND (expires_at IS NULL OR expires_at > ?);

INSERT INTO waitlist_entries (
  id, invitation_id, email_normalized, joined_at,
  source, medium, campaign, referral_code, referrer_host
) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
WHERE changes() = 1;
```

After the batch, confirm the inserted row. On a uniqueness or lost-race error, re-read the invitation-entry join: return `already_joined` only when both email and hash identify the completed pair; otherwise return the generic 403. Map other D1 failures to `temporarily_unavailable`. Use fixed generic messages and `Cache-Control: no-store` for every response.

- [ ] **Step 4: Run focused worker tests and all landing tests**

Run:

```bash
npm run test:worker --workspace @sortecerta/landing -- tests/waitlist-worker.test.ts
npm run landing:test
npm run landing:typecheck
```

Expected: isolated-D1 lifecycle tests, browser-unit tests, and typecheck all pass.

- [ ] **Step 5: Commit registration**

```bash
git add packages/landing/worker/waitlist.ts packages/landing/tests packages/landing/vitest.worker.config.ts
git commit -m "feat(landing): redeem invitations atomically"
```

### Task 6: Add Worker routing and security headers

**Files:**
- Create: `packages/landing/worker/index.ts`
- Create: `packages/landing/worker/security.ts`
- Create: `packages/landing/tests/worker-routing.test.ts`
- Create: `packages/landing/tests/security-privacy.test.ts`

**Interfaces:**
- Consumes: `registerWaitlist`, `Env.ASSETS.fetch`, request origin.
- Produces: default Worker `{ fetch(request, env, context): Promise<Response> }`, `withSecurityHeaders(response, kind)`.

- [ ] **Step 1: Write failing routing and header tests**

```ts
import worker from "../worker/index";
import { describe, expect, it, vi } from "vitest";

describe("Worker routing", () => {
  it("rejects cross-origin API submissions", async () => {
    const response = await worker.fetch(new Request("https://sortecerta.com/api/waitlist", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: "{}",
    }), makeEnv(), makeContext());
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 405 for GET on the waitlist endpoint", async () => {
    const response = await worker.fetch(new Request("https://sortecerta.com/api/waitlist"), makeEnv(), makeContext());
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("delegates pages to Assets and applies document headers", async () => {
    const assets = vi.fn(async () => new Response("<html></html>", { headers: { "content-type": "text/html" } }));
    const response = await worker.fetch(new Request("https://sortecerta.com/"), makeEnv(assets), makeContext());
    expect(assets).toHaveBeenCalledOnce();
    expect(response.headers.get("content-security-policy")).toContain("challenges.cloudflare.com");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
```

In `security-privacy.test.ts`, stub Siteverify to reject the submitted token,
call the real Worker with `env.DB`, and assert the resulting log output contains
none of the submitted email, invitation code, or token:

```ts
import { env } from "cloudflare:test";
import { expect, it, vi } from "vitest";
import worker from "../worker/index";
import { makeContext, makeRequest } from "./helpers";

it("never logs submitted secrets or identity", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: false })));
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const response = await worker.fetch(
    makeRequest("person@example.com", "SC-ABCD-EFGH-IJKL-MNOP", { turnstileToken: "secret-token" }),
    { ...env, TURNSTILE_SECRET_KEY: "test-secret" },
    makeContext(),
  );
  expect(response.status).toBe(422);
  const output = JSON.stringify(log.mock.calls);
  expect(output).not.toContain("person@example.com");
  expect(output).not.toContain("SC-ABCD-EFGH-IJKL-MNOP");
  expect(output).not.toContain("secret-token");
});
```

- [ ] **Step 2: Run routing tests and observe the missing Worker failure**

Run: `npm run test:worker --workspace @sortecerta/landing -- tests/worker-routing.test.ts`

Expected: FAIL because `worker/index.ts` does not exist.

- [ ] **Step 3: Implement route ownership and response hardening**

Accept `POST` only at exact path `/api/waitlist`. For browser submissions, require `Origin` to equal `new URL(request.url).origin`; permit an absent Origin only in non-browser operator/test contexts when `Sec-Fetch-Site` is also absent. Return JSON 404 for unknown `/api/*` routes. Delegate everything else to `ASSETS.fetch`.

Apply document headers:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Log one JSON object after API completion with `requestId`, `outcome`, and `durationMs`; do not include request bodies, headers, or exception messages.

- [ ] **Step 4: Run routing, worker, and type checks**

Run:

```bash
npm run test:worker --workspace @sortecerta/landing -- tests/worker-routing.test.ts tests/security-privacy.test.ts
npm run test:worker --workspace @sortecerta/landing
npm run landing:typecheck
```

Expected: all Worker tests and typecheck pass.

- [ ] **Step 5: Commit routing**

```bash
git add packages/landing/worker packages/landing/tests/worker-routing.test.ts packages/landing/tests/security-privacy.test.ts
git commit -m "feat(landing): route and harden worker responses"
```

### Task 7: Capture narrow attribution and map the browser API

**Files:**
- Create: `packages/landing/src/lib/attribution.ts`
- Create: `packages/landing/src/lib/waitlist-client.ts`
- Create: `packages/landing/tests/attribution.test.ts`
- Create: `packages/landing/tests/waitlist-client.test.ts`

**Interfaces:**
- Consumes: `URL`, document referrer, browser `fetch`.
- Produces: `captureAttribution(url, referrer): Attribution`, `submitWaitlist(input, fetcher): Promise<WaitlistResponse>`.

- [ ] **Step 1: Write failing attribution and response-mapping tests**

```ts
import { describe, expect, it } from "vitest";
import { captureAttribution } from "../src/lib/attribution";

it("captures only approved attribution and only a referrer hostname", () => {
  expect(captureAttribution(
    new URL("https://sortecerta.com/?utm_source=zama&utm_medium=post&utm_campaign=launch&ref=friend&secret=drop"),
    "https://community.example/path?email=hidden",
  )).toEqual({
    source: "zama",
    medium: "post",
    campaign: "launch",
    referralCode: "friend",
    referrerHost: "community.example",
  });
});

it("drops malformed and oversized attribution values", () => {
  expect(captureAttribution(new URL(`https://sortecerta.com/?utm_source=${"x".repeat(129)}`), "not a url")).toEqual({});
});
```

Test `submitWaitlist` with literal 201, 200, 403, 422, and 503 JSON responses. Assert exact request keys, same-origin `/api/waitlist`, JSON content type, and mapping of invalid/non-JSON responses to `temporarily_unavailable`.

- [ ] **Step 2: Run client tests and observe missing modules**

Run: `npm run test:browser --workspace @sortecerta/landing -- tests/attribution.test.ts tests/waitlist-client.test.ts`

Expected: FAIL because both client modules are missing.

- [ ] **Step 3: Implement allowlisted capture and defensive API mapping**

Read only `utm_source`, `utm_medium`, `utm_campaign`, and `ref`; trim values, keep only nonempty strings up to 128 characters, and parse the referrer in a `try` block. `submitWaitlist` sends exactly `email`, `invitationCode`, `turnstileToken`, and nonempty attribution. It trusts a response only when its shape matches `WaitlistResponse`; every other outcome becomes the public temporary-error object.

- [ ] **Step 4: Run client tests and typecheck**

Run:

```bash
npm run test:browser --workspace @sortecerta/landing -- tests/attribution.test.ts tests/waitlist-client.test.ts
npm run landing:typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit client libraries**

```bash
git add packages/landing/src/lib packages/landing/tests/attribution.test.ts packages/landing/tests/waitlist-client.test.ts
git commit -m "feat(landing): capture waitlist attribution"
```

### Task 8: Build the accessible Turnstile waitlist form

**Files:**
- Create: `packages/landing/src/components/TurnstileWidget.tsx`
- Create: `packages/landing/src/components/WaitlistForm.tsx`
- Create: `packages/landing/tests/waitlist-form.test.tsx`

**Interfaces:**
- Consumes: `submitWaitlist`, `captureAttribution`, `VITE_TURNSTILE_SITE_KEY`, global `turnstile.render/reset/remove`.
- Produces: `<WaitlistForm />` with idle, verification-ready, submitting, joined, already-joined, invalid-invitation, verification-failed, and temporary-error states.

- [ ] **Step 1: Write failing form behavior tests**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WaitlistForm } from "../src/components/WaitlistForm";

it("submits once, announces success, and clears sensitive form state", async () => {
  const submit = vi.fn(async () => ({ ok: true, status: "joined" as const }));
  render(<WaitlistForm submit={submit} initialAttribution={{ source: "zama" }} turnstileToken="verified-token" />);
  await userEvent.type(screen.getByLabelText(/approved email/i), "person@example.com");
  await userEvent.type(screen.getByLabelText(/invitation code/i), "SC-ABCD-EFGH-IJKL-MNOP");
  await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));
  expect(submit).toHaveBeenCalledOnce();
  expect(await screen.findByRole("status")).toHaveTextContent(/you.re on the list/i);
  expect(screen.queryByDisplayValue("SC-ABCD-EFGH-IJKL-MNOP")).toBeNull();
});

it("preserves fields but resets verification after a temporary failure", async () => {
  const reset = vi.fn();
  render(<WaitlistForm submit={async () => ({ ok: false, code: "temporarily_unavailable", message: "Please try again." })} resetTurnstile={reset} turnstileToken="verified-token" />);
  await userEvent.type(screen.getByLabelText(/approved email/i), "person@example.com");
  await userEvent.type(screen.getByLabelText(/invitation code/i), "SC-ABCD-EFGH-IJKL-MNOP");
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(reset).toHaveBeenCalledOnce());
  expect(screen.getByLabelText(/approved email/i)).toHaveValue("person@example.com");
  expect(screen.getByLabelText(/invitation code/i)).toHaveValue("SC-ABCD-EFGH-IJKL-MNOP");
});
```

Add tests that the submit button remains disabled without a token and while pending, generic invitation errors do not identify the failed check, and status focus moves after completion.

- [ ] **Step 2: Run form tests and observe missing components**

Run: `npm run test:browser --workspace @sortecerta/landing -- tests/waitlist-form.test.tsx`

Expected: FAIL because `WaitlistForm.tsx` does not exist.

- [ ] **Step 3: Implement explicit Turnstile lifecycle and form state**

Load `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once with `async` and `defer`. Render the widget with the site key, set the token only through the success callback, clear it on expiry/error, remove the widget on unmount, and expose `reset()`.

Use semantic labels, `autocomplete="email"`, `aria-describedby`, a pending button label, and a focusable `role="status"` region with `aria-live="polite"`. Disable submission until both fields and a token exist. Clear both fields after success; retain them after failure; always clear/reset the token after failure.

- [ ] **Step 4: Run form and accessibility-oriented tests**

Run:

```bash
npm run test:browser --workspace @sortecerta/landing -- tests/waitlist-form.test.tsx
npm run landing:test
npm run landing:typecheck
```

Expected: form tests, all browser tests, and typecheck pass.

- [ ] **Step 5: Commit the form**

```bash
git add packages/landing/src/components packages/landing/tests/waitlist-form.test.tsx
git commit -m "feat(landing): add invitation waitlist form"
```

### Task 9: Build the prize-first marketing page and visual system

**Files:**
- Create: `packages/landing/src/components/Header.tsx`
- Create: `packages/landing/src/components/Hero.tsx`
- Create: `packages/landing/src/components/HowItWorks.tsx`
- Create: `packages/landing/src/components/TrustSection.tsx`
- Create: `packages/landing/src/components/Footer.tsx`
- Create: `packages/landing/src/styles/tokens.css`
- Create: `packages/landing/src/styles/global.css`
- Create: `packages/landing/public/favicon.svg`
- Create: `packages/landing/public/og-image.png`
- Create: `packages/landing/tests/page-content.test.tsx`
- Modify: `packages/landing/src/App.tsx`
- Modify: `packages/landing/src/main.tsx`
- Modify: `packages/landing/index.html`

**Interfaces:**
- Consumes: `<WaitlistForm />` and approved page copy.
- Produces: one semantic responsive page with `#how-it-works`, `#why-sortecerta`, and `#waitlist` targets.

- [ ] **Step 1: Write failing semantic and copy tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("marketing page", () => {
  it("uses the prize-first hierarchy and working CTA targets", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Make your USDC feel lucky." })).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /join the waitlist/i }) as HTMLAnchorElement[];
    expect(links.every((link) => link.hash === "#waitlist")).toBe(true);
    expect(document.querySelector("#how-it-works")).not.toBeNull();
    expect(document.querySelector("#why-sortecerta")).not.toBeNull();
  });

  it("does not publish fabricated or guaranteed claims", () => {
    render(<App />);
    const copy = document.body.textContent ?? "";
    expect(copy).not.toMatch(/APY|TVL|guaranteed|you won|current prize/i);
    expect(copy).not.toMatch(/testnet|Sepolia|prototype|faucet|mock|encrypted|decrypted|leakage/i);
  });
});
```

- [ ] **Step 2: Run the page test and observe missing section failures**

Run: `npm run test:browser --workspace @sortecerta/landing -- tests/page-content.test.tsx`

Expected: FAIL because the page sections and CTA links are absent.

- [ ] **Step 3: Implement semantic sections and metadata**

Keep each component responsible for one page section. The hero prize card uses labels such as “Next draw” and “Your savings set your chances” without live amounts. How It Works uses three ordered steps. Trust cards use the issue-approved headings “Privacy powered by Zama” and “Yield powered by Morpho” with one short paragraph each. Do not add legal links because no real destinations are provided.

Set title, description, canonical URL based on `VITE_SITE_URL` with `https://sortecerta.com` as the production default, theme color, favicon, and Open Graph metadata in `index.html`. Generate a purpose-built 1200×630 PNG showing the SorteCerta wordmark and abstract prize atmosphere; do not place invented metrics in the image.

- [ ] **Step 4: Implement responsive styling and reduced motion**

Define tokens for the approved palette and fluid spacing. Use system-serif fallback with an optional OFL Fraunces web-font import only if vendored with its license; use a system mono/sans stack otherwise. Apply `overflow-x: clip`, responsive grids, minimum 44px interactive targets, `:focus-visible` rings, readable line lengths, and a single-column 320px layout.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Run page tests, build, and inspect generated output**

Run:

```bash
npm run test:browser --workspace @sortecerta/landing -- tests/page-content.test.tsx
npm run landing:typecheck
npm run landing:build
rg -n "Make your USDC feel lucky|challenges.cloudflare.com" packages/landing/dist
```

Expected: tests, typecheck, and build pass; built assets contain the headline and Turnstile integration.

- [ ] **Step 6: Commit the page**

```bash
git add packages/landing/src packages/landing/public packages/landing/index.html packages/landing/tests/page-content.test.tsx
git commit -m "feat(landing): build prize-first marketing page"
```

### Task 10: Document operation and run the full verification matrix

**Files:**
- Create: `packages/landing/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: every package script and operator command produced above.
- Produces: repeatable local setup, migration, invitation, preview deployment, secret setup, rollback, and manual verification instructions.

- [ ] **Step 1: Write operator documentation**

Document these exact flows:

```bash
npm install
npm run landing:dev
npm run landing:typecheck
npm run landing:test
npm run landing:build
npm exec --workspace @sortecerta/landing wrangler d1 migrations apply sortecerta-landing-local --local
npm run invitation:create --workspace @sortecerta/landing -- --email person@example.com
```

For production, document `wrangler d1 create sortecerta-landing`, replacement of the zero UUID with the returned database ID, remote migration application, `wrangler secret put TURNSTILE_SECRET_KEY`, setting `VITE_TURNSTILE_SITE_KEY` at build time, preview deployment, valid/invalid/replay smoke tests, and custom-domain connection only after preview validation. Rollback restores the previous Worker version; the additive migration remains because dropping waitlist data is not a safe rollback.

Add a short root README link to `packages/landing/README.md`; do not change existing deployment instructions.

- [ ] **Step 2: Run the complete automated verification**

Run:

```bash
npm install
npm run landing:typecheck
npm run landing:test
npm run landing:build
npm run web:build
npm run lab:typecheck
npm run lab:test -- --run
npm test --workspace @sortecerta/protocol
npm test --workspace @sortecerta/keeper
npm run contracts:compile
npm run contracts:test
git diff --check HEAD~1
```

Expected: every command exits 0. If a pre-existing package gate fails, record the exact command and failure without broadening the feature.

- [ ] **Step 3: Run browser review at the required breakpoints**

Start `npm run landing:dev`, then inspect 320, 390, 768, 1024, and 1440px widths. Verify no horizontal scroll, keyboard-only navigation, visible focus, reduced-motion behavior, CTA anchors, status focus, Turnstile retry, retained fields after temporary failure, and no request to the product app or smart contracts.

- [ ] **Step 4: Review the acceptance criteria and commit documentation**

Re-read issue #13 and the approved spec line by line. Confirm the package is independent, invitation checks are generic and concurrent-safe, Turnstile precedes D1 mutation, attribution is narrow, secrets are absent, and deployment steps are repeatable.

```bash
git add README.md packages/landing/README.md packages/landing/tests
git commit -m "docs(landing): document waitlist operations"
```

- [ ] **Step 5: Perform final branch review**

Run:

```bash
git status --short
git log --oneline --decorate -12
git diff origin/main...HEAD --stat
git diff --check origin/main...HEAD
```

Expected: only issue #13 files and additive root integration are present; the worktree is clean; the diff has no whitespace errors.
