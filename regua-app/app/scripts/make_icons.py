#!/usr/bin/env python3
# Usage: pip install cairosvg && python3 scripts/make_icons.py assets
# Generates the Valor do Carro icon set from one symbol: a measuring line with three ticks, the middle one taller.
import sys, os, cairosvg
out = sys.argv[1]
ORANGE, WHITE = '#b5420c', '#ffffff'

def symbol(color, cx=512, cy=512, scale=1.0, stroke=64):
    # geometry in a 1024 box, centred; baseline under the ticks
    s = scale
    x0, x1 = cx - 240*s, cx + 240*s
    base = cy + 144*s
    ticks = [(cx - 160*s, base - 144*s), (cx, base - 288*s), (cx + 160*s, base - 144*s)]
    w = stroke*s
    lines = [f'<line x1="{x0}" y1="{base}" x2="{x1}" y2="{base}"/>'] + \
            [f'<line x1="{x}" y1="{base}" x2="{x}" y2="{top}"/>' for x, top in ticks]
    return f'<g stroke="{color}" stroke-width="{w}" stroke-linecap="round" fill="none">{"".join(lines)}</g>'

def svg(body, w=1024, h=1024, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{rect}{body}</svg>'

def png(name, data, size=None):
    cairosvg.svg2png(bytestring=data.encode(), write_to=os.path.join(out, name), output_width=size, output_height=size)

files = {
    # iOS + store icon: full bleed, no transparency
    'icon.png': svg(symbol(WHITE), bg=ORANGE),
    # Android adaptive: symbol inside the 66% safe zone, background colour comes from app.json
    'adaptive-icon.png': svg(symbol(WHITE, scale=0.62)),
    'adaptive-icon-mono.png': svg(symbol(WHITE, scale=0.62)),
    # splash: white symbol, the orange background is set in app.config.js
    'splash-icon.png': svg(symbol(WHITE, scale=0.9)),
    'favicon.png': svg(symbol(WHITE, scale=1.15, stroke=80), bg=ORANGE),
}
for name, data in files.items():
    png(name, data, 48 if name == 'favicon.png' else 1024)

# vector sources for the landing page and future designers
brand = os.path.join(out, 'brand'); os.makedirs(brand, exist_ok=True)
open(os.path.join(brand, 'symbol.svg'), 'w').write(svg(symbol(ORANGE)))
open(os.path.join(brand, 'icon.svg'), 'w').write(svg(symbol(WHITE), bg=ORANGE))
wordmark = (f'<svg xmlns="http://www.w3.org/2000/svg" width="820" height="160" viewBox="0 0 820 160">'
            f'<g transform="translate(-48,-56) scale(0.25)">{symbol(ORANGE)}</g>'
            f'<text x="200" y="112" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="88" font-weight="700" fill="{ORANGE}">Valor do Carro</text></svg>')
open(os.path.join(brand, 'logo.svg'), 'w').write(wordmark)
# 1200x630 social image
og = svg(symbol(WHITE, cx=600, cy=230, scale=0.55) +
         '<text x="600" y="430" text-anchor="middle" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#fff">Valor do Carro</text>'
         '<text x="600" y="510" text-anchor="middle" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="40" fill="#fdeee3">Preço FIPE sem cadastro e sem pop-up</text>',
         w=1200, h=630, bg=ORANGE)
cairosvg.svg2png(bytestring=og.encode(), write_to=os.path.join(brand, 'social-1200x630.png'), output_width=1200, output_height=630)
cairosvg.svg2png(bytestring=svg(symbol(WHITE), bg=ORANGE).encode(), write_to=os.path.join(brand, 'play-store-icon-512.png'), output_width=512, output_height=512)
print('ok')
# 1024x500 feature graphic for the Google Play listing
fg = svg(symbol(WHITE, cx=230, cy=200, scale=0.62) +
         '<text x="410" y="230" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="78" font-weight="700" fill="#fff">Valor do Carro</text>'
         '<text x="412" y="295" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="34" fill="#fdeee3">Preço FIPE sem cadastro</text>'
         '<text x="412" y="342" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="34" fill="#fdeee3">e sem pop-up</text>',
         w=1024, h=500, bg=ORANGE)
cairosvg.svg2png(bytestring=fg.encode(), write_to=os.path.join(out, '..', 'store', 'feature-graphic-1024x500.png'), output_width=1024, output_height=500)
