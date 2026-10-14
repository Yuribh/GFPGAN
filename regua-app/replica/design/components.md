# Components (from recon S03 home screenshot plus inferred states)

Source: `screens/S03-home.jpg`, Android. Measurements are dp (about 2.25 screenshot px per dp). Everything is written fresh: open icons (Lucide), own labels, neutral accent. The original's teal, logo, coin icon and partner tiles are not used.

Rows marked **(seen)** come from the screenshot. Others are inferred from the recon and need confirming against more screens.

## Button  (inferred)
- variants: primary, secondary, ghost, danger. sizes: md 48dp (touch target), sm 40dp
- states: default, pressed, focus-visible (2dp ring `accent`), disabled, loading (keeps the label for screen readers)
- tokens: bg `accent`, text `on-accent`, radius `md`, type `base/600`
- a11y: `accessibilityRole="button"`, minimum 48dp target
- used on: S02, S13

## Vehicle type tiles  (seen)
Three equal tiles in one white card (Caminhões, Motos, Carros), thin dividers between them, icon over label.
- card: bg `surface`, radius `lg` (original about 16 to 20dp), inner padding `space-3`
- tile: icon 28dp, label `base`, text `text-muted`
- states: default, pressed (bg `surface-muted`), selected (icon and label `accent`)
- a11y: each tile is a button with the full label ("Carros"), not just an icon
- used on: S03

## Plate search field  (seen)
Search card at the top of home with plate samples (Mercosul and old format) and a round search button.
- field: height 56dp, radius `lg`, text `base`, placeholder `text-muted`
- search button: 48dp circle, bg `surface`, icon `accent`
- states: empty, focused (2dp ring), invalid plate (border `danger` plus message), loading
- input rules: uppercase, accepts ABC1D23 and ABC1234, strips the hyphen; fix the Mercosul keyboard issue the original shipped a bug fix for
- out of the first slice (plate lookup is out of scope), keep the component so the slot is ready. Use our own plate illustration, not the original's.
- used on: S03

## Tool tile  (seen)
Icon in a 72dp circle, two-line label under it. Four per row, "Ver todas" opens the full list.
- circle: bg `accent-soft`, icon `accent` 28dp
- label: `sm`, centered, max two lines, `text-muted`
- row gap about 24dp, column count 4 (3 on narrow phones under 360dp)
- states: default, pressed, disabled (when a tool needs signup)
- a11y: whole tile is one button; label is the accessible name
- used on: S03

## Section header with link  (seen)
"Ferramentas" left (`lg/600`, `text`), "Ver todas" right (`sm/600`, `accent`).
- a11y: link announces "Ver todas as ferramentas"
- used on: S03

## Header bar  (seen)
Logo left; credit counter and avatar right. Avatar is a 48dp circle with the user's initials on `accent`.
- credit counter: coin icon 40dp plus number `base/600`. Only if you keep pay-per-query credits (recon open question)
- states: logged out (sign in button instead of avatar), zero credits, positive credits
- used on: all main tabs

## Bottom tab bar  (seen)
Three tabs: Home, Favoritos, Sobre. Height 64dp, bg `surface`, icon over label.
- selected: icon and label `accent`; unselected: `text-muted`
- note: the original's unselected grey (#a7a7a7 on white, about 2.3:1) fails WCAG AA. Ours uses `text-muted` (6.0:1).
- a11y: `accessibilityRole="tab"`, selected state announced
- used on: all main tabs

## Banner ad slot  (seen)
Free plan only. Fixed height at the bottom above the tab bar, bg `surface-muted`, labeled "Anúncio" in our own words.
- states: loading (reserve the height so nothing jumps), loaded, failed (collapse), hidden for Plus
- rule: banner only, never interstitials. Pop-ups are the top Android complaint in the reviews.
- used on: S03, S05

## Price card  (inferred)
Big FIPE price, month of reference, FIPE code, fuel, change vs last month.
- price `display/700` `text`; change chip: arrow plus sign plus value (neutral color, never color alone)
- states: loading (skeleton), error with retry, no price for that year
- used on: S05, S08

## Line chart  (inferred)
Monthly price evolution with interval selector (6, 12, 24 months) and a full-screen option.
- line `accent` 2dp, grid `border`, labels `xs` `text-muted`; touch shows a tooltip with month and price
- states: loading, failed (retry), sparse (one or two months: show the points and a note, not an empty chart)
- a11y: a text summary above it ("Subiu 3,2% em 12 meses") and a table view
- used on: S06

## Searchable list  (inferred)
Brand, model and year pickers. Search field on top, sticky letters for long lists.
- row height 56dp, divider `border`, chevron
- states: loading, empty search ("Nenhum resultado"), error with retry
- used on: S04

## Favorite toggle  (inferred)
Heart, 48dp target. on: filled `accent`; off: outline `text-muted`. Announces "Adicionado aos favoritos" or "Removido".
- used on: S05, S08

## Paywall card  (inferred)
Plan name, price from the store (never hard-coded), benefits list, subscribe button, restore purchases link.
- states: default, loading, already subscribed
- used on: S13

## Toast / inline message  (inferred)
Short confirmations ("Favorito adicionado") and errors. Auto-dismiss 4s, never the only way to learn about an error.
