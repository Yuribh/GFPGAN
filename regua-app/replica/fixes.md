# What to fix, and how to position it

**Sample size: 7 reviews from 2 sources (Google Play 3, App Store 4), 6 with usable text on the topic.** The skill asks for 100+ across at least three sources. This is far below that, so everything here is a **direction to verify, not a ranking**. How the sample was collected and why it is small:
- App Store's official reviews feed is blocked for automated reads by its robots rules, so I did not use it.
- Google Play shows 3 reviews on the public page, and App Store's page shows 4. Some are cut off in what I could read, and I quote only the text I actually saw.
- Review sites (Reclame Aqui, Reddit, Trustpilot) returned nothing about this app in two searches.
- Per-review links do not exist on these pages, so each quote links to the page it was read on.
- The star rating was not visible per review, so ratings are blank except one reviewer's own "Vou dar 4".

To get to 100+, someone has to read the Play and App Store review lists in a browser, newest first, and paste rows into `reviews.csv` (about 30 minutes). Then rerun `python3 ~/.claude/skills/replica-entrepreneur/reviews.py replica/reviews.csv --out replica/feedback.md`.

## 1. What they hate (all thin)

| problem | reviews | sources | quote |
| --- | --- | --- | --- |
| Too many ads and pop-ups that get in the way | 1 | 1 | "Muito ruim, muita propaganda, pop-ups e etc que não deixa usar o app." ([Play](https://play.google.com/store/apps/details?id=br.com.mobilesolution.fipe&hl=pt_BR&showAllReviews=true)) |
| Signup became required, and free no-signup alternatives exist | 1 | 1 | "Há outros SEM CADASTRO, como o CarPlus, com as mesmas funcionalidades anteriores e GRATUITOS" ([Play](https://play.google.com/store/apps/details?id=br.com.mobilesolution.fipe&hl=pt_BR&showAllReviews=true)) |
| App stops opening or freezes after updates | 2 | 1 | "Sempre pude deixar alguns carros no favoritos e ir acompanhando todo mês depois da última atualização ele não abriu mais." and "A ideia é boa, mas no iPhone ele esquenta o aparelho e trava" ([App Store](https://apps.apple.com/br/app/id857096045?see-all=reviews)) |
| A paid feature (price forecast) stopped showing | 1 | 1 | "Pra mim a previsão de preço já não está mais aparecendo! Achei que pagando seria todo mês atualizado." ([App Store](https://apps.apple.com/br/app/id857096045?see-all=reviews)) |

Corroborating evidence that is **not reviews** (product facts, so not counted in the sample):
- Google Play lists the app at **3.7 stars (the page shows about 849 reviews)** and the App Store at **4.8 (about 43K ratings)**. The gap fits the ads and signup complaints being a mostly-Android problem, but this is an inference from two numbers.
- The Play "What's new" and App Store version history show repeated fixes for chart not displaying, push notifications, Mercosul-plate keyboard and crashes, which matches the stability complaints.
- AppGoblin lists three ad/messaging SDKs in the app: Google, OneSignal and AdMob.
- I also read, in the Play listing summary, a developer reply to a signup complaint suggesting people who only want the table uninstall. I could not quote it verbatim, so it is not used as evidence.

## 2. What is missing (by name)

Nothing requested by name in this sample. One reviewer says "faltam algumas coisas" but the text is cut off before saying which. Do not invent requests.

## 3. What is unsolved

Cannot be judged from 7 reviews. One hypothesis from the product itself, to test: the paid plan sells plate lookup and full evaluation to dealers, while people who only want the FIPE price get ads and a signup wall. Worth asking 5 to 10 real users before betting on it.

## Fix plan (candidate fixes, each rests on thin evidence)

| # | fix | size | skill | evidence |
| --- | --- | --- | --- | --- |
| 1 | Look up a price with **no signup**; ask for an account only when saving favorites or alerts | S | replica-backend, replica-build | 1 review (thin), plus the original's own mandatory signup |
| 2 | **Banner-only ads**, never pop-ups or interstitials, none while typing or reading a price | S | replica-build | 1 review (thin) |
| 3 | **Reliability first**: cache the last result for offline, test favorites after every update, keep the app light so it does not heat the phone | M | replica-build, replica-test | 2 reviews, 1 source (thin) and the changelog fixes |
| 4 | **Be clear about what is paid**: never remove something a user paid for; show the free vs paid line before purchase | S | replica-launch | 1 review (thin) |

Rows added to `features.csv` with `original` set to `no`.

## The angle (three options)

1. **Just the FIPE price, no signup, no pop-ups.** For people who only want to check what a car is worth and are tired of signup walls and pop-ups, this app does that and nothing else. Evidence: ads (1 review), mandatory signup (1 review), 2 sources. Thin.
2. **The FIPE app that does not break.** For people who track a few vehicles every month and lost their favorites to a broken update, this app keeps your list and works offline. Evidence: crashes and freezes (2 reviews, 1 source) plus the changelog. Thin.
3. **Price tracker for small dealers who hate paying for what they already used.** Unsupported by this sample. Needs interviews.

**Recommendation: option 1, with option 2 as the promise inside it.** It is the cheapest to build, it matches your architecture (a lookup that needs no login), and the two sources agree on direction even though neither is large. Treat it as a hypothesis until the sample reaches 100+.

Rules to keep: do not put the original's name in your app name, store listing or ads, and do not use reviewers' words as testimonials. Whether a comparison page is allowed is a question for a lawyer in your country.
