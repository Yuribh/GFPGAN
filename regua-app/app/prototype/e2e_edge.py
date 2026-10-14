# Edge, negative and accessibility cases for the prototype (test-plan.md IDs in each check).
# Written to state the EXPECTED behaviour; a failure here is a bug to report, not a test to loosen.
import sys, pathlib, re
from playwright.sync_api import sync_playwright
URL = "file://" + str(pathlib.Path("dist/index.html").resolve())
OUT = pathlib.Path("/home/claude/replica/bugs"); OUT.mkdir(exist_ok=True)
results = []
def check(case, cond, msg):
    results.append((case, bool(cond), msg)); print(("PASS " if cond else "FAIL ") + case + " " + msg)

def open_page(b, w=390, h=844, q="", init=None):
    pg = b.new_page(viewport={"width": w, "height": h}); errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    dialogs = []; pg.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    if init: pg.add_init_script(init)
    pg.goto(URL + q); return pg, errs, dialogs

def to_models(pg, brand="Marca Exemplo Alfa"):
    pg.get_by_role("button", name="Carros").first.click()
    pg.get_by_role("button", name=brand).click()

with sync_playwright() as p:
    b = p.chromium.launch()

    # F01-E1 search without accents (most people type "automatico")
    pg, errs, _ = open_page(b); to_models(pg)
    pg.fill("#q", "automatico")
    check("F01-E1", pg.locator(".list li").count() == 1, "search without accents finds 'Automático'")
    pg.fill("#q", "AUTOMÁTICO")
    check("F01-E1b", pg.locator(".list li").count() == 1, "search is case-insensitive")
    pg.fill("#q", "  modelo b  ")
    check("F01-E1c", pg.locator(".list li").count() == 1, "leading and trailing spaces are ignored")
    pg.close()

    # F01-E2 emoji, very long input, markup in search
    pg, errs, dialogs = open_page(b); to_models(pg)
    pg.fill("#q", "🚗🚙")
    check("F01-E2", pg.get_by_text("Nenhum resultado").is_visible(), "emoji search shows the empty state")
    pg.fill("#q", "x" * 2000)
    check("F01-E2b", pg.get_by_text("Nenhum resultado").is_visible() and pg.evaluate("document.documentElement.scrollWidth") <= 390, "2000-char search: empty state, no horizontal scroll")
    pg.fill("#q", '<img src=x onerror="alert(1)">')
    pg.wait_for_timeout(300)
    check("F01-N1", dialogs == [] and pg.locator("main img").count() == 0, "markup in search is shown as text, never run")
    check("F01-E2c", errs == [], f"no console errors {errs}")
    pg.close()

    # F01-E3 double tap on a list item must not skip a step
    pg, errs, _ = open_page(b)
    pg.get_by_role("button", name="Carros").first.click()
    pg.get_by_role("button", name="Marca Exemplo Alfa").dblclick()
    check("F01-E3", pg.get_by_role("heading", name="Escolha o modelo").is_visible(), "double tap on a brand lands on the model step")
    pg.close()

    # F01-E4 long names wrap without overflow, at 320px
    pg, errs, _ = open_page(b, 320, 700)
    pg.get_by_role("button", name="Carros").first.click()
    pg.get_by_role("button", name="Marca Exemplo Beta").click()
    long = "Modelo F 1.0 Turbo Edição Especial Comemorativa Cinquenta Anos Flex"
    check("F01-E4", pg.get_by_role("button", name=long).is_visible(), "60+ char model name listed")
    pg.get_by_role("button", name=long).click(); pg.get_by_role("button", name="2025").click()
    pg.wait_for_selector(".price")
    sw = pg.evaluate("document.documentElement.scrollWidth")
    check("F01-E4b", sw <= 320, f"result with long name and R$ 1.234.567,89 fits 320px (scrollWidth {sw})")
    pg.screenshot(path=str(OUT / "F01-E4-long-name-320.png"), full_page=True)
    pg.close()

    # F01-E5 back button mid-flow while loading, then finish another lookup
    pg, errs, _ = open_page(b, q="?latency=600")
    pg.get_by_role("button", name="Carros").first.click()
    pg.get_by_role("button", name="Voltar").click()
    check("F01-E5", pg.locator("h1").inner_text() == "Régua", "back during loading returns home")
    pg.wait_for_timeout(800)
    check("F01-E5b", pg.locator("h1").inner_text() == "Régua", "a late response does not pull the user back into the flow")
    pg.close()

    # F01-E6 keyboard only: whole lookup without a mouse
    pg, errs, _ = open_page(b)
    def tab_to(label, limit=40):
        for _ in range(limit):
            pg.keyboard.press("Tab")
            if pg.evaluate("document.activeElement && document.activeElement.innerText.trim().split('\\n')[0]") == label: return True
        return False
    ok = tab_to("Carros"); pg.keyboard.press("Enter")
    ok = ok and tab_to("Marca Exemplo Alfa"); pg.keyboard.press("Enter")
    ok = ok and tab_to("Modelo A 1.0"); pg.keyboard.press("Enter")
    ok = ok and tab_to("2022"); pg.keyboard.press("Enter")
    check("F01-E6", ok and pg.locator(".price").is_visible(), "complete lookup with keyboard only")
    check("F01-E6b", pg.evaluate("document.activeElement !== document.body"), "focus is not lost to <body> after each step")
    pg.close()

    # F03-E1 storage blocked (private mode, some webviews): favorites still work in the session
    blocked = "Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});"
    pg, errs, _ = open_page(b, init=blocked)
    to_models(pg); pg.get_by_role("button", name="Modelo A 1.0").click(); pg.get_by_role("button", name="2022").click()
    pg.get_by_role("button", name="Favoritar").click()
    pg.get_by_role("button", name="Voltar").click()
    for _ in range(3): pg.get_by_role("button", name="Voltar").click()
    pg.get_by_role("tab", name="Favoritos").click(); pg.wait_for_selector(".list li, .state")
    check("F03-E1", pg.locator(".list").get_by_text("Modelo A 1.0").count() == 1, "favorite kept in memory when storage is blocked")
    check("F03-E1b", errs == [], f"no console errors {errs}")
    pg.close()

    # F03-E2 corrupted or stale stored favorites
    bad = "try{localStorage.setItem('favs','{not json');}catch(e){}"
    pg, errs, _ = open_page(b, init=bad)
    pg.get_by_role("tab", name="Favoritos").click(); pg.wait_for_timeout(200)
    check("F03-E2", pg.get_by_text("Sua lista está vazia").is_visible() and errs == [], "corrupted storage shows the empty state, no crash")
    pg.close()
    stale = "localStorage.setItem('favs', JSON.stringify(['gone-1','y-1']));"
    pg, errs, _ = open_page(b, init=stale)
    pg.get_by_role("tab", name="Favoritos").click(); pg.wait_for_selector(".list li")
    check("F03-E2b", pg.locator(".list li").count() == 1, "a favorite removed from the catalog is skipped")
    pg.close()

    # F04-E1 share text contains no markup and the right price
    pg, errs, _ = open_page(b); to_models(pg)
    pg.get_by_role("button", name="Modelo A 1.0").click(); pg.get_by_role("button", name="2022").click()
    price = pg.locator(".price").inner_text()
    pg.get_by_role("button", name="Compartilhar").click()
    txt = pg.get_by_role("status").inner_text()
    check("F04-E1", price in txt and "<" not in txt and ("Texto copiado" in txt or "Copie o texto" in txt), f"share text has the shown price ({price})")
    pg.close()

    # A11Y: names, labels, language, landmarks, touch targets on every screen of the flow
    pg, errs, _ = open_page(b)
    def a11y(screen):
        r = pg.evaluate("""() => {
          const bad = [];
          document.querySelectorAll('button, a, input').forEach(el => {
            const name = (el.getAttribute('aria-label') || el.innerText || el.value || '').trim()
              || (el.id && document.querySelector(`label[for="${el.id}"]`)?.innerText.trim());
            if (!name) bad.push('no name: ' + el.outerHTML.slice(0, 60));
            const r = el.getBoundingClientRect();
            if (el.tagName !== 'INPUT' && r.width && (r.height < 44 || r.width < 44)) bad.push(`small target ${Math.round(r.width)}x${Math.round(r.height)}: ` + (el.innerText || el.getAttribute('aria-label')).trim().slice(0, 30));
          });
          document.querySelectorAll('img').forEach(i => { if (!i.hasAttribute('alt')) bad.push('img without alt'); });
          if (!document.documentElement.lang) bad.push('no lang');
          if (!document.querySelector('main')) bad.push('no main landmark');
          return bad;
        }""")
        check("A11Y-" + screen, r == [], "; ".join(r[:4]) if r else "names, labels, targets ok")
    a11y("S03")
    to_models(pg); a11y("S04")
    pg.get_by_role("button", name="Modelo A 1.0").click(); pg.get_by_role("button", name="2022").click(); pg.wait_for_selector(".price"); a11y("S05")
    pg.close()
    b.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results)} checks, {len(results)-len(failed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
