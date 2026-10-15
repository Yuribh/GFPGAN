# Test plan: Régua

Date: 2026-10-13. What exists to test: the **web prototype** (`app/prototype`), the **data and formatting code** (`app/src`), the **backend logic** (`app/server`) and the **database** (`app/supabase`). The Expo app does not exist yet (npm is blocked in this environment), so device-only cases are listed as "to run on the app".

Tools: Playwright for Python against the built prototype (the skill's TypeScript specs and the axe scanner need npm, which is blocked), Node's test runner, and SQL tests on a local Postgres with a stand-in for Supabase. Every browser check also fails on console errors.

Run it all from `app/`:
```
npm test                  # 33 unit tests (data, formatting, ingestion, billing, account deletion)
npm run test:db           # 42 database checks (needs local Postgres)
cd prototype && node build.mjs && python3 e2e.py && python3 e2e_edge.py   # 27 + 22 browser checks
```

**Total: 124 automated checks, 124 passing after fixes.** Status key: ✅ automated and passing · 🔁 fixed bug, test kept · ⏳ to run on the real app · ➖ not applicable yet.

## F01 Look up a FIPE price (S03 → S04 → S05)
| ID | case | status |
| --- | --- | --- |
| F01-H1 | Carros → brand → model → year → price, month, FIPE code, change | ✅ e2e.py |
| F01-E1 | search without accents, any case, extra spaces ("automatico") | 🔁 BUG-002 |
| F01-E2 | emoji search; 2,000-character search | 🔁 BUG-004 (long query overflow) |
| F01-E3 | double tap on a list item | 🔁 BUG-001 |
| F01-E4 | 60+ character model name and a seven-digit price at 320px | ✅ |
| F01-E5 | back during loading; late response must not pull the user back | ✅ |
| F01-E6 | keyboard only, end to end; focus not lost after each step | 🔁 BUG-003 |
| F01-E7 | slow network (skeleton) and offline (error with retry) | ✅ |
| F01-E8 | zero-km year label; vehicle with one month of data | ✅ |
| F01-E9 | 320, 390 and 1440px without horizontal scroll | ✅ |
| F01-E10 | time zones: formatting and dates in São Paulo, Noronha, UTC, UTC+14 | ✅ unit tests run in 4 zones |
| F01-N1 | markup typed in search is shown as text, never run | ✅ |
| F01-N2 | year with no price at the source | ✅ ingestion skips it (unit test); the prototype's message for this case exists but no test covers it |
| F01-E11 | two tabs at once; refresh mid-flow | ➖ prototype has no routing; ⏳ on the app (state restore) |
| F01-E12 | screen reader reading order on a real device (TalkBack, VoiceOver) | ⏳ |

## F02 See price history (S05 → S06)
| ID | case | status |
| --- | --- | --- |
| F02-H1 | chart with 12 months, switch to 6 | ✅ |
| F02-E1 | one month only: text instead of an empty chart | ✅ |
| F02-E2 | chart has a text summary for screen readers | ✅ (aria-label and line under the chart) |
| F02-E3 | period buttons at least 48dp tall (components.md) | 🔁 BUG-005 |

## F03 Favorite and get alerted (S05 → S08, push S11)
| ID | case | status |
| --- | --- | --- |
| F03-H1 | favorite, see it in Favoritos, remove it, empty state | ✅ |
| F03-E1 | storage blocked (private mode): favorites kept for the session | ✅ |
| F03-E2 | corrupted storage; favorite whose vehicle left the catalog | ✅ |
| F03-E3 | second user cannot see or write another user's favorites | ✅ database |
| F03-N1 | alert push when the table updates; notifications denied | ➖ not built |

## F04 Share a price (S05 → share)
| ID | case | status |
| --- | --- | --- |
| F04-H1 | share builds text with the shown price and month | ✅ |
| F04-E1 | no markup in the shared text | ✅ |
| F04-E2 | WhatsApp not installed; real share sheet | ⏳ on the app |

## F05 Sign up (optional now) and account
| ID | case | status |
| --- | --- | --- |
| F05-H1 | look up without an account (the main fix) | ✅ prototype and database |
| F05-E1 | delete account deletes only the caller; data cascades; searches anonymized | ✅ unit + database |
| F05-N1 | forged or missing token cannot delete anyone | ✅ |
| F05-N2 | wrong password, expired session, email verification, OAuth | ⏳ needs the real Supabase project |

## Billing
| ID | case | status |
| --- | --- | --- |
| B-H1 | purchase gives Plus; cancel keeps it until the period ends; expiry returns to free | ✅ database |
| B-E1 | duplicate webhook; late older webhook | ✅ database |
| B-N1 | bad signature, wrong secret, replayed old timestamp | ✅ unit |
| B-N2 | user cannot make themselves Plus or call billing functions | ✅ database |
| B-N3 | real store purchase in sandbox, refund, payment failure | ⏳ needs store accounts |

## Accessibility (own checks; axe could not be installed)
Every button, link and input has an accessible name, images have alt text, the page has a language and a main landmark, touch targets at least 44px: ✅ on S03, S04, S05 after BUG-005.
