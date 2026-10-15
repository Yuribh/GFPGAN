# Build log

| ID | date | status | missing | notes |
| --- | --- | --- | --- | --- |
| data layer | 2026-10-13 | done | real Supabase implementation (replica-backend) | `app/src/data/` with 8 passing tests. Fake repository implements the `FipeRepository` interface, so screens will not change when the real one replaces it. Seed data is invented, not real FIPE prices. |
| formatters | 2026-10-13 | done | | BRL from cents, month names, zero-km label, percent with sign. Found and fixed a rounding bug (-1.05 rounded toward zero) in the first test run. |
| Expo shell | 2026-10-13 | **blocked** | the whole Expo app | The npm registry is denied by this session's network policy (proxy answered 403 for registry.npmjs.org), so Expo and React Native cannot be installed. |
| S03 home | 2026-10-13 | partial (web prototype) | credit counter, avatar, plate field, tools beyond 4 | `app/prototype/`. Built from the same tested data and format code as the future app. 3-column tools grid under 360px. |
| S04 pick vehicle | 2026-10-13 | partial (web prototype) | sticky letters on long lists | Brand, model, year with search, loading skeleton, empty search, error with retry. |
| S05 result | 2026-10-13 | partial (web prototype) | skeleton for the chart only | Price, reference month, FIPE code, change vs last month, favorite, share. |
| S06 history chart | 2026-10-13 | partial (web prototype) | full-screen chart, tooltip on touch | 6 and 12 month switch, text summary, sparse state. |
| S08 favorites, history list | 2026-10-13 | partial (web prototype) | sync across devices (needs accounts) | Stored on the device. Empty and loading states. |

Prototype checks: `cd app/prototype && node build.mjs && python3 e2e.py` (27 checks: flow F01, favorite, share, back stack, keyboard, sparse, loading, error, no horizontal scroll at 320 and 1440px, no console errors). The first run found an overflow at 320px (tools grid), fixed.

Run the tests: `cd app && node --test tests/data.test.ts` (Node 22, no install needed).
| backend (replica-backend) | 2026-10-13 | partial | push alerts, deployed functions, real Supabase project | Migrations, access rules, ingestion, billing and account deletion written and tested (33 Node tests, 3 SQL test files on local Postgres). Edge Function wrappers not run (no Deno here). See `backend.md`. |
| tests (replica-test) | 2026-10-13 | done for what exists | device-only cases | 124 automated checks pass. 5 bugs found and fixed (1 S2, 2 S3, 2 S4), see `bugs.md`. |
| Expo app (Android and iOS) | 2026-10-13 | written, **not compiled** | first run on a real machine | Screens S03, S04, S05/S06, S08, history, about with Expo Router; real Supabase repository and shared logic tested (41 Node tests). npm blocked here, so no typecheck or bundle. An independent review found 2 breaking defects (Android back on the wrong screen, squashed tab bar) and 13 smaller ones; all fixed and re-reviewed. |
