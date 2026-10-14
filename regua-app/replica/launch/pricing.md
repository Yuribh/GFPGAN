# Pricing: Régua

Prices below were read on **2026-10-13** from public pages. They change, so recheck before launch. This is a proposal: the numbers depend on your costs (data source, push, store fees), which I do not know.

## What others charge

| app | model | price (BRL unless noted) | source |
| --- | --- | --- | --- |
| PrecifiCAR (the original) | free plan plus "Plus" subscription | Plus R$ 29 per month on its site, R$ 29,90 per month in the App Store. The App Store also lists "ECVPremium" at R$ 69,90 | [site](https://precificar.app), [App Store](https://apps.apple.com/br/app/id857096045) |
| Tabela FIPE: Consultar Veículo | free plus subscriptions and one-off query packs | App Store lists weekly R$ 4,90 and R$ 5,90, monthly R$ 9,90 and R$ 11,90, yearly R$ 36,90 and R$ 69,90, and packs from R$ 27,99 to R$ 90,90. The page does not say which price belongs to which plan | [App Store](https://apps.apple.com/br/app/tabela-fipe-consultar-ve%C3%ADculo/id1598601141) |
| Car Ad - Tabela FIPE | free plus voluntary "contribution" purchases | US$ 0.99, 1.99 and 2.99 (US listing) | [App Store](https://apps.apple.com/us/app/id681235771) |

The original's paid plan mainly sells plate lookup, full evaluation and ad removal to dealers. Régua leaves plate lookup out (it needs paid data you would have to license), so it should not be priced like the original.

## What reviewers said about price and billing

From `feedback.md`: **1 review, 1 source (thin)**: a paid feature (price forecast) stopped showing after the user paid ("Achei que pagando seria todo mês atualizado."). One review is not a trend, but the lesson is cheap to apply: never take away something a person paid for.

## The model

Free forever for lookups, no account. Money comes from a banner ad on the free plan and a low-priced plan that removes it. Two tiers, named by who they are for:

| tier | for | price | what it includes |
| --- | --- | --- | --- |
| **Consultar** | anyone checking a price | R$ 0 | lookup by type, brand, model and year, price history chart, share, favorites on the device, one banner ad, no pop-ups ever |
| **Acompanhar** (Plus) | people who follow a few vehicles every month | **R$ 9,90 per month** or **R$ 99 per year** (two months free) | everything in Consultar, no ads, favorites saved to your account across devices, alert when the new table is published (these two need accounts, which are planned but not built yet) |

Why these numbers: R$ 9,90 matches the monthly price listed by a comparable lookup app and sits well under the original's R$ 29. It is a guess about willingness to pay, not a tested price. A yearly price at ten times the monthly is the usual two-months-free.

## Billing rules (built into the product)

- Cancel in one tap from Settings, and also through the store, with no emails to write.
- A reminder before each yearly renewal.
- Nothing already paid for is removed or moved to a higher tier.
- The price shown always comes from the store at the moment of purchase, never hard-coded in the app.
- Free users never hit a paywall for the lookup itself.

## Your running cost to cover
The FIPE data provider's free tier is too small for a full monthly load, so plan on its paid plan: R$ 49 a month, listed as R$ 59 for new subscribers (fipe.api.br/pricing, read 2026-10-13). Add Supabase and store fees. At R$ 9,90 and before store fees, that is roughly 6 subscribers to cover the data alone.

## To create (you do this)

Both stores require in-app purchase for digital subscriptions, and the architecture uses RevenueCat on top.
- App Store Connect and Google Play Console: subscription group "Régua Plus" with `plus_monthly` (R$ 9,90) and `plus_yearly` (R$ 99,00).
- RevenueCat: one entitlement `plus` attached to both products.
- Both stores take a share of each sale (commonly 15% for small developers in their reduced-fee programs, up to 30% otherwise; check the current terms), so the net per subscriber is lower than the list price.

## Open questions for you

1. R$ 9,90 confirmed by you on 2026-10-13.
2. Do you want a dealer tier later (for example for people who check many vehicles a day)? Not included now because it would rest on plate lookup or market data you do not have.
