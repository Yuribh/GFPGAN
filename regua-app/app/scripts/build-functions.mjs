// Bundles each Edge Function with the shared code it imports (server/, src/logic/) into one file, so the Supabase CLI
// deploys it as is, wherever the files live. Output: supabase/.build/supabase/functions/<name>/index.ts
// Usage: node scripts/build-functions.mjs [name ...]   (no names = all)
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';

const src = 'supabase/functions', out = 'supabase/.build/supabase/functions';
const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(src, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
rmSync('supabase/.build', { recursive: true, force: true });
for (const name of names) {
  await build({
    entryPoints: [`${src}/${name}/index.ts`],
    outfile: `${out}/${name}/index.ts`,
    bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
    external: ['npm:*', 'jsr:*', 'node:*'],   // Deno resolves these itself
    logLevel: 'warning',
  });
  console.log(`built ${name}`);
}
