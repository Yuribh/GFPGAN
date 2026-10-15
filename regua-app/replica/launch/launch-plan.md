# Launch plan: Régua

Everything here is a plan. Nothing has been set up, posted or sent. Sample size behind the angle is small (7 reviews), so the plan starts by testing the angle with real people before spending on a launch.

## Before launch (blockers, in order)
1. **Trademark screening for "Régua"**: INPI first (classes 9 and 42), then the other checks in `brand.md`. Do not buy a domain or icon before this.
2. **Legal read**: a lawyer in Brazil should look at (a) using "FIPE" descriptively in the listing and landing, (b) the terms of the data source you pick, and (c) the privacy policy under LGPD.
3. **Data source**: confirm commercial terms in writing (see the first risk in `architecture.md`).
4. **Build the real app**: the web prototype is only a prototype. Needs the Expo app (blocked on npm access), real data and the backend.
5. **Waitlist**: the landing page has no signup form on purpose, because there is nowhere to store addresses yet. Add one with a provider that fits LGPD before sending traffic.
6. **Analytics and error tracking** live before the first user: lookups per day, share of sessions that reach a price, crashes. Keep it minimal and say so in the privacy policy.

## Store prep
- Screenshots at the sizes each store requires at upload time (they change; check App Store Connect and Play Console). Use the real app, not mockups, and make the fixes visible: a price screen with no signup and no pop-up.
- Privacy labels and the data safety form: they must match what the ad SDK collects.
- Privacy policy and support URLs, age rating, a review note explaining that lookups need no account.
- Apple 4.1 (copycats): the first lines of the description already lead with what is different.

## Where the original's unhappy users are
My searches for Reddit and review-site threads about this app found nothing. So this is a to-do for a person, not a finding:
- Read the newest reviews on the original's Google Play and App Store pages (the same ones the research could not fully read).
- Search Brazilian communities for car buying and selling, used-car dealers and car enthusiasts for "tabela FIPE app" and note what people complain about.
Do not post asking people to switch from a named app.

## First 10 users, by hand
Talk to ten people who check FIPE prices at least monthly: a few small used-car sellers, a few people shopping for a car. Ask what they open today, what annoys them, and watch them use the prototype. This tests the angle (no signup, no pop-ups) and the price (R$ 9,90) before more is built.

## Launch posts
- A short post in relevant Brazilian communities that leads with the fix: "o preço FIPE sem cadastro e sem pop-up", with a screenshot. No attacks on named apps.
- Product Hunt and Hacker News are English-language and the product is Brazil-first, so they are low priority.

## What not to do
- No invented testimonials, user counts or ratings, and no reviewer quotes on the page.
- No original's name in the app name, listing, keywords or ads.
