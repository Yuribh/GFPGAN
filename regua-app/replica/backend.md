# Backend: Régua

Date: 2026-10-13. Stack per `architecture.md`: Supabase (Postgres, Auth, Edge Functions), RevenueCat over Apple and Google billing.
**Nothing is deployed and no account was created.** You create the Supabase project, the FIPE API token and RevenueCat, and put keys in `app/.env.local` (names in `app/.env.example`).

## What exists and how it was checked

| part | files | checked how | result |
| --- | --- | --- | --- |
| Migrations | `app/supabase/migrations/0001` to `0004` | run on a throwaway Postgres 16 with a stand-in for Supabase's auth schema and default grants | apply cleanly |
| Access rules | same | `app/supabase/tests/rls_test.sql`, two users plus signed-out | 19 checks pass: B sees nothing of A, nobody writes the catalog, nobody upgrades their own plan, signed-out users can read prices |
| Ingestion write path | `0003_ingestion_functions.sql` | `ingest_test.sql` | idempotent; app roles cannot execute the write functions |
| Ingestion job | `app/server/fipe/` | 15 Node tests against a fake API built from the provider's documented responses | full run, rerun, request budget with resume, 429 retry, missing price, bad price |
| Billing | `0004_billing.sql`, `app/server/billing/revenuecat.ts` | `billing_test.sql` plus 7 Node tests | duplicate and late events ignored, cancel keeps access until the period ends, expiry moves to free, signature check verified against an independent HMAC |
| Account deletion | `app/server/account/delete.ts` | 3 Node tests plus cascade checks in SQL | deletes only the caller; favorites, tokens, profile go; search events stay anonymous |
| Edge Functions | `app/supabase/functions/*/index.ts` | **not run**: they need Supabase's Deno runtime, not available here | thin wrappers around the tested code |

Run everything: `cd app && npm test` (33 Node tests) and `npm run test:db` (needs a local Postgres).

## Problems the tests caught
1. **Prices were readable only when signed in**, which broke the main fix ("consultar sem cadastro"). Fixed in `0002_public_catalog.sql`.
2. **Supabase makes every new function callable by `anon` and `authenticated` by default.** Revoking from `public` alone would have left the ingestion and billing functions callable by any user. Fixed by revoking from those roles. The first version of the test passed for the wrong reason (row level security raised the same error code), so it now checks the privilege directly, and I confirmed it fails when the fix is removed.

## Data source (the real constraint)
Provider: the public FIPE API at `fipe.parallelum.com.br/api/v2` (docs at fipe.api.br, read 2026-10-13).
- Free: 500 requests a day, or 1,000 with a free token. One request per model year means a full monthly load needs far more than that. My estimate is tens of thousands of requests a month, not measured.
- Paid "Pro": unlimited requests, history and a CSV download, listed at R$ 49 a month, R$ 59 for new subscribers "a partir de setembro". **Budget for it.** It also gives the history for the chart at launch, which the free tier does not.
- No statement on commercial use or redistribution was found on the pricing page or the docs. **Ask the provider in writing before you sell.**
- The job runs in slices (`FIPE_REQUESTS_PER_RUN`) because Edge Functions have a time limit, resuming from a checkpoint each time.

## Auth
- Supabase Auth: email with verification and password reset; Google and Apple with your own developer apps (Apple requires Sign in with Apple when Google is offered).
- Lookups need no account (see problem 1). An account is only for saved favorites across devices, alerts and Plus.
- Sessions on mobile are tokens kept in the device's secure storage by the Supabase client; the http-only cookie advice applies to a web app.

## Payments
Stores require in-app purchase for digital subscriptions, so this uses RevenueCat instead of Stripe Checkout. Cancelling is through the store's own one-tap screen; link to it from Settings.
To create (you): products `plus_monthly` R$ 9,90 and `plus_yearly` R$ 99 in both stores, a RevenueCat entitlement `plus`, a webhook pointing at the `billing-webhook` function with HMAC signing on. In the app, log in to RevenueCat with the Supabase user id, or the webhook cannot link a purchase to a user.

## Not built yet
- Push alerts when the table updates (`send-table-alerts`), ranking refresh, search-event pruning.
- Email templates (Supabase Auth sends the default ones until you write yours from your own domain).
- Rate limits on sign up and password reset (Supabase has built-in auth rate limits; check the settings).

## Security checklist
- [x] secrets only in env vars, `.env*` in `.gitignore`, service key never in app code (searched)
- [x] input validated on the server: webhook signature, event shape, price and date formats; the app talks to Postgres only through row level security
- [x] authorisation tested with a second user and with a signed-out user
- [ ] rate limits on auth: check Supabase's auth rate-limit settings when the project exists
- [x] webhooks verify signatures (HMAC-SHA256, 5-minute window, constant-time compare)
- [x] uploads: none in this app
- [x] no user data in URLs or logs in the code written so far
- [ ] dependencies audited: no dependencies yet (npm is blocked here); run `npm audit` once the Expo app exists
- [ ] privacy policy lists every processor: Supabase, RevenueCat, Apple, Google, the ad network, the FIPE data provider
- [ ] backups: turn on and check daily backups in the Supabase project
