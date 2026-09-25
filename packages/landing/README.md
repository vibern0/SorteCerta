# SorteCerta Landing Operations

This package is the standalone public landing site and invitation-only waitlist.
It builds a Vite React frontend and a same-origin Cloudflare Worker that serves
static assets, verifies Turnstile, and redeems D1-backed invitations.

It does not depend on `packages/web`, connect wallets, read contracts, or change
the product app deployment.

## Local Setup

Install workspace dependencies from the repository root:

```bash
npm install
```

Copy local environment names and fill local Turnstile values:

```bash
cp packages/landing/.dev.vars.example packages/landing/.dev.vars
```

For local browser testing, Cloudflare publishes dummy Turnstile keys that work
on `localhost` and `127.0.0.1`:

```dotenv
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

Use the failing dummy pair when checking retry behavior:

```dotenv
TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA
VITE_TURNSTILE_SITE_KEY=2x00000000000000000000AB
```

Run the local site:

```bash
npm run landing:dev
```

Run the automated landing checks:

```bash
npm run landing:typecheck
npm run landing:test
npm run landing:build
```

## Local D1 And Invitations

Apply the local D1 migration:

```bash
npm exec --workspace @sortecerta/landing wrangler d1 migrations apply sortecerta-landing-local --local
```

Create a local invitation. The command stores only the normalized email and
hashed invitation code, then prints the plaintext code once after insertion:

```bash
npm run invitation:create --workspace @sortecerta/landing -- --email person@example.com
```

Add an expiration when needed:

```bash
npm run invitation:create --workspace @sortecerta/landing -- --email person@example.com --expires 2026-12-31T23:59:59.000Z
```

## Production D1

Create the owner-operated production D1 database from `packages/landing`:

```bash
npm exec --workspace @sortecerta/landing wrangler d1 create sortecerta-landing
```

Copy the returned `database_id` into `packages/landing/wrangler.jsonc`,
replacing the local placeholder:

```json
"database_id": "00000000-0000-0000-0000-000000000000"
```

Do not invent this identifier. It must come from the Cloudflare account that
will run the Worker. Keep the `DB` binding name unchanged. The current Wrangler
entry is still named `sortecerta-landing-local`; use that configured name for
remote Wrangler commands unless you also rename the config and invitation
script together.

Apply the migration to the remote D1 database after the ID is configured:

```bash
npm exec --workspace @sortecerta/landing wrangler d1 migrations apply sortecerta-landing-local --remote
```

Create remote invitations with the same operator command plus `--remote`:

```bash
npm run invitation:create --workspace @sortecerta/landing -- --email person@example.com --remote
```

## Secrets And Build Variables

Store the private Turnstile secret with Wrangler:

```bash
npm exec --workspace @sortecerta/landing wrangler secret put TURNSTILE_SECRET_KEY
```

Set the public site key at build time. `VITE_SITE_URL` controls canonical and
Open Graph URLs for the built HTML:

```bash
VITE_TURNSTILE_SITE_KEY=<production-site-key> \
VITE_SITE_URL=https://<preview-hostname> \
npm run landing:build
```

Never commit real Turnstile secrets, D1 credentials, plaintext invitation codes,
visitor IP addresses, user agents, or full referrer URLs.

## Preview Deployment

Deploy to a Worker preview URL before connecting any custom domain:

```bash
npm exec --workspace @sortecerta/landing wrangler deploy
```

Wrangler also exposes an open-beta preview command for temporary validation:

```bash
npm exec --workspace @sortecerta/landing wrangler preview
```

Use the preview URL for smoke testing. Connect the custom domain only after the
preview checks pass.

## Production Smoke Tests

Exercise these flows against the preview URL before routing public traffic:

- Valid invitation: approved email plus matching invitation code returns the
  joined success state and inserts one waitlist row.
- Replay: submitting the same approved email and invitation code again returns
  the idempotent success state and does not add another row.
- Invalid invitation: wrong email, random code, expired code, and already used
  code with another email all show the same generic invitation failure.
- Turnstile retry: temporary verification failure resets the token and preserves
  the email and invitation fields.
- Attribution: only `utm_source`, `utm_medium`, `utm_campaign`, `ref`, and the
  referrer hostname are stored within the documented limits.
- Privacy: logs and D1 rows contain no plaintext invitation code, Turnstile
  token, IP address, user agent, or full referrer URL.
- Independence: page load and form submission do not call `packages/web`, the
  live product app, or smart contracts.

## Rollback

List deployments and identify the previous good Worker version:

```bash
npm exec --workspace @sortecerta/landing wrangler deployments list
```

Restore the previous Worker version:

```bash
npm exec --workspace @sortecerta/landing wrangler rollback <version-id>
```

The `0001_waitlist.sql` migration is additive. Leave it in place during Worker
rollback because dropping waitlist data is not a safe rollback.

## Manual Browser Review

After starting `npm run landing:dev`, inspect 320px, 390px, 768px, 1024px, and
1440px widths. Confirm there is no horizontal scrolling; keyboard navigation
reaches every control; focus is visible; reduced-motion mode suppresses motion;
CTA anchors land on the expected sections; status messages receive focus after
submission; Turnstile retry works; temporary failures keep form values; and no
request reaches the product app or smart contracts.

## Operator Checklist

- `npm install`
- `npm run landing:typecheck`
- `npm run landing:test`
- `npm run landing:build`
- Local migration and invitation creation succeed.
- Production D1 database ID replaces `00000000-0000-0000-0000-000000000000`.
- Remote migration applies before remote invitation creation.
- `TURNSTILE_SECRET_KEY` is set with `wrangler secret put`.
- `VITE_TURNSTILE_SITE_KEY=` is supplied for the production build.
- Preview deployment passes valid invitation, invalid invitation, and replay
  smoke tests before the custom domain is connected.

Cloudflare Turnstile dummy keys are documented at
<https://developers.cloudflare.com/turnstile/troubleshooting/testing/>.
