# Invitation-Only Landing Site Design

## Purpose

Build a polished public acquisition site for crypto-native USDC holders while
keeping the existing SorteCerta product application unchanged. The landing site
explains the prize-savings product in accessible language and converts approved
visitors through an invitation-only waitlist.

Success means a visitor can understand the product, Zama's privacy role, and
Morpho's yield role; an approved visitor can join once with an email-bound
invitation; and maintainers can run, test, deploy, and operate the site without
depending on `packages/web`.

## Scope

The implementation creates a new `packages/landing` workspace containing:

- A Vite-built React marketing site.
- A native Cloudflare Worker serving assets and handling the waitlist API.
- A D1 schema for invitations and waitlist registrations.
- Server-side Cloudflare Turnstile verification.
- A command-line invitation creation tool.
- Automated frontend, API, validation, and attribution tests.
- Local development, deployment, rollback, and operator documentation.

The landing page does not connect wallets, read smart contracts, display live
pool metrics, or link to the product application. It does not add an admin
dashboard, automated invitation email, questionnaire, referral rewards, or an
open request-access flow. Existing product packages retain their behavior and
styling.

Production Cloudflare resource creation, secret entry, domain connection, and
deployment require the repository owner's account and credentials. The code,
configuration, migrations, and documentation will be deployment-ready, but the
implementation does not fabricate resource identifiers or secrets.

## User Experience

### Page structure

The page uses a fixed dark theme and follows this hierarchy:

1. A header with the SorteCerta identity, anchors for “How it works” and “Why
   SorteCerta,” and a “Join the waitlist” action.
2. A prize-led hero headed “Make your USDC feel lucky.” It explains that users
   save in USDC, remain eligible at the end of a draw, and stay in control of
   their money. The primary action scrolls to the invitation form; the
   secondary action scrolls to the explanation.
3. A three-step explanation: save USDC, stay eligible at the end of the draw
   with chances weighted by savings, and check whether there is a prize to
   claim. Withdrawal is described as a user-controlled request.
4. A trust section that briefly explains “Privacy powered by Zama” and “Yield
   powered by Morpho” without protocol-level detail or fixed-yield claims.
5. An invitation form with exactly two user-entered fields: approved email and
   invitation code. Turnstile is rendered separately as verification. Success
   is celebratory but restrained; invitation failures share one generic message.
6. A concise footer with no dead legal links and no product-app link.

The page must not invent TVL, user counts, APY, or a current prize amount. It
must not imply a visitor has won before checking a completed draw. User-facing
copy follows the repository rules and avoids implementation, preview-network,
and prototype terminology.

### Visual system and accessibility

The design uses graphite `#111215`, raised surfaces near `#1D1E23`, warm text
near `#F0EEE9`, muted text near `#AAA7A6`, teal and plum atmosphere, and a warm
CTA accent. Glass material is reserved for the prize visual and a few focal
surfaces rather than applied to every section.

The display face is an OFL-licensed font such as Fraunces, paired with DM Mono
or a system fallback; trial fonts from `packages/web` are not copied. Motion is
short and subtle and is disabled or simplified under `prefers-reduced-motion`.
The interface supports keyboard use, visible focus, semantic headings, explicit
labels, live status announcements, WCAG AA contrast, and layouts from 320px
through large desktop widths without horizontal scrolling.

## System Architecture

One Cloudflare Worker deployment owns both the static site and the API:

```text
Browser
  ├─ GET page/assets ───────────────▶ Worker ─▶ ASSETS binding
  └─ POST /api/waitlist ────────────▶ Worker
                                        ├─ Turnstile Siteverify
                                        └─ D1 DB binding
```

The browser uses a same-origin request. The Worker handles `/api/*` routes
itself and delegates all other requests to `env.ASSETS.fetch(request)`. No CORS
policy is added because there is no second origin. No Node server, Hono layer,
third-party form service, or separate application database is introduced.

### Workspace responsibilities

- Page-section components each render one semantic section.
- `src/lib/attribution.ts` captures only approved query and referrer fields.
- `src/lib/waitlist-client.ts` owns request serialization and typed response
  mapping.
- `worker/index.ts` owns routing and response security headers.
- `worker/waitlist.ts` owns the registration use case and public result mapping.
- `worker/turnstile.ts` owns the Siteverify boundary and supports injected test
  dependencies.
- `worker/validation.ts` owns content-type checks, body limits, normalization,
  field limits, and payload parsing.
- `scripts/create-invitation.mts` is the sole initial invitation issuance
  workflow.

## Waitlist Data Model

The first D1 migration creates the following schema:

```sql
CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  redeemed_at TEXT
);

CREATE INDEX invitations_email_idx
  ON invitations(email_normalized);

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

Emails are normalized with `trim().toLowerCase()`. Invitation codes contain at
least 100 bits of cryptographically secure randomness and are normalized by
trimming, removing separator whitespace, and uppercasing. Only the SHA-256
hash is stored or sent to D1; the issuance tool prints the plaintext code once
for manual delivery.

Invitation consumption updates the matching unredeemed invitation and inserts
the waitlist entry in one D1 batch. The unique code hash, invitation ID, and
waitlist email constraints are the final concurrency boundary. A repeated
request with the same email/code pair returns idempotent success; another
email, an expired invitation, a random invitation, and an already-consumed
invitation all receive the same public invalid-invitation response.

## API Contract

`POST /api/waitlist` accepts:

```ts
type WaitlistRequest = {
  email: string;
  invitationCode: string;
  turnstileToken: string;
  attribution?: {
    source?: string;
    medium?: string;
    campaign?: string;
    referralCode?: string;
    referrerHost?: string;
  };
};
```

It returns:

```ts
type WaitlistResponse =
  | { ok: true; status: "joined" | "already_joined" }
  | {
      ok: false;
      code:
        | "invalid_request"
        | "invalid_invitation"
        | "verification_failed"
        | "temporarily_unavailable";
      message: string;
    };
```

The status mapping is:

- `201` for a newly consumed invitation and waitlist entry.
- `200` for an idempotent repeat of the same approved pair.
- `400` for invalid content type, malformed or oversized JSON, missing fields,
  invalid email syntax, or length violations.
- `403` for every invitation validity failure.
- `422` for failed Turnstile verification.
- `405` for unsupported methods on the endpoint.
- `500` or `503` for generic dependency or database failures.

The Worker does not return internal D1 or Turnstile details. API responses use
`Cache-Control: no-store`.

## Registration Flow

1. On first page load, the browser captures `utm_source`, `utm_medium`,
   `utm_campaign`, and `ref`; unknown parameters are discarded. Only the
   referrer hostname is retained.
2. The visitor enters an approved email and invitation code and completes
   Turnstile.
3. The client submits the typed payload once and disables duplicate submission
   while the request is pending.
4. The Worker rejects unsupported origins, content types, or oversized and
   malformed payloads before doing external or database work.
5. The Worker verifies Turnstile server-side before mutating D1.
6. The registration use case hashes the normalized code and atomically consumes
   the invitation while inserting the waitlist row.
7. The client renders and focuses the appropriate live status. Failed attempts
   discard and reset the Turnstile token. Temporary failures preserve the
   email and invitation fields for retry.

## Security and Privacy

- Same-origin browser submissions are required.
- Every accepted string has an explicit maximum length, and the body limit is
  8 KiB.
- Emails, plaintext invitation codes, Turnstile tokens, IP addresses, user
  agents, and full referrer URLs are never persisted or logged.
- Logs contain only a request identifier, coarse outcome, and timing.
- Static responses include a CSP that allows the configured Turnstile script
  and frame, plus Referrer Policy, MIME-sniffing protection, and appropriate
  frame restrictions.
- API responses are non-cacheable and use the fixed public error vocabulary.
- Turnstile verification precedes every D1 mutation.
- D1 uniqueness constraints and a transactional batch protect against replay
  and concurrent duplicate registration.

## Invitation Operator Workflow

The invitation script accepts an email and optional expiration, generates a
readable high-entropy code with Node cryptography, hashes it, and invokes
Wrangler with an argument array rather than shell interpolation. It supports
explicit local and remote modes, inserts only normalized email and hashed code
data, and prints the plaintext code exactly once after successful creation.

The landing README documents database migration, Turnstile test configuration,
local development, invitation issuance, secrets, preview deployment, rollback,
and a manual verification checklist. It never contains real secrets or a
fabricated production D1 identifier.

## Testing and Verification

Implementation follows test-driven development. Tests cover:

- Email/code normalization, hashing input, strict string limits, malformed JSON,
  unsupported content type, and oversized bodies.
- Valid redemption, wrong email, wrong code, expiry, replay, idempotent repeat,
  concurrent duplicates, Turnstile failure, and D1 failure.
- The real Worker routing boundary and static/API security headers.
- Attribution allowlisting and referrer-host extraction.
- Client request mapping, pending lockout, success and error states, keyboard
  submission, retry behavior, Turnstile reset, and status focus/announcement.
- CTA targets, semantic content, reduced-motion behavior, and the absence of
  disallowed product claims.

Required automated gates are `npm run landing:typecheck`,
`npm run landing:test`, and `npm run landing:build`, followed by the relevant
existing workspace checks. Manual review covers the issue's responsive sizes,
keyboard navigation, focus visibility, reduced motion, valid and invalid
invitation paths, retry behavior, narrow attribution storage, sensitive-data
absence, and independence from the existing product app.

## Deployment Boundary

`packages/landing/wrangler.jsonc` defines a Worker entry point, static Assets
binding named `ASSETS`, D1 binding named `DB`, a current compatibility date,
and observability. Local/test configuration uses a non-production placeholder
or documented setup step where an account-generated D1 database ID is required.

The implementation prepares the repository for preview deployment. Creating
the production D1 database, setting the Turnstile secret, validating the real
site key, connecting the custom domain, and exercising production invitations
remain explicit owner-operated steps because they require Cloudflare account
access and secret material.
