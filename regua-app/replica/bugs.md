# Bugs: Régua

Only bugs reproduced here. Each was caught by a test written before the fix; the test is kept. No git repository exists yet, so "fixed" means fixed in the working copy, not committed.

Open: **0**. By severity found: S1 0 · S2 1 · S3 2 · S4 2. All 5 fixed. A regression introduced by the first fix for BUG-001 was caught by the main suite and corrected before closing.

### BUG-001: double tap on a list item skips the next step and picks a vehicle the user did not choose
- Severity: S2
- Flow / case: F01 / F01-E3
- Screen: S04
- Build: prototype, 2026-10-13  Browser / device: Chromium (Playwright), 390px
Steps
1. Home, tap Carros.
2. Double tap "Marca Exemplo Alfa".
Expected: the model list, waiting for a choice.
Actual: "Escolha o ano" with "Modelo A 1.0" already chosen. The second tap landed on the first model of the new list.
Evidence: `replica/bugs/F01-E3-double-tap.png`; test `F01-E3` in `e2e_edge.py`
Suspected cause: the list re-renders under the finger between the two taps.
Status: fixed. Clicks with a click count above 1 are ignored on list items. A first fix (ignore taps within 450 ms) also blocked quick deliberate taps and broke `zero km label on years` in `e2e.py`; replaced.

### BUG-002: search does not find names when typed without accents
- Severity: S3
- Flow / case: F01 / F01-E1
- Screen: S04
Steps
1. Carros → Marca Exemplo Alfa.
2. Type "automatico".
Expected: "Modelo B 2.0 Automático" listed.
Actual: "Nenhum resultado".
Evidence: test `F01-E1`
Suspected cause: comparison was case-folded but not accent-folded.
Status: fixed. Both sides are normalized (accents removed, lower case, trimmed).

### BUG-003: focus is lost after every step, so keyboard and screen-reader users restart from the top of the page
- Severity: S3
- Flow / case: F01 / F01-E6
- Screens: S03, S04, S05
Steps
1. Use Tab to reach Carros and press Enter.
Expected: focus moves to the new screen's heading.
Actual: focus falls back to the page body.
Evidence: test `F01-E6b`
Suspected cause: each screen is rebuilt, removing the element that had focus.
Status: fixed. Headings can take focus; on a new screen or step, focus moves to its heading. Search field keeps focus while typing.

### BUG-004: a very long search makes the page 17,518px wide
- Severity: S4
- Flow / case: F01 / F01-E2
- Screen: S04
Steps
1. Carros → any brand, type 2,000 characters with no spaces.
Expected: the empty state, page stays 390px wide.
Actual: horizontal scroll, page 17,518px wide.
Evidence: `replica/bugs/F01-E2b-long-query.png`; test `F01-E2b`
Suspected cause: the empty state repeats the whole query and nothing breaks it.
Status: fixed. The query shown is cut at 40 characters and long words wrap.

### BUG-005: period buttons are 40px tall, under the 48dp minimum in components.md
- Severity: S4
- Flow / case: F02 / F02-E3
- Screen: S06
Evidence: test `A11Y-S05` ("small target 89x40: 6 meses")
Status: fixed. 48px.

## To check (not reproduced)
- Picking brand A, going back and picking brand B while A is still loading could let A's late answer fill B's list. The fake data layer answers in order, so it could not be reproduced. Guard against it in the Expo app (ignore answers for a step that is no longer current).
- On real devices: whether TalkBack and VoiceOver announce the price card in a sensible order.
