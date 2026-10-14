import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceToCents, parseReferenceMonth, parseYearCode } from '../fipe/parse.ts';
import { createFipeProvider, ProviderError } from '../fipe/provider.ts';
import { runIngestion } from '../fipe/ingest.ts';
import { createMemoryStore } from '../fipe/memory-store.ts';

// ---------- fake API built from the documented response shapes (fipe.api.br/docs/api/fipe) ----------
// Invented names and prices. 2 brands of cars, 3 models, 5 year rows, one year with no price (404).
function fakeApi(opts: { fail429Times?: number; refMonth?: string } = {}) {
  let fail429 = opts.fail429Times ?? 0;
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    '/references': [{ code: '330', month: opts.refMonth ?? 'outubro de 2026 ' }, { code: '329', month: 'setembro de 2026' }],
    '/cars/brands': [{ code: '1', name: 'Marca Um' }, { code: '2', name: 'Marca Dois' }],
    '/cars/brands/1/models': [{ code: '10', name: 'Modelo A' }, { code: '11', name: 'Modelo B' }],
    '/cars/brands/2/models': [{ code: '20', name: 'Modelo C' }],
    '/cars/brands/1/models/10/years': [{ code: '2020-1', name: '2020 Gasolina' }, { code: '32000-1', name: '32000 Gasolina' }],
    '/cars/brands/1/models/11/years': [{ code: '2019-3', name: '2019 Diesel' }],
    '/cars/brands/2/models/20/years': [{ code: '2021-1', name: '2021 Gasolina' }, { code: '2018-1', name: '2018 Gasolina' }],
  };
  const vehicle = (code: string, year: number, price: string) =>
    ({ brand: 'x', codeFipe: code, fuel: 'Gasolina', fuelAcronym: 'G', model: 'x', modelYear: year, price, priceHistory: [], referenceMonth: 'outubro de 2026', vehicleType: 1 });
  routes['/cars/brands/1/models/10/years/2020-1'] = vehicle('000001-1', 2020, 'R$ 45.678,00');
  routes['/cars/brands/1/models/10/years/32000-1'] = vehicle('000001-1', 32000, 'R$ 99.990,50');
  routes['/cars/brands/1/models/11/years/2019-3'] = vehicle('000002-9', 2019, 'R$ 120.000,00');
  routes['/cars/brands/2/models/20/years/2021-1'] = vehicle('000003-7', 2021, 'R$ 7.500,00');
  // 2018-1 deliberately missing -> 404

  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const path = u.pathname.replace('/api/v2', '');
    calls.push(path + (u.search ? u.search : '') + ' ' + JSON.stringify(init?.headers ?? {}));
    if (fail429 > 0) { fail429--; return new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }); }
    if (!(path in routes)) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(routes[path]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}
const noSleep = async () => {};

// ---------- parsers ----------
test('parsePriceToCents reads the API price text exactly', () => {
  assert.equal(parsePriceToCents('R$ 10.000,00'), 1_000_000);
  assert.equal(parsePriceToCents('R$ 99.990,50'), 9_999_050);
  assert.equal(parsePriceToCents('R$ 7,05'), 705);
  assert.equal(parsePriceToCents('R$ 1.234.567,89'), 123_456_789);
  assert.throws(() => parsePriceToCents('10000'));
  assert.throws(() => parsePriceToCents('R$ 10.000'));
});

test('parseReferenceMonth handles accents and trailing spaces', () => {
  assert.deepEqual(parseReferenceMonth('abril de 2024'), { year: 2024, month: 4 });
  assert.deepEqual(parseReferenceMonth('março de 2026 '), { year: 2026, month: 3 });
  assert.deepEqual(parseReferenceMonth('Outubro de 2026'), { year: 2026, month: 10 });
  assert.throws(() => parseReferenceMonth('04/2024'));
  assert.throws(() => parseReferenceMonth('abrul de 2024'));
});

test('parseYearCode keeps 32000 (zero km) as is', () => {
  assert.deepEqual(parseYearCode('2022-3'), { modelYear: 2022, fuelCode: 3 });
  assert.deepEqual(parseYearCode('32000-1'), { modelYear: 32000, fuelCode: 1 });
  assert.throws(() => parseYearCode('2022'));
});

// ---------- provider ----------
test('provider sends the token header and the reference parameter', async () => {
  const api = fakeApi();
  const p = createFipeProvider({ fetchImpl: api.fetchImpl, token: 'test-token', sleep: noSleep });
  await p.brands('cars', '330');
  assert.match(api.calls[0], /^\/cars\/brands\?reference=330 /);
  assert.match(api.calls[0], /"X-Subscription-Token":"test-token"/);
});

test('provider retries 429 and then succeeds', async () => {
  const api = fakeApi({ fail429Times: 2 });
  const p = createFipeProvider({ fetchImpl: api.fetchImpl, sleep: noSleep });
  const refs = await p.references();
  assert.equal(refs[0].code, '330');
  assert.equal(p.requestsMade, 3);
});

test('provider gives up after maxRetries with a clear error', async () => {
  const api = fakeApi({ fail429Times: 10 });
  const p = createFipeProvider({ fetchImpl: api.fetchImpl, sleep: noSleep, maxRetries: 2 });
  await assert.rejects(() => p.references(), (e: unknown) => e instanceof ProviderError && e.status === 429);
});

test('provider returns null for a vehicle year with no price', async () => {
  const p = createFipeProvider({ fetchImpl: fakeApi().fetchImpl, sleep: noSleep });
  assert.equal(await p.vehicle('cars', '2', '20', '2018-1', '330'), null);
});

// ---------- ingestion ----------
test('full run writes every price, skips the missing one, records the run', async () => {
  const p = createFipeProvider({ fetchImpl: fakeApi().fetchImpl, sleep: noSleep });
  const m = createMemoryStore();
  const r = await runIngestion(p, m.store, { types: ['cars'] });
  assert.equal(r.status, 'succeeded');
  assert.equal(r.referenceCode, '330');
  assert.equal(r.pricesWritten, 4);
  assert.equal(r.skippedNoPrice, 1);
  assert.equal(m.prices.size, 4);
  assert.ok([...m.prices.values()].includes(4_567_800));
  assert.deepEqual([...m.months.values()].map(x => [x.year, x.month]), [[2026, 10]]);
  assert.equal(m.runs.at(-1)!.status, 'succeeded');
  // 1 references + 1 brands + 2 models + 3 years + 5 vehicles
  assert.equal(r.requestsUsed, 12);
});

test('running twice is idempotent and the second run makes no vehicle calls', async () => {
  const api = fakeApi();
  const p = createFipeProvider({ fetchImpl: api.fetchImpl, sleep: noSleep });
  const m = createMemoryStore();
  await runIngestion(p, m.store, { types: ['cars'] });
  const sizes = [m.brands.size, m.models.size, m.years.size, m.prices.size];
  const r2 = await runIngestion(p, m.store, { types: ['cars'] });
  assert.equal(r2.status, 'succeeded');
  assert.deepEqual([m.brands.size, m.models.size, m.years.size, m.prices.size], sizes);
  assert.equal(r2.requestsUsed, 2); // references + brands, everything else checkpointed
});

test('a small request budget stops cleanly and the next runs resume to completion', async () => {
  const p = createFipeProvider({ fetchImpl: fakeApi().fetchImpl, sleep: noSleep });
  const m = createMemoryStore();
  const statuses: string[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await runIngestion(p, m.store, { types: ['cars'], requestBudget: 6 });
    statuses.push(r.status);
    assert.ok(r.requestsUsed <= 6, `run ${i} used ${r.requestsUsed} requests`);
    if (r.status === 'succeeded') break;
  }
  assert.equal(statuses[0], 'partial');
  assert.equal(statuses.at(-1), 'succeeded');
  assert.equal(m.prices.size, 4);
  // a model is never half-written: every stored model year has its price
  assert.equal(m.years.size, m.prices.size);
});

test('an unparseable price fails the run without crashing the job', async () => {
  const api = fakeApi();
  const broken = (async (url: string, init?: RequestInit) => {
    if (url.endsWith('/years/2019-3?reference=330')) {
      return new Response(JSON.stringify({ codeFipe: '000002-9', fuel: 'Diesel', modelYear: 2019, price: 'consulte', referenceMonth: 'x', brand: 'x', model: 'x' }), { status: 200 });
    }
    return api.fetchImpl(url, init);
  }) as typeof fetch;
  const m = createMemoryStore();
  const r = await runIngestion(createFipeProvider({ fetchImpl: broken, sleep: noSleep }), m.store, { types: ['cars'] });
  assert.equal(r.status, 'failed');
  assert.match(r.error!, /unrecognised price/);
  assert.equal(m.runs.at(-1)!.status, 'failed');
});
