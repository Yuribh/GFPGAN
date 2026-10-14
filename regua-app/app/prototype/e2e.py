import sys, pathlib
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).resolve().parent
URL = "file://" + str(HERE / "dist" / "index.html")
OUT = HERE.parents[1] / "replica" / "clone-screens"; OUT.mkdir(parents=True, exist_ok=True)
errors = []
def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: errors.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium" if pathlib.Path("/opt/pw-browsers/chromium").is_file() else None)
    def page_at(w, h, q=""):
        pg = b.new_page(viewport={"width": w, "height": h})
        logs = []
        pg.on("console", lambda m: logs.append(m.text) if m.type in ("error",) else None)
        pg.on("pageerror", lambda e: logs.append(str(e)))
        pg.goto(URL + q)
        return pg, logs

    pg, logs = page_at(390, 844)
    check(pg.locator("h1").inner_text() == "Régua", "home renders")
    pg.screenshot(path=str(OUT / "S03-home.png"))
    # flow F01: cars -> brand -> model -> year -> result
    pg.get_by_role("button", name="Carros").first.click()
    check(pg.get_by_text("Marca Exemplo Alfa").is_visible(), "S04 lists car brands")
    check(not pg.get_by_text("Marca Exemplo Moto").count(), "only cars shown")
    pg.screenshot(path=str(OUT / "S04-brands.png"))
    pg.fill("#q", "beta")
    check(pg.locator(".list li").count() == 1, "search filters list")
    pg.fill("#q", "zzz")
    check(pg.get_by_text("Nenhum resultado").is_visible(), "empty search state")
    pg.fill("#q", "")
    pg.get_by_role("button", name="Marca Exemplo Alfa").click()
    pg.get_by_role("button", name="Modelo B 2.0 Automático").click()
    check(pg.get_by_text("0 km").is_visible(), "zero km label on years")
    pg.screenshot(path=str(OUT / "S04-years.png"))
    pg.get_by_role("button", name="2021").click()
    check(pg.locator(".price").is_visible(), "S05 shows price")
    price = pg.locator(".price").inner_text()
    check(price.startswith("R$ ") and "," in price, f"price formatted ({price})")
    check(pg.locator("svg.chart").is_visible(), "S06 chart visible")
    pg.screenshot(path=str(OUT / "S05-result.png"), full_page=True)
    pg.get_by_role("button", name="6 meses").click()
    check(pg.get_by_role("button", name="6 meses").get_attribute("aria-pressed") == "true", "interval switch")
    # favorite flow F03
    pg.get_by_role("button", name="Favoritar").click()
    check(pg.get_by_role("button", name="Favorito").get_attribute("aria-pressed") == "true", "favorite toggled on")
    check(pg.get_by_role("status").is_visible(), "toast announces favorite")
    # share F04 (clipboard fallback toast)
    pg.get_by_role("button", name="Compartilhar").click()
    pg.wait_for_function("() => /Texto copiado|Copie o texto/.test(document.querySelector('[role=status]')?.innerText || '')", timeout=3000)
    check(any(k in pg.get_by_role("status").inner_text() for k in ("Texto copiado", "Copie o texto")), "share builds text")
    # back stack
    pg.get_by_role("button", name="Voltar").click()
    check(pg.get_by_role("heading", name="Escolha o ano").is_visible(), "back returns to year step")
    pg.get_by_role("button", name="Voltar").click(); pg.get_by_role("button", name="Voltar").click(); pg.get_by_role("button", name="Voltar").click()
    check(pg.locator("h1").inner_text() == "Régua", "back to home")
    # favorites tab
    pg.get_by_role("tab", name="Favoritos").click()
    pg.wait_for_selector(".list li")
    check(pg.locator(".list").get_by_text("Modelo B 2.0 Automático").is_visible(), "S08 shows the favorite")
    pg.screenshot(path=str(OUT / "S08-favorites.png"))
    # history
    pg.get_by_role("tab", name="Home").click()
    pg.get_by_role("button", name="Histórico").click()
    pg.wait_for_selector(".list li")
    check(pg.locator(".list li").count() == 1, "history has the lookup")
    # unfavorite then empty state
    pg.locator(".list button").first.click(); pg.wait_for_selector(".price")
    pg.get_by_role("button", name="Favorito").click()
    pg.get_by_role("button", name="Voltar").click()
    pg.get_by_role("tab", name="Favoritos").click()
    pg.wait_for_selector(".state")
    check(pg.get_by_text("Sua lista está vazia").is_visible(), "S08 empty state after removing")
    pg.screenshot(path=str(OUT / "S08-empty.png"))
    check(logs == [], f"no console errors {logs}")
    pg.close()

    # keyboard only: tab to a tile and press Enter
    pg, logs = page_at(390, 844)
    for _ in range(6):
        pg.keyboard.press("Tab")
        if pg.evaluate("document.activeElement.textContent.trim()") == "Carros": break
    check(pg.evaluate("document.activeElement.textContent.trim()") == "Carros", "keyboard reaches Carros tile")
    pg.keyboard.press("Enter")
    check(pg.get_by_text("Marca Exemplo Alfa").is_visible(), "keyboard activates tile")
    pg.close()

    # sparse vehicle
    pg, logs = page_at(390, 844)
    pg.get_by_role("button", name="Carros").first.click()
    pg.get_by_role("button", name="Marca Exemplo Beta").click()
    pg.get_by_role("button", name="Modelo C 1.6").click()
    pg.get_by_role("button", name="2024").click()
    check(pg.get_by_text("Só há um mês de dados").is_visible(), "sparse chart state")
    check(pg.get_by_text("Primeiro mês de dados").is_visible(), "no change chip when one month")
    pg.screenshot(path=str(OUT / "S06-sparse.png"), full_page=True)
    pg.close()

    # loading and error states
    pg, logs = page_at(390, 844, "?latency=1500")
    pg.get_by_role("button", name="Carros").first.click()
    check(pg.locator(".skel").first.is_visible(), "loading skeleton shown")
    pg.screenshot(path=str(OUT / "S04-loading.png"))
    pg.close()
    pg, logs = page_at(390, 844, "?fail=1")
    pg.get_by_role("button", name="Carros").first.click()
    pg.wait_for_selector("[role=alert]")
    check(pg.get_by_role("button", name="Tentar outra vez").is_visible(), "error state with retry")
    pg.screenshot(path=str(OUT / "S04-error.png"))
    pg.close()

    # layout at 1440 and 320, no horizontal scroll, long names
    for w in (320, 1440):
        pg, logs = page_at(w, 800)
        sw = pg.evaluate("document.documentElement.scrollWidth")
        check(sw <= w, f"no horizontal scroll at {w}px (scrollWidth {sw})")
        pg.close()
    b.close()
print("\nFAILED:" if errors else "\nALL PASSED", errors if errors else "")
sys.exit(1 if errors else 0)
