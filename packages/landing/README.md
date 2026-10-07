# SorteCerta Landing Operations

This package is the standalone public landing site and email waitlist. It builds
a Vite React frontend and a same-origin Cloudflare Worker that serves static
assets and writes D1-backed waitlist rows.

It does not connect wallets, read contracts, or change the product app
deployment. App entry is handled by `packages/web`, which reads the same
approval table.

## Local Setup

Install workspace dependencies from the repository root:

```bash
npm install
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

## Local D1 And Approval

Apply the local D1 migration:

```bash
npm exec --workspace @sortecerta/landing wrangler d1 migrations apply sortecerta-landing-local --local
```

Join the waitlist from the browser with any email. Approve an email directly in
D1 by setting `approved_at`:

```bash
npm exec --workspace @sortecerta/landing wrangler d1 execute sortecerta-landing-local --local --command "UPDATE waitlist_entries SET approved_at = datetime('now') WHERE email_normalized = 'person@example.com';"
```

## Production D1

Create the shared owner-operated production D1 database from `packages/landing`:

```bash
npm exec --workspace @sortecerta/landing wrangler d1 create kettigo
```

Copy the returned `database_id` into `packages/landing/wrangler.jsonc`,
replacing the local placeholder:

```json
"database_id": "00000000-0000-0000-0000-000000000000"
```

Do not invent this identifier. It must come from the Cloudflare account that
will run the Worker. Keep the `DB` binding name unchanged.

Apply the migration to the remote D1 database after the ID is configured:

```bash
npm exec --workspace @sortecerta/landing wrangler d1 migrations apply kettigo --remote
```

The web Worker has its own Wrangler config at `packages/web/wrangler.jsonc`.
Keep its `database_name` and `database_id` synchronized with this config so
both Workers use the same `DB` binding and schema.

Approve remote emails with a targeted D1 update after reviewing the row.

## Preview Deployment

Deploy to a Worker preview URL before connecting any custom domain:

```bash
npm exec --workspace @sortecerta/landing wrangler deploy
```

Use the preview URL for smoke testing. Connect the custom domain only after the
preview checks pass.

## Production Smoke Tests

Exercise these flows against the preview URL before routing public traffic:

- Waitlist join: a new email returns the joined success state and inserts one
  row with `approved_at` empty.
- Replay: submitting the same email again returns the idempotent success state
  and does not add another row.
- Manual approval: setting `approved_at` in D1 lets the same email enter the app
  after wallet sign-in.
- Reuse prevention: after the first wallet signature is saved, a different
  wallet/signature for that email is rejected by the app gate.
- Attribution: only `utm_source`, `utm_medium`, `utm_campaign`, `ref`, and the
  referrer hostname are stored within the documented limits.
- Privacy: logs and D1 rows contain no IP address, user agent, or full referrer
  URL.

## Rollback

List deployments and identify the previous good Worker version:

```bash
npm exec --workspace @sortecerta/landing wrangler deployments list
```

Restore the previous Worker version:

```bash
npm exec --workspace @sortecerta/landing wrangler rollback <version-id>
```

The waitlist migrations are additive for data retention. Leave them in place
during Worker rollback because dropping waitlist data is not a safe rollback.

## Manual Browser Review

After starting `npm run landing:dev`, inspect 320px, 390px, 768px, 1024px, and
1440px widths. Confirm there is no horizontal scrolling; keyboard navigation
reaches every control; focus is visible; reduced-motion mode suppresses motion;
CTA anchors land on the expected sections; status messages receive focus after
submission; temporary failures keep form values; and no request reaches smart
contracts.

## Operator Checklist

- `npm install`
- `npm run landing:typecheck`
- `npm run landing:test`
- `npm run landing:build`
- Local migration and email approval succeed.
- Production D1 database ID replaces `00000000-0000-0000-0000-000000000000`.
- Remote migration applies before remote approvals.
- Preview deployment passes waitlist join, replay, approval, and app gate smoke
  tests before the custom domain is connected.
