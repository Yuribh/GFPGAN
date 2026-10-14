import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseRepository } from '../src/data/supabase.ts';
import { fold, filterByLabel, shortQuery } from '../src/logic/search.ts';
import { createLatest, createTapGuard } from '../src/logic/latest.ts';

// PostgREST-shaped answers, matching migrations 0001 and 0002 (invented values)
function postgrest(routes: Record<string, unknown>, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    const key = Object.keys(routes).find(k => url.includes(k));
    return new Response(JSON.stringify(key ? routes[key] : []), { status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}
const opts = (f: typeof fetch) => ({ url: 'https://x.supabase.co/', anonKey: 'anon-key', fetchImpl: f });

test('brands: query, anon key headers, mapping, pt-BR order', async () => {
  const api = postgrest({ '/brands?': [{ id: 'b2', vehicle_type: 'cars', name: 'Ágil' }, { id: 'b1', vehicle_type: 'cars', name: 'Zeta' }, { id: 'b3', vehicle_type: 'cars', name: 'Beta' }] });
  const r = await createSupabaseRepository(opts(api.fetchImpl)).listBrands('cars');
  assert.deepEqual(r.map(b => b.name), ['Ágil', 'Beta', 'Zeta']);
  assert.deepEqual(r[0], { id: 'b2', vehicleType: 'cars', name: 'Ágil' });
  assert.equal(api.calls[0].url, 'https://x.supabase.co/rest/v1/brands?select=id,vehicle_type,name&vehicle_type=eq.cars&order=name');
  // a publishable key (not a JWT) only goes in apikey
  assert.equal(api.calls[0].headers.apikey, 'anon-key');
  assert.equal(api.calls[0].headers.authorization, undefined);
  // a legacy anon key (a JWT) also goes in Authorization
  const legacy = postgrest({ '/brands?': [] });
  await createSupabaseRepository({ ...opts(legacy.fetchImpl), anonKey: 'eyJhbGciOi.x.y' }).listBrands('cars');
  assert.equal(legacy.calls[0].headers.authorization, 'Bearer eyJhbGciOi.x.y');
});

test('years: newest first, zero km (32000) on top', async () => {
  const api = postgrest({ '/model_years?select=id,model_id': [
    { id: 'y1', model_id: 'm', model_year: 2019, fuel: 'Flex', fipe_code: '1' },
    { id: 'y2', model_id: 'm', model_year: 32000, fuel: 'Flex', fipe_code: '1' },
    { id: 'y3', model_id: 'm', model_year: 2022, fuel: 'Flex', fipe_code: '1' }] });
  const r = await createSupabaseRepository(opts(api.fetchImpl)).listYears('m');
  assert.deepEqual(r.map(y => y.modelYear), [32000, 2022, 2019]);
});

test('vehicle: embedded rows become a result with sorted history, latest and change', async () => {
  const pp = (y: number, m: number, c: number) => ({ price_cents: c, currency: 'BRL', reference_months: { year: y, month: m } });
  const api = postgrest({ '/model_years?select=id%2Cmodel_id': [{
    id: 'y1', model_id: 'm1', model_year: 2020, fuel: 'Flex', fipe_code: '000001-1',
    models: { id: 'm1', brand_id: 'b1', name: 'Modelo', brands: { id: 'b1', vehicle_type: 'cars', name: 'Marca' } },
    price_points: [pp(2026, 10, 4_600_000), pp(2025, 12, 4_700_000), pp(2026, 9, 4_500_000)],
  }] });
  const v = await createSupabaseRepository(opts(api.fetchImpl)).getVehicle('y1');
  assert.ok(v);
  assert.deepEqual(v.history.map(h => h.referenceMonth), ['2025-12', '2026-09', '2026-10']);
  assert.equal(v.latest.priceCents, 4_600_000);
  assert.equal(v.change!.cents, 100_000);
  assert.equal(v.brand.name, 'Marca');
  assert.match(api.calls[0].url, /&id=eq\.y1$/);
});

test('vehicle: keeps only the last 24 months; unknown id is null', async () => {
  const pts = Array.from({ length: 30 }, (_, i) => ({ price_cents: 1000 + i, currency: 'BRL', reference_months: { year: 2024 + Math.floor(i / 12), month: (i % 12) + 1 } }));
  const api = postgrest({ '/model_years?select=id%2Cmodel_id': [{ id: 'y', model_id: 'm', model_year: 2020, fuel: 'F', fipe_code: 'c',
    models: { id: 'm', brand_id: 'b', name: 'M', brands: { id: 'b', vehicle_type: 'cars', name: 'B' } }, price_points: pts }] });
  const v = await createSupabaseRepository(opts(api.fetchImpl)).getVehicle('y');
  assert.equal(v!.history.length, 24);
  assert.equal(v!.history[0].referenceMonth, '2024-07');
  assert.equal(await createSupabaseRepository(opts(postgrest({}).fetchImpl)).getVehicle('nope'), null);
});

test('HTTP errors become a message the screen can show', async () => {
  const api = postgrest({}, 503);
  await assert.rejects(() => createSupabaseRepository(opts(api.fetchImpl)).listBrands('cars'), /Não foi possível carregar \(503\)/);
});

test('search folds accents, case and spaces; long queries are cut', () => {
  assert.equal(fold('  Automático '), 'automatico');
  const items = ['Modelo B 2.0 Automático', 'Modelo A 1.0'];
  assert.deepEqual(filterByLabel(items, 'AUTOMATICO', s => s), ['Modelo B 2.0 Automático']);
  assert.deepEqual(filterByLabel(items, '   ', s => s), items);
  assert.equal(shortQuery('x'.repeat(100)), 'x'.repeat(40) + '…');
  assert.equal(shortQuery(' curto '), 'curto');
});

test('only the latest request updates the screen', async () => {
  const latest = createLatest();
  let releaseA!: (v: string) => void;
  const a = latest.run(() => new Promise<string>(r => { releaseA = r; }));
  const b = latest.run(async () => 'B');
  releaseA('A');
  assert.deepEqual(await a, { stale: true });
  assert.deepEqual(await b, { stale: false, value: 'B' });
});

test('tap guard drops the second tap of a double tap, allows a later tap', () => {
  let t = 1000;
  const g = createTapGuard(400, () => t);
  assert.equal(g.take(), true);
  t += 120; assert.equal(g.take(), false);
  t += 400; assert.equal(g.take(), true);
});
