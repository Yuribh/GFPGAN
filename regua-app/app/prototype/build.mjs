// Builds dist/index.html from the tested TypeScript sources: strips types, inlines everything.
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const js = p => stripTypeScriptTypes(read(p), { mode: 'strip' })
  .replace(/^import .*$/gm, '')
  .replace(/^export (async )?(function|const|interface|type)/gm, '$1$2');
const css = readFileSync(new URL('../../replica/design/tokens.css', import.meta.url), 'utf8') + read('prototype/style.css');
const script = [js('src/format.ts'), js('src/data/vehicle.ts'), js('src/data/fake.ts'), read('prototype/app.js')].join('\n');
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Régua (protótipo)</title><style>${css}</style></head>
<body><div id="app"></div><script>${script}</script></body></html>`;
mkdirSync(new URL('prototype/dist/', root), { recursive: true });
writeFileSync(new URL('prototype/dist/index.html', root), html);
// published page: the host adds doctype, head and body; single light look by design (the app is light-only)
const artifact = `<title>Régua</title>
<style>${css}
:root{color-scheme:light}
body{background:var(--color-bg);color:var(--color-text)}</style>
<div id="app"></div><script>${script}</script>`;
writeFileSync(new URL('prototype/dist/regua.html', root), artifact);
console.log('built', html.length, 'bytes');
