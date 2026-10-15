# Architecture: a FIPE price app (a rebuild of PrecifiCAR's core features)

Scope from `recon.md`: FIPE lookup, price history, favorites, table-update alerts, sharing. Mobile first. Plate lookup, market calculator and partner tiles are out.

## Stack

| layer | choice | why |
| --- | --- | --- |
| mobile | Expo (React Native) + TypeScript | one codebase for Android and iOS, the original is mobile-only |
| database | Postgres on Supabase | one database, RLS gives access rules for free |
| auth | Supabase Auth (email, Google, Apple) | Apple requires "Sign in with Apple" when you offer Google |
| payments | RevenueCat over Apple and Google billing | store rules force in-app purchase; RevenueCat mirrors state with a webhook |
| push | Expo push notifications | works with FCM and APNs without extra setup |
| ads | Google AdMob (free plan only) | same model as the original; the biggest source of its bad reviews, so keep it light |
| jobs | Supabase scheduled functions (pg_cron + Edge Functions) | monthly ingestion and alerts, no extra server |
| data source | a FIPE data provider behind one adapter file | see risk 1 |
| hosting | Supabase (backend), EAS (builds), stores | nothing else to run |

No web app in v1. If you want one later, Next.js on Vercel can read the same tables.

## Schema

Tables: 13 (+1 materialized view). Access rules: **row level security**. Catalog tables are read-only for signed-in users and written by the service role. User tables allow own rows only. Full SQL in `replica/schema.sql`.

| group | tables |
| --- | --- |
| catalog | reference_months, brands, models, model_years, price_points, technical_sheets |
| ops | ingestion_runs, alert_log (service role only, no policies) |
| users | profiles, favorites, device_tokens, search_events, subscriptions |
| derived | popular_vehicles (materialized view, refreshed daily) |

Choices that matter:
- `price_points` is unique on (model_year_id, reference_month_id). Ingestion can run twice and nothing duplicates.
- Money is `price_cents` (bigint) plus `currency`. The source returns "R$ 45.678,00" text; parse once at ingestion.
- `model_years.model_year = 32000` is how FIPE labels zero-km. Map it to a "0 km" label in the app, not in the database.
- `search_events.user_id` is `on delete set null`, so deleting an account keeps the aggregate ranking without personal data.
- `profiles.plan` cannot be changed from the app. Only the billing webhook (service role) writes it.

## API

The app talks to Supabase directly (PostgREST with RLS) for reads and user writes. Edge Functions exist only where a secret or a privileged write is needed.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /rest/v1/brands?vehicle_type=eq.cars | list brands | signed in | type | brands | F01 |
| GET /rest/v1/models?brand_id=eq.{id} | list models | signed in | brand | models | F01 |
| GET /rest/v1/model_years?model_id=eq.{id} | list years and fuels | signed in | model | years | F01 |
| GET /rest/v1/price_points?model_year_id=eq.{id}&order=reference_month_id.desc | latest price and history | signed in | model_year | points with month | F01, F02 |
| POST /rest/v1/search_events | log a lookup (history, ranking) | signed in | model_year_id | row | F01 |
| GET /rest/v1/search_events?order=created_at.desc&limit=50 | search history | own rows | none | events | F01 |
| GET /rest/v1/popular_vehicles?order=searches.desc&limit=20 | ranking | signed in | none | rows | S09 |
| POST/DELETE /rest/v1/favorites | add or remove favorite | own rows | model_year_id | row | F03 |
| POST /rest/v1/device_tokens | register push token | own rows | token, platform | row | F03 |
| POST /functions/v1/delete-account | delete user and data | signed in | none | 204 | privacy |
| POST /functions/v1/share-card | build the text and image for a price share (v1: text only) | signed in | model_year_id | text | F04 |

Webhooks in: RevenueCat to `/functions/v1/billing-webhook` (verifies the auth header, upserts `subscriptions`, sets `profiles.plan`, dedupes on `last_event_id`).
Webhooks out: none.

Jobs:
| name | schedule | what it does |
| --- | --- | --- |
| ingest-fipe | daily at 06:00 UTC, days 1 to 12 of the month, then weekly | checks the provider for a new reference month; if new, pulls brands, models, years, prices in batches and upserts; writes `ingestion_runs` |
| send-table-alerts | triggered when ingest-fipe finishes a new month | sends one push per user with a favorite (dedupe on `alert_log`), grouped by changes |
| refresh-popular | daily | `refresh materialized view concurrently popular_vehicles` |
| prune-search-events | weekly | delete events older than 12 months |

## The parts that bite

1. **Data source and rights.** Prices come from the Fundação Instituto de Pesquisas Econômicas (FIPE). The community API in the recon is free for light use and offers a paid token for heavier use, with no stated licence. For a product you sell, get the provider's commercial terms in writing, or ask FIPE directly. Put every call in `providers/fipe.ts` so you can swap the source without touching the schema.
2. **History is something you build.** The API gives one month at a time. At launch you have one month of data, so the chart is empty. Backfill: the provider's `reference` parameter lets you pull older months. Budget the calls and run the backfill once, in batches, within its rate limits.
3. **Volume of ingestion.** Roughly tens of thousands of model-year rows per month. A full monthly pull is thousands of requests; batch it, resume on failure (`ingestion_runs`), and only fetch prices for vehicles people can look up.
4. **Time zones.** The "table updated" moment is a date in Brazil, not a timestamp. Store `published_at` in UTC, show dates in `America/Sao_Paulo`. Reference months are (year, month), never derived from timestamps.
5. **Idempotency.** Ingestion is upsert on unique keys. Billing webhooks arrive twice; dedupe on `last_event_id`. Alerts dedupe on `alert_log (user_id, reference_month_id)`.
6. **Races.** Two ingestion runs at once: take an advisory lock at the start of `ingest-fipe`.
7. **Store rules.** In-app purchase is mandatory for digital subscriptions on both stores. Apple needs Sign in with Apple, an account deletion path inside the app (`delete-account`) and an ATT prompt if ads track users.
8. **Ads.** Pop-ups and forced signup are the top Android complaints. Banner only, no interstitials between steps, and let people look up a price before signing up (the recon shows signup is mandatory in the original; changing that is your first fix).
9. **LGPD (Brazil's data law).** Store the minimum: email, push token, favorites, searches. The privacy policy must say what the ad SDK collects. Deletion via `delete-account` removes user rows and anonymizes search events.
10. **Push permissions.** Android 13+ and iOS ask at runtime. Ask after the first favorite, not on launch.

## Build order

1. **Vertical slice (ugly, end to end).** Screens S03, S04, S05. Tables: reference_months, brands, models, model_years, price_points. Routes: the five catalog GETs. Job: a manual run of `ingest-fipe` for the latest month only. No login, no ads. Goal: pick Carros, Fiat, Uno, 2015, see a price.
2. **Must-haves.** Add S01, S02 (Auth), S08 favorites + `device_tokens` + S11 alerts (`send-table-alerts`), S06 history chart (needs backfill), tables: profiles, favorites, device_tokens, alert_log. Routes: favorites, device_tokens, delete-account.
3. **Should-haves.** S10 share, S09 ranking (`search_events`, `popular_vehicles`), search history, full-screen chart, price change on favorites, comparison, credits counter if you keep credits, free plan with AdMob banner, S13 paywall (`subscriptions`, RevenueCat webhook).
4. **Fixes from replica-entrepreneur.** Not run yet. Candidates already visible: no interstitial ads, look up before signup.

Next: `/replica-design`.
