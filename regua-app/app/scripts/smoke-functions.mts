// Runs the BUNDLED plate-lookup Edge Function (what gets deployed) in Deno, the runtime Supabase uses, against a
// database with the FIPE table imported, through PostgREST, with a fake plate provider; then the app's plate client.
// Usage (TEST DATABASE ONLY, it empties the plate tables):
//   node scripts/build-functions.mjs plate-lookup
//   SMOKE_RESET=1 DATABASE_URL=... PGRST_URL=http://127.0.0.1:3000 DENO=deno node scripts/smoke-functions.mts <service_role JWT> [--live-fipe]
// --live-fipe also prices a plate whose FIPE code is not in the database through the real FIPE API (needs internet).
import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import pg from 'pg';
import { createPlateClient } from '../src/data/plate.ts';
import { createLiveRepository } from '../src/data/live.ts';

if (process.env.SMOKE_RESET !== '1') { console.error('Refusing to run: set SMOKE_RESET=1, and only on a test database.'); process.exit(2); }
const service = process.argv[2];
const liveFipe = process.argv.includes('--live-fipe');
const pgrst = new URL(process.env.PGRST_URL ?? 'http://127.0.0.1:3300');

const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
await db.query('truncate plate_cache, plate_usage, plate_budget');
const row = (await db.query("select fipe_code, model_year from model_years where model_year < 32000 order by fipe_code limit 1")).rows[0];
if (!row) { console.error('FAIL: import the FIPE table first'); process.exit(1); }
const FIPE = String(row.fipe_code), YEAR = Number(row.model_year);
// a real FIPE code (Toyota Corolla Altis Híbrido 2025) that the test database does not have
const OUTSIDE = (await db.query("select 1 from model_years where fipe_code = '002182-2'")).rowCount ? null : '002182-2';

// Supabase serves PostgREST under /rest/v1; this proxy does the same in front of the plain PostgREST
const proxy = createServer((req, res) => {
  const up = request({ host: pgrst.hostname, port: pgrst.port, method: req.method, path: req.url!.replace(/^\/rest\/v1/, ''), headers: { ...req.headers, host: pgrst.host } },
    r => { res.writeHead(r.statusCode!, r.headers); r.pipe(res); });
  req.pipe(up);
}).listen(8792);

// fake plate provider: ABC1234 is in our catalog, BRA2E19 only in the FIPE API, everything else is unknown
let providerCalls = 0;
const provider = createServer((req, res) => {
  providerCalls++;
  const plate = req.url!.split('/').pop()!;
  const send = (c: number, b: unknown) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  if (req.headers['x-api-key'] !== 'provider-token') return send(401, { erro: 'token' });
  if (plate === 'ABC1234') return send(200, { placa: plate, marca: 'MARCA', modelo: 'MODELO', anoModelo: String(YEAR), codigo_fipe: FIPE.replace('-', '') });
  if (plate === 'BRA2E19' && OUTSIDE) return send(200, { data: { marca: 'TOYOTA', modelo: 'COROLLA ALTIS HYBRID', ano_modelo: 2025, fipe: [{ codigo: OUTSIDE }] } });
  send(404, { mensagem: 'não encontrado' });
}).listen(8791);

const fn = spawn(process.env.DENO ?? 'deno', ['run', '--allow-net', '--allow-env', 'supabase/.build/supabase/functions/plate-lookup/index.ts'], {
  env: {
    ...process.env,
    SUPABASE_URL: 'http://127.0.0.1:8792', SUPABASE_SERVICE_ROLE_KEY: service,
    PLATE_API_URL: 'http://127.0.0.1:8791/placa/{plate}', PLATE_API_TOKEN: 'provider-token', PLATE_API_AUTH: 'header:X-Api-Key',
    PLATE_HASH_PEPPER: 'pepper-test', PLATE_FREE_DAILY: '3',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
  detached: true,   // own process group, so a launcher script and the real deno both stop
});
const stop = () => { try { process.kill(-fn.pid!, 'SIGTERM'); } catch { fn.kill(); } proxy.close(); provider.close(); };

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); };
const FN = 'http://127.0.0.1:8000';
const call = async (body: unknown) => {
  const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { code: r.status, body: await r.json() as Record<string, any> };
};
for (let i = 0; i < 60; i++) { try { await fetch(FN); break; } catch { await new Promise(r => setTimeout(r, 500)); } }

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const r1 = await call({ plate: 'abc-1234', installId: A });
check('function: plate matched to the imported FIPE table', r1.code === 200 && r1.body.matches?.[0]?.fipeCode === FIPE && r1.body.matches[0].modelYear === YEAR, JSON.stringify(r1.body).slice(0, 200));
check('function: FIPE codes sent back with the vehicle', JSON.stringify(r1.body.vehicle?.fipeCodes) === JSON.stringify([FIPE]));
check('function: invalid plate -> 400', (await call({ plate: 'AB1', installId: A })).code === 400);
check('function: unknown plate -> 404', (await call({ plate: 'XYZ9A99', installId: B })).code === 404);
check('function: GET refused', (await fetch(FN)).status === 405);
const cache = (await db.query('select plate_hash from plate_cache')).rows;
check('function: plate stored only as a hash', cache.length === 1 && /^[0-9a-f]{64}$/.test(cache[0].plate_hash));
check('function: provider called with its token', providerCalls === 2, `calls ${providerCalls}`);

// the app's plate client against the deployed-style endpoint
const client = createPlateClient({
  url: 'http://supa', anonKey: 'anon',
  fetchImpl: ((u: string, init?: RequestInit) => fetch(u.replace('http://supa/functions/v1/plate-lookup', FN), init)) as typeof fetch,
  resolve: liveFipe ? (codes, year) => createLiveRepository().matchFipeCodes(codes, year) : undefined,
});
const a1 = await client.lookup('ABC1234', B);
check('app: same plate from another phone comes from the cache', a1.status === 'ok' && a1.matches[0]?.fipeCode === FIPE && providerCalls === 2);
if (OUTSIDE) {
  const a2 = await client.lookup('BRA2E19', B);
  if (liveFipe) {
    check('app: plate outside our catalog priced through the FIPE API', a2.status === 'ok' && a2.matches[0]?.modelYearId === `fipe:cars:${OUTSIDE}:2025-6`, JSON.stringify(a2).slice(0, 300));
    if (a2.status === 'ok' && a2.matches[0]) {
      const v = await createLiveRepository().getVehicle(a2.matches[0].modelYearId);
      check('app: its price page loads', !!v && v.latest.priceCents > 0, v ? `${v.brand.name} ${v.model.name} ${v.year.modelYear}: R$ ${(v.latest.priceCents / 100).toFixed(2)} (${v.latest.referenceMonth})` : '');
    }
  } else {
    check('app: plate outside our catalog returns its FIPE code to price it', a2.status === 'ok' && a2.matches.length === 0 && a2.vehicle.fipeCodes?.[0] === OUTSIDE);
  }
}
// every lookup counts, found or not: this phone has used 2 or 3 of its 3
const left = OUTSIDE ? 0 : 1;
const more = [];
for (let i = 0; i <= left; i++) more.push((await client.lookup('ABC1234', B)).status);
check('app: free limit of 3 lookups a day per phone', more.join() === [...Array(left).fill('ok'), 'limit'].join(), more.join());

await db.end(); stop();
console.log(fails ? `\n${fails} failed` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
