# Parity: Régua vs PrecifiCAR

Date: 2026-10-13. Generated scores: `parity-scores.md` (from `parity.py features.csv --visual diffs/S03.json`).

## Verdict: **not shippable**
0 of 8 must-haves are done. The core loop works only in the web prototype with sample data; the real app (Expo) does not exist yet because npm is blocked in this environment. No open S1 or S2 bugs (`bugs.md`).

## Scores
| measure | score | what it means |
| --- | --- | --- |
| overall | **20.7 / 100** | features and layout combined |
| features | **23.1 / 100** | 27 features scored; "partial" counts half. 10 rows left out on purpose (plate lookup and partner deals) and 4 rows that are yours alone are not scored |
| layout, S03 home | **11.3 (different)** | one screen compared; see below |

### Why the home layout scores 11.3, and why most of that is deliberate
`diffs/S03.png` (red cells differ). The original's top third is a plate-search card, its header has a credit counter and avatar, and its tools grid has 8 tiles in two rows with a partner tile. Régua leaves plate lookup out (paid data), has no credits or account on the home, and shows 4 tools. Same order of sections (header, vehicle type, tools, ad, tab bar), different contents. Chasing this score would mean copying the original's trade dress and features you chose not to build, so it is not a target. Only one screen could be compared because only one screenshot of the original exists.

Comparison notes: the original's phone status and navigation bars were cropped out; it is an Android screenshot at about 411dp wide, the clone is 390px wide. Both are scaled to the same width by the tool.

## Behaviour differences
| flow | original does | Régua does | fix or keep |
| --- | --- | --- | --- |
| F01 lookup | requires an account first (per a review and the avatar on the home screenshot), then type, brand, model, year | type, brand, model, year, no account: 4 taps | keep, this is the angle |
| F01 lookup | plate search is the first field on the home | not offered | keep for now (paid data); revisit if users ask |
| ads | Google banner on the home (seen); pop-ups reported in one review | one fixed banner, no pop-ups (designed, not yet in the prototype as a real ad) | keep |
| F02 history | chart with interval selection and full-screen (per version history) | chart with 6 and 12 months, text summary; no full-screen | build full-screen later (should) |
| F03 favorites | saved to the account (inferred) | saved on the device only | build account sync (must) |
| F03 alerts | push when the table updates (listing) | not built | build (must) |
| billing | Plus subscription plus pay-per-query credits | Plus only, R$ 9,90; backend tested, no purchase screen | keep the simpler model |
I have not used the original, so its tap counts are not measured.

## Top five to build next
1. **The Expo app shell and the lookup on real data** (S03, S04, S05 against Supabase). Turns 5 must-haves from partial to done. Blocked on npm access.
2. **Run the ingestion for real**: create the Supabase project, get the FIPE API plan, run `ingest-fipe` and the history backfill. Without it there are no real prices.
3. **Accounts and synced favorites** (sign up is optional, used only for saving). Closes 2 must-haves.
4. **Push alert when the table updates** (`send-table-alerts`, device tokens). The last must-have.
5. **Banner ad and the Plus purchase screen**, with the free-vs-paid line shown before purchase (one of your fixes).

Next: `/replica-build` as soon as npm is reachable.
