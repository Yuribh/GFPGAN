// Store screenshots from the web build, with the sample data (no Supabase keys set).
// Usage: EXPO_PUBLIC_DATA_SOURCE=sample npx expo export --platform web --output-dir dist-web && node scripts/screenshots.mjs dist-web store/screenshots
// Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium), or a global install.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')); }
const [dir, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  let p = join(dir, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(p) || p.endsWith('/')) p = join(dir, 'index.html');
  try { res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
}).listen(4173);
const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }));
const sizes = [
  { name: 'android', width: 360, height: 640, scale: 3 },   // 1080x1920 (Google Play phone)
  { name: 'iphone-6.9', width: 440, height: 956, scale: 3 }, // 1320x2868 (App Store 6.9")
];
for (const sz of sizes) {
  const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height }, deviceScaleFactor: sz.scale, locale: 'pt-BR', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const shot = async (n) => { await page.waitForTimeout(900); await page.screenshot({ path: join(out, `${sz.name}-${n}.png`) }); };
  await page.goto('http://localhost:4173/');
  await page.getByText('Qual veículo você quer consultar?').waitFor();
  await shot('1-inicio');
  await page.getByRole('button', { name: 'Carros', exact: true }).first().click();
  await page.getByText('Marca Exemplo Alfa').waitFor();
  await shot('2-marcas');
  // the app ignores a second tap within 400 ms (double-tap guard), so pause like a person would
  await page.waitForTimeout(600); await page.getByText('Marca Exemplo Alfa').click();
  await page.waitForTimeout(600); await page.getByText('Modelo B 2.0 Automático').click();
  await page.waitForTimeout(600); await page.getByText('0 km').click();
  await page.getByText('Evolução do preço').waitFor();
  await page.getByRole('button', { name: 'Favoritar' }).click();
  await shot('3-preco');
  await page.mouse.wheel(0, 600);
  await shot('4-grafico');
  await page.goto('http://localhost:4173/favorites');
  await page.getByText('Modelo B 2.0 Automático').waitFor();
  await shot('5-favoritos');
  await ctx.close();
}
await browser.close(); server.close();
console.log('done');
