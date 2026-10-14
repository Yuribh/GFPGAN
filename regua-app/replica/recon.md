# Recon map: PrecifiCAR, ex iFipe (Android, iOS)

Scope: FIPE price lookup + price history. Core loop only: pick a vehicle, see its FIPE price, track it over time, get alerted when the table updates. Plate lookup, IPVA, score, consultant search and the paid "full evaluation" are out of this slice.
For: a product to sell. Likely buyers: car dealers and resellers who negotiate by WhatsApp.
Date: 2026-10-13

**Evidence level.** This map comes from public text only: the Play and App Store listings, the product site, the terms of use, the privacy policy and public FIPE API docs. One screenshot has been read (S03 home, `screens/S03-home.jpg`). Everything else is **inferred** from the feature list and marked as such. Before `/replica-design` and `/replica-build`, add screenshots to `replica/screens/` (the six on the Play page, or ones from your own device) and confirm each row.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Play Store listing | https://play.google.com/store/apps/details?id=br.com.mobilesolution.fipe | feature list, what's new, rating 3.7, 100K+ downloads, contains ads, last updated 2026-10-09 |
| 2 | Product site | https://precificar.app | positioning, plans, evaluation tiers (Basic, Complete, Blindado) |
| 3 | Terms of use | http://precificar.app/termos-de-uso/ | no clause against competing products or reuse of displayed info found (s.1.5, s.3.1); no scraping clause; billing only via Apple/Google |
| 4 | Privacy policy | https://precificar.app/politica-de-privacidade/ | collects account data, IP and access logs, location, cookies for analytics and ads. Names no data providers and no ad SDKs. Users can request access, correction, deletion by email |
| 7 | App Store listing | https://apps.apple.com/br/app/id857096045 | 4.8 stars from about 43K ratings (vs 3.7 on Play), iOS 15.6+, subtitle "Tabela FIPE e Preço de Carro", IAP Plus R$29,90 and ECVPremium R$69,90, version history through 3.1.62 |
| 5 | Public FIPE API docs (community) | https://www.tabnews.com.br/dedx/guia-completo-da-api-fipe-como-consultar-precos-de-veiculos-no-brasil | reference month, type, brand, model, year, price hierarchy; secondary source, verify against the official docs |
| 6 | Play reviews | same as #1 | complaints about ads, pop-ups and mandatory signup after the rebrand. Full reading belongs to `/replica-entrepreneur` |

Reference screenshots: 1 of about 13 (S03).
Not yet used: public walkthrough videos, the user's own account (not provided).

## Core loop

Look up a vehicle's FIPE price by brand, model and year, watch how it moves month to month, and get notified when the new table lands.

## Update 2026-10-13: what the App Store listing adds

The iOS listing and its version history show features the Play text did not, and they sit close to the core loop:
- **Full-screen chart and easier interval selection** (3.1.62): confirms S06 has selectable ranges.
- **Price forecast** next to price evolution.
- **Side-by-side comparison of several vehicles** (3.1.50).
- **Search history** (3.1.46) and **state-based price radar** (3.1.44).
- **Market Calculator** (3.1.52): min, average, max price from similar listings, filtered by mileage, auction status, armored status and condition. Proprietary market data, so it goes out of scope (see features.csv).
- **Pay-per-query credits with PIX** (3.1.46, 3.1.58): queries seem to be sold as credits, which explains the ECVPremium tier. Monetization is more than one subscription.
- **Price gap:** Plus is R$29 on the site, R$29,90 on the App Store. Store prices may differ by platform, treat R$29 to R$30 as the range.
- **Ratings gap:** 4.8 on iOS against 3.7 on Android. Worth reading the Android complaints (ads, pop-ups, mandatory signup) in `/replica-entrepreneur`.
- Age rating A12 on iOS and "contains ads" on both stores.

New screens implied (inferred, add as S14 to S16 once confirmed): vehicle comparison, search history, state price radar.

## Update 2026-10-13 (screenshot): what the home screen shows

Seen on `screens/S03-home.jpg` (Android, logged in, 0 credits):
- **Bottom tabs are only three: Home, Favoritos, Sobre.** My earlier guess of separate ranking and settings tabs was wrong. Ranking, history and the rest sit in the tools grid or behind it.
- **Header:** logo, a **coin counter** (0) and an avatar with the user's initials. This confirms the credits model (pay-per-query) and that an account is required.
- **Search card:** a plate field is the first thing on screen, with a Mercosul sample (ABC1C34) and an old-format sample (ABC 1234). Vehicle search by type (Caminhões, Motos, Carros) comes second. For the FIPE slice, the type tiles are the entry point.
- **Tools grid "Ferramentas" (8 items, "Ver todas" opens more):** Buscar Veículo, Comparar Preços, Histórico, Seguro Loovi, Consulta Veicular, Histórico PrecifiCAR, Card de Venda, Consultor Automotivo.
  - **Seguro Loovi** is a partner insurance tile (affiliate). Partner deal, not cloneable.
  - **Histórico PrecifiCAR** has a red siren icon and likely means occurrences or alerts (guess). **Histórico** is likely search history (guess).
  - **Card de Venda** is a sales card for sellers (guess: shareable ad card).
- **Ad:** Google banner at the bottom of the home, above the tab bar. Style: teal and white, rounded cards, outlined icons in circles, grey background.

Screens implied and still unseen: tools list ("Ver todas"), Comparar Preços, Histórico, Card de Venda, credits purchase.

## Screens (all inferred, confidence medium unless noted)

| ID | screen | route / how to reach | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Splash / onboarding | first launch | intro, signup prompt (signup became mandatory after the rebrand, per a review) | logo, CTA, auth buttons | first run |
| S02 | Sign up / sign in | from S01 | account creation | form, social login (guess) | empty, error |
| S03 | Home | tab 1 (Home) | plate search, vehicle search by type, tools grid | header with logo, credit coin counter and avatar with initials; teal search card with plate field (Mercosul and old plate samples) and search button; "Buscar por veículo" with 3 tiles (Caminhões, Motos, Carros); "Ferramentas" grid with "Ver todas"; Google banner ad; bottom tab bar | filled, ad shown, 0 credits **(seen)** |
| S04 | Pick vehicle | from S03 | choose brand, then model, then year | list with search, step header | loading, empty search, error |
| S05 | Vehicle result | after S04 | FIPE price, reference month, FIPE code, fuel | price card, favorite button, share button, tabs | loading, error, price not found |
| S06 | Price history | tab on S05 | evolution chart across months | line chart, range selector | loading, chart failed (a recent bug fix), few data points |
| S07 | Technical sheet | tab on S05 | specs | key-value list | missing data |
| S08 | Favorites | tab | saved vehicles, current price and change | list, swipe or remove | empty, filled |
| S09 | Most-searched ranking | tab or home section | popular vehicles | ranked list | loading |
| S10 | Share sheet | from S05 | send via WhatsApp and social | OS share sheet, formatted text | n/a |
| S11 | Notifications | OS push | "FIPE table updated" | push, in-app list (guess) | permission denied |
| S12 | Settings / account | tab | profile, notifications, plan, privacy, delete account | list, toggles | free, subscribed |
| S13 | Subscription paywall | from ad-free or locked items | Plus plan, R$29/month | plan card, store billing sheet | free, subscribed |

Left out on purpose (outside the chosen slice): plate search, vehicle score, IPVA lookup, expert opinion, regional reports, local consultant search, full evaluation tiers, ad creation for sellers, occurrence alerts.

## Flows

```
F01 Look up a FIPE price
    S03 -> S04 (brand -> model -> year) -> S05
    happy path clicks: about 4 taps plus search typing (inferred)
    edge: model with no price in that year, API timeout, reference month changes mid-session

F02 See price history
    S05 -> S06
    happy path clicks: 1
    edge: chart fails to render (recent fix), vehicle with a single month of data

F03 Favorite a vehicle and get alerted
    S05 -> favorite -> S08; later push (S11) -> S05
    edge: notifications denied, vehicle removed from the table

F04 Share a price
    S05 -> S10 -> WhatsApp
    edge: no WhatsApp installed

F05 Sign up (mandatory)
    S01 -> S02 -> S03
    edge: existing email, social login cancelled
```

## Components (inferred)

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost | default, pressed, disabled, loading | all |
| Vehicle type tiles | Caminhões, Motos, Carros (seen) | default | S03 |
| Plate search field | Mercosul and old format samples (seen) | empty, error | S03 |
| Credit coin counter | header (seen) | zero, positive | all |
| Tool tile | icon in circle plus label, partner variant for Loovi (seen) | default | S03 |
| Bottom tab bar | Home, Favoritos, Sobre (seen) | selected, unselected | all |
| Searchable list | brand, model, year | loading, empty, filled | S04 |
| Price card | big price, delta vs last month | loading, error | S05, S08 |
| Line chart | 6, 12, 24 months (guess) | loading, failed, sparse | S06 |
| Favorite toggle | heart | on, off | S05, S08 |
| Banner ad | free plan only, Google-served (seen) | loaded, failed, closed | S03, S05 |
| Interstitial ad | free plan only | shown, dismissed | between steps (reviews mention pop-ups) |
| Paywall card | monthly | default, loading | S13 |
| Push notification | table updated | n/a | S11 |

## Inferred data model

```
ReferenceMonth  code, month, year
                evidence: public FIPE API /references
                confidence: high

VehicleType     cars | motorcycles | trucks
                evidence: public FIPE API, listing ("carros, motos e caminhões")
                confidence: high

Brand           id, vehicle_type, name
Model           id, brand_id, name
ModelYear       id (e.g. "2020-1" = year + fuel), model_id, fuel
                evidence: public FIPE API; S04
                confidence: high

PricePoint      codeFipe, model_year_id, reference_month, price_brl
                evidence: public FIPE API price response; S05, S06
                confidence: high

User            id, email, auth_provider, created_at, plan (free | plus), credits_balance
                (credits counter seen in the S03 header)
                evidence: mandatory signup (review), plans on precificar.app
                confidence: medium

Favorite        user_id, codeFipe, model_year_id, created_at
                evidence: listing "Favorite vehicles"
                confidence: medium

DeviceToken     user_id, token, platform, notifications_enabled
                evidence: listing "notifications when the FIPE table is updated"
                confidence: medium

Subscription    user_id, store (apple | google), status, renews_at
                evidence: terms (billing only via Apple/Google, monthly auto-renew)
                confidence: medium
```

Relationships: ReferenceMonth 1-n PricePoint; VehicleType 1-n Brand 1-n Model 1-n ModelYear 1-n PricePoint; User 1-n Favorite; User 1-n DeviceToken; User 1-1 Subscription.

## Feature matrix

See `features.csv`. Must: 10, should: 13, could: 8, skip: 10.

## Out of scope (cannot or should not be cloned)

- **Plate lookup, vehicle history, occurrences, score, IPVA by plate.** These depend on paid data from vehicle-data providers (Detran-style databases, credit bureaus). The original's providers are not named in the terms. This is their data deal, not a feature you can rebuild from the UI. If you want it later, license your own provider.
- **"Expert opinion" and market-range pricing beyond FIPE** (prices from classifieds and banks). Proprietary aggregation. Could be rebuilt with your own sources, but it is not a clone.
- **The PrecifiCAR brand, name, logo, the iFipe history, copy and news articles.** Rebrand is mandatory (`/replica-brand`).
- **The ranking's real search data.** "Most searched" reflects their user base. Yours starts empty.
- **FIPE data itself is not theirs.** It comes from the Fundação Instituto de Pesquisas Econômicas. Public APIs resell or cache it. Check the FIPE and API terms before commercial use, and prefer your own cache refreshed monthly.

## Size

Screens 13 (9 in the core slice), flows 5, entities 8. Hard parts:
1. Reliable FIPE data source and legal footing for selling a product on top of it (monthly refresh job, cache, fallback).
2. Price history chart with monthly backfill (the data must be collected, the API only gives one month at a time).
3. Push notifications timed to the monthly table update.

Size: **M** (a few weeks) for the core slice. **L** if plate lookup is added later, mostly because of data licensing, not code.

## Open questions for you

1. Do you have access to the app on a phone? Screenshots of each screen (especially S04, S05, S06) would raise most rows from "inferred" to "seen".
2. Do you want comparison, search history and the state radar in the first version? They are cheap once S05 exists.
3. Which free vs. paid line do you want? In the original, free is mainly plate lookup and Plus removes ads. FIPE lookups look free.
