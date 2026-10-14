## Parity: 20.7 / 100

features 23.1  (27 counted, must-haves 0 of 8 done)
layout   11.3  (1 screens compared)

Not shippable yet: 8 must-have features are not done.

## By area, weakest first
- onboarding                     0.0  (1 features)
- notifications                  0.0  (1 features)
- discovery                      0.0  (2 features)
- reports                        0.0  (1 features)
- pricing                        0.0  (1 features)
- settings                       0.0  (1 features)
- navigation                     0.0  (1 features)
- seller tools                   0.0  (1 features)
- monetization                   8.3  (4 features)
- history                       25.0  (3 features)
- favorites                     30.0  (2 features)
- lookup                        38.9  (7 features)
- sharing                       50.0  (1 features)
- privacy                       50.0  (1 features)

## Missing, in build order
- [must] notifications: Push notification when the FIPE table updates, no
- [must] onboarding: Sign up with email or social login, no  (mandatory after the iFipe rebrand per a review)
- [must] favorites: Favorite vehicles, partial  (web prototype only, sample data, stored on the device, no account or sync)
- [must] history: Price evolution chart across months, partial  (needs monthly data collection; web prototype only, sample data)
- [must] lookup: Look up FIPE price by type brand model and year, partial  (core loop; web prototype only, sample data)
- [must] lookup: Search inside brand and model lists, partial  (web prototype only, sample data)
- [must] lookup: Show FIPE code and reference month on the result, partial  (web prototype only, sample data)
- [must] lookup: Switch between cars motorcycles and trucks, partial  (web prototype only, sample data)
- [should] discovery: Ranking of most searched vehicles, no  (starts empty for a new user base)
- [should] favorites: Price change vs last month on favorites, no  (inferred)
- [should] history: Full-screen chart and selectable time interval, no  (added in app version 3.1.62)
- [should] lookup: Compare several vehicles side by side, no  (added in 3.1.50)
- [should] lookup: Technical sheet for a vehicle, no  (source of specs not confirmed)
- [should] monetization: Credit balance shown in the header, no  (seen on home screen)
- [should] monetization: Free plan with ads and paid plan without ads, no  (Plus is R$29 per month in the original)
- [should] navigation: Tools grid on home with See all, no  (seen on home screen)
- [should] lookup: Search history, partial  (added in 3.1.46; web prototype only, sample data)
- [should] privacy: Delete account and data, partial  (backend logic and cascade tested; Edge Function not run, no screen yet)
- [should] sharing: Share a price via WhatsApp and other apps, partial  (web prototype only, sample data, uses the browser share sheet or copies text)
- [could] discovery: State-based price radar, no  (added in 3.1.44; needs your own regional data)
- [could] history: Price forecast, no  (method unknown; only if you can build a model you can defend)
- [could] monetization: Pay per query credits with PIX, no  (seen in version history; check how credits are priced before copying)
- [could] pricing: Market range beyond FIPE, no  (needs your own data sources)
- [could] reports: Regional demand reports by state and city, no  (needs search data you do not have yet)
- [could] seller tools: Sales card for sellers (Card de Venda), no  (seen in tools grid; behavior unconfirmed)
- [could] settings: Dark mode, no  (not confirmed)
- [could] monetization: Subscription via Apple and Google billing, partial  (webhook logic and database tested; store products and app purchase screen not built)

## Left out on purpose (not scored)
- Search by license plate: paid vehicle data provider
- Vehicle history and occurrences by plate: paid vehicle data provider
- Vehicle score lookup: credit or registry data you cannot rebuild
- IPVA lookup by plate: state data plus plate provider
- Local automotive consultant search: their partner network
- Expert opinion: their editorial content
- Basic Complete and Armored evaluations: proprietary valuation method and data
- Ad creation for sellers via WhatsApp: outside the chosen slice
- Market calculator min average max from listings: needs classified listing data you do not own
- Partner insurance tile (Seguro Loovi): their affiliate deal; use your own partner or leave out

## Yours, not in the original (not scored)
- Look up a price without creating an account
- Banner-only ads with no pop-ups or interstitials
- Offline cache of the last viewed prices and favorites
- Show what is free and what is paid before purchase

## Screens
- clone-screens/S03-home.png                11.3
