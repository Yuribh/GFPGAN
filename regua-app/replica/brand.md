# Brand: Régua

Date: 2026-10-13. Angle from `fixes.md`: *the FIPE price, no signup, no pop-ups, and it does not break.* That angle rests on a small sample (7 reviews), so the name and voice below are a proposal, cheap to change before launch.

## 1. The name

Twenty candidates, cut to five. Rules used: not close to "PrecifiCAR", "iFipe" or other apps in the category in sound, look or meaning; short; no "-CAR" or "Preci-" twin; **no "FIPE" in the name** (it is the name of the institute that publishes the table, so I did not use it as part of a brand. Whether you may use it descriptively is a question for a lawyer).

Considered: Cotaí, Régua, Valor Direto, Quanto Vale, Preço Limpo, Valú, Aferi, Bússola, Cotar, Tabelo, Preço Justo, CotaFácil, ValorCarro, Balança, Avalia, Checa, PreçoJá, Meu Valor, Vale Quanto, Placar.

| # | name | idea | note |
| --- | --- | --- | --- |
| 1 | **Régua** | a ruler: the simple tool you measure a price with | short, one word, suggests "just measures", fits the no-frills angle |
| 2 | Valor Direto | "straight to the value" | says the angle outright, but descriptive and harder to protect |
| 3 | Cotaí | "quote it", casual Brazilian speech | a web search found "Citaí" (a quotes and proposals app), one letter apart and close in sound. Dropped as the lead |
| 4 | Preço Limpo | "clean price", no clutter | cute, weaker on cars |
| 5 | Quanto Vale | "how much is it worth" | very generic, crowded category, hard to own |

**Recommendation: Régua.** Backup: Valor Direto.

## 2. Checks (screening only, not legal clearance)

Only the web search row was run. Everything else is **to run**, and I will not call any name "available" until someone does.

| check | Régua | Valor Direto | Cotaí |
| --- | --- | --- | --- |
| Brazil trademark, INPI (busca.inpi.gov.br), classes 9, 42 | to run | to run | to run |
| US trademark (tmsearch.uspto.gov) | to run | to run | to run |
| EU (euipo.europa.eu eSearch or TMview) | to run | to run | to run |
| WIPO Global Brand Database | to run | to run | to run |
| domain (.com.br, .app, .com) | to run | to run | to run |
| App Store and Play, exact name | to run | to run | to run |
| handles (X, Instagram, TikTok, GitHub) | to run | to run | to run |
| web search "name + app + carro" | run 2026-10-13: no app by that name surfaced in the first 10 results, not conclusive | run 2026-10-13: no exact match, FIPE-lookup competitors only | run 2026-10-13: "Citaí" found, one letter apart |

Notes: "Régua" is a common word, so expect many unrelated uses; the risk is in the same classes (apps and software). The accent matters: store and domain searches should cover both "Régua" and "Regua". Do a proper INPI search first, since this is a Brazil-first product.

## 3. Palette

The original's signature teal (measured `#325e5d` and `#417d7d` from the screenshot) is in `brand.json` so the sweep catches it. The new primary is a burnt orange, a different hue family. Same token roles as `design/tokens.json`; only the values changed.

| role | value | note |
| --- | --- | --- |
| accent | `#b5420c` | buttons, links, selected tab, chart line |
| on-accent | `#ffffff` | 5.6:1 on accent |
| accent-soft | `#fdeee3` | tool circles, soft fills |
| bg / surface | `#f2f2f2` / `#ffffff` | unchanged |
| text / text-muted | `#292929` / `#5b6470` | unchanged |

`python3 contrast.py design/tokens.json`: **16 pairs, 0 failing AA** (accent on bg 5.0:1, accent on accent-soft 4.9:1).

## 4. Logo brief (not a logo)

- **Idea:** one clean measuring line, "the price, measured". Simple, calm, exact.
- **Mark type:** wordmark "Régua" plus a small symbol: a horizontal line with three tick marks, the middle one taller. Lowercase-friendly, no car silhouette.
- **Must work at:** 16px favicon (just the tick symbol) and a 1024px app icon.
- **Colours:** burnt orange `#b5420c` on white, and white on orange for the icon.
- **Deliverables:** SVG (symbol, wordmark, both), app icon 1024x1024 with no transparency for iOS, Android adaptive icon (foreground and background), favicon set, social image 1200x630.
- **Must not resemble the original's mark.** Put the original's logo next to every draft: no shared letterform trick, no wide-spaced capitals with a two-tone split, no teal and grey pair.

## 5. Voice

Three words, each with what it does not mean:
- **Direto, não seco.** Short answers, but never cold.
- **Claro, não técnico.** Say "preço do mês", not "valor de referência da tabela".
- **Leve, não bobo.** Calm and friendly, no jokes about money or cars.

Do and don't:

| do | don't |
| --- | --- |
| "Sua lista está vazia." | "Ops! Nada por aqui 😅" |
| "Não deu para carregar a lista." | "Erro 500: falha na requisição" |
| "Confira sua conexão e tente outra vez." | "Algo deu errado. Tente novamente mais tarde." |
| "Tabela de outubro de 2026" | "Mês de referência: 10/2026" |
| "Sem cadastro, sem pop-up." | "Experiência premium sem interrupções" |

Strings already rewritten in the prototype, all fresh and none echoing the original:
1. Name in header: "Régua"
2. Home heading: "Qual veículo você quer consultar?"
3. Empty favorites: "Sua lista está vazia." and "Abra um preço e toque em Favoritar para acompanhar aqui."
4. Load error: "Não deu para carregar a lista." and "Confira sua conexão e tente outra vez."
5. Retry button: "Tentar outra vez"
6. About: "Régua mostra o preço da tabela FIPE, sem cadastro e sem pop-up."
7. Price footnote: "Dados de exemplo, não são valores reais da tabela FIPE." (remove at launch)

Still to write when those screens exist: sign up, confirmation after subscribing, push notification text, store listing.

## 6. The sweep

`python3 ~/.claude/skills/replica-brand/sweep.py app --config replica/brand.json` → **clean** (checked `app/` and `replica/design/`). I also proved the sweep works by planting a leftover name and colour in a temp file, which it caught. Not yet checked by eye, because they do not exist yet: favicon, page titles in the store, email templates, OG image, app icon.

Avoid list (`brand.json`): PrecifiCAR, Precificar, iFipe, Itaquera, Loovi, mobilesolution, IT Tech; domains precificar.app, mobilesolutions.com.br, itaquera.tech; colours #325e5d, #417d7d.

Note: the prototype still shows the 4 tool names "Buscar veículo, Histórico, Favoritos, Comparar", which are generic. The "Seguro Loovi" partner tile was never built.
