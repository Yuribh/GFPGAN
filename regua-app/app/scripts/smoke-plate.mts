// End-to-end check of the plate lookup and the paid history report over PostgREST (the Supabase REST layer):
// fake providers, the real lookup logic and the real Supabase stores, against a database with the FIPE table imported.
// Usage (TEST DATABASE ONLY, it empties the plate tables): SMOKE_RESET=1 DATABASE_URL=... PGRST_URL=http://127.0.0.1:3000 node scripts/smoke-plate.mts <service_role JWT>
import { createServer } from 'node:http';
import pg from 'pg';
import { createPlateProvider } from '../server/plate/provider.ts';
import { lookupPlate } from '../server/plate/lookup.ts';
import { createSupabasePlateStore } from '../server/plate/supabase-store.ts';
import { createHistoryProvider } from '../server/history/provider.ts';
import { getHistoryReport } from '../server/history/report.ts';
import { createSupabaseHistoryStore } from '../server/history/supabase-store.ts';

// a real catalog row: the fake plate provider answers with its FIPE code and year
const db0 = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db0.connect();
// it empties the plate and history tables first, so it only runs on a throwaway database
if (process.env.SMOKE_RESET !== '1') { console.error('Refusing to run: set SMOKE_RESET=1, and only on a test database.'); process.exit(2); }
await db0.query('truncate plate_cache, plate_usage, plate_budget, history_cache, history_purchases');
const row = (await db0.query("select fipe_code, model_year from model_years where model_year < 32000 order by fipe_code limit 1")).rows[0];
await db0.end();
if (!row) { console.error('FAIL: import the FIPE table first'); process.exit(1); }
const FIPE = String(row.fipe_code), YEAR = Number(row.model_year);

// fake providers in the style of Brazilian vehicle APIs
let providerCalls = 0;
const srv = createServer((req, res) => {
  providerCalls++;
  const plate = req.url!.split('/').pop()!.split('?')[0];
  const send = (c: number, b: unknown) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  if (req.url!.startsWith('/placa/') && plate === 'ABC1234') return send(200, { placa: plate, marca: 'MARCA UM', modelo: 'MODELO B', anoModelo: String(YEAR), codigo_fipe: FIPE.replace('-', '') });
  if (req.url!.startsWith('/historico/') && plate === 'ABC1234') return send(200, { veiculo: { marca: 'MARCA UM', modelo: 'MODELO B', ano_modelo: YEAR }, leilao: 'NÃO', roubo_furto: { possui: false }, gravame: { situacao: 'ATIVO', agente_financeiro: 'BANCO X' } });
  send(404, { mensagem: 'não encontrado' });
}).listen(8791);

const service = process.argv[2];
const pgrst = (process.env.PGRST_URL ?? 'http://127.0.0.1:3300').replace(/\/$/, '');
const fetchImpl = ((u: string, init?: RequestInit) => fetch(u.replace('http://supa/rest/v1', pgrst), init)) as typeof fetch;
const store = createSupabasePlateStore({ url: 'http://supa', serviceRoleKey: service, fetchImpl });
const provider = createPlateProvider({ urlTemplate: 'http://127.0.0.1:8791/placa/{plate}', token: 't', auth: 'header:X-Api-Key' });
const deps = { store, provider, isPlus: async () => false, pepper: 'pepper-test', limits: { free: 3, plus: 30, globalDaily: 100 } };
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); };

const r1 = await lookupPlate(deps, { plate: 'abc-1234', installId: A });
check('plate found and matched to the imported FIPE table', r1.status === 'ok' && r1.matches.length === 1 && r1.matches[0].modelYear === YEAR && r1.matches[0].fipeCode === FIPE,
  JSON.stringify(r1.status === 'ok' ? { vehicle: r1.vehicle, match: r1.matches[0] } : r1));
const r2 = await lookupPlate(deps, { plate: 'ABC1234', installId: B });
check('second lookup comes from the cache (no paid call)', r2.status === 'ok' && r2.cached && providerCalls === 1, `provider calls ${providerCalls}`);
check('unknown plate -> not found', (await lookupPlate(deps, { plate: 'XYZ9A99', installId: B })).status === 'not_found');
const r4 = await lookupPlate(deps, { plate: 'ABC1234', installId: A }), r5 = await lookupPlate(deps, { plate: 'ABC1234', installId: A });
const r6 = await lookupPlate(deps, { plate: 'ABC1234', installId: A });
check('free device limit of 3 per day', r4.status === 'ok' && r5.status === 'ok' && r6.status === 'limit', r6.status);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const cache = (await db.query('select plate_hash, vehicle::text v from plate_cache')).rows;
check('plate stored only as a hash', cache.length === 2 - 1 && /^[0-9a-f]{64}$/.test(cache[0].plate_hash) && !JSON.stringify(cache).includes('ABC1234'), `${cache.length} cached`);
const usage = (await db.query('select lookups from plate_usage order by lookups desc')).rows.map(r => r.lookups);
check('usage counted per device', JSON.stringify(usage) === '[3,2]', JSON.stringify(usage));

// paid vehicle history over the same database
const hstore = createSupabaseHistoryStore({ url: 'http://supa', serviceRoleKey: service, fetchImpl });
const hdeps = { store: hstore, provider: createHistoryProvider({ urlTemplate: 'http://127.0.0.1:8791/historico/{plate}', token: 't' }), ownsTransaction: async () => true, pepper: 'pepper-test' };
const h1 = await getHistoryReport(hdeps, { plate: 'ABC1234', transactionId: 'GPA.0001', rcUserId: 'u' });
check('history report generated', h1.status === 'ok' && h1.report.checks.find(c => c.key === 'gravame')?.status === 'alert' && h1.report.checks.find(c => c.key === 'leilao')?.status === 'ok');
check('same purchase re-downloads from cache', (await getHistoryReport(hdeps, { plate: 'ABC1234', transactionId: 'GPA.0001', rcUserId: 'u' })).status === 'ok');
check('same purchase refused for another plate', (await getHistoryReport(hdeps, { plate: 'XYZ9A99', transactionId: 'GPA.0001', rcUserId: 'u' })).status === 'already_used');
const h4 = await getHistoryReport(hdeps, { plate: 'XYZ9A99', transactionId: 'GPA.0002', rcUserId: 'u' });
const released = (await db.query("select count(*)::int n from history_purchases where transaction_id = 'GPA.0002'")).rows[0].n;
check('unknown plate releases the purchase', h4.status === 'not_found' && released === 0);
await db.end(); srv.close();
console.log(fails ? `\n${fails} failed` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
