import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlateProvider, parsePlateResponse, type PlateVehicle } from '../plate/provider.ts';
import { createRevenueCatCheck, hashPlate, lookupPlate, rankMatches, type CatalogMatch, type LookupDeps } from '../plate/lookup.ts';
import { createMemoryPlateStore } from '../plate/memory-store.ts';

const INSTALL = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

// ---------- response parsing: shapes seen in Brazilian plate APIs (invented values) ----------
test('parses a flat response with codigo_fipe', () => {
  const v = parsePlateResponse({ placa: 'ABC1D23', marca: 'MARCA', modelo: 'MODELO 1.0', anoModelo: '2020', codigo_fipe: '0012345' });
  assert.deepEqual(v, { brand: 'MARCA', model: 'MODELO 1.0', year: 2020, fipeCodes: ['001234-5'] });
});
test('parses a wrapped response with a list of FIPE entries', () => {
  const v = parsePlateResponse({ status: 'ok', data: { MARCA: 'MARCA', MODELO: 'MODELO', ano_modelo: 2019,
    fipe: { dados: [{ codigo_fipe: '001234-5', texto_valor: 'R$ 1,00' }, { codigo_fipe: '001234-6' }] } } });
  assert.equal(v?.year, 2019);
  assert.deepEqual(v?.fipeCodes, ['001234-5', '001234-6']);
});
test('parses "fipe": [{ "codigo": ... }] and "ano": "2018/2019" (takes the first 4 digits)', () => {
  const v = parsePlateResponse({ veiculo: { marca: 'M', modelo: 'X', ano: '2018/2019' }, fipe: [{ codigo: '123456-7' }] });
  assert.equal(v?.year, 2018);
  assert.deepEqual(v?.fipeCodes, ['123456-7']);
});
test('ignores numbers that are not FIPE codes and empty payloads', () => {
  assert.deepEqual(parsePlateResponse({ marca: 'M', modelo: 'X', renavam: '12345678901', chassi: '9BW' })?.fipeCodes, []);
  assert.equal(parsePlateResponse({ mensagem: 'Placa não encontrada' }), null);
  assert.equal(parsePlateResponse(null), null);
});

// ---------- provider HTTP ----------
test('provider sends the token as configured and maps 404 to null', async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    return url.includes('ZZZ') ? new Response('{}', { status: 404 }) : Response.json({ marca: 'M', modelo: 'X', codigo_fipe: '001234-5' });
  }) as unknown as typeof fetch;
  const q = createPlateProvider({ urlTemplate: 'https://p.test/placa/{plate}', token: 'T', auth: 'query:key', fetchImpl });
  assert.equal((await q.lookup('ABC1234'))?.brand, 'M');
  assert.equal(calls[0].url, 'https://p.test/placa/ABC1234?key=T');
  assert.equal(await q.lookup('ZZZ1234'), null);
  const h = createPlateProvider({ urlTemplate: 'https://p.test/{plate}', token: 'T', auth: 'header:X-Api-Key', fetchImpl });
  await h.lookup('ABC1234');
  assert.equal(calls[2].headers['X-Api-Key'], 'T');
  const b = createPlateProvider({ urlTemplate: 'https://p.test/{plate}', token: 'T', fetchImpl });
  await b.lookup('ABC1234');
  assert.equal(calls[3].headers.authorization, 'Bearer T');
});

// ---------- lookup flow ----------
const catalog: CatalogMatch[] = [
  { modelYearId: 'y-2019', brand: 'Marca', model: 'Modelo', modelYear: 2019, fuel: 'Flex', fipeCode: '001234-5' },
  { modelYearId: 'y-2020', brand: 'Marca', model: 'Modelo', modelYear: 2020, fuel: 'Flex', fipeCode: '001234-5' },
  { modelYearId: 'y-other', brand: 'Marca', model: 'Outro', modelYear: 2020, fuel: 'Flex', fipeCode: '999999-9' },
];
function setup(opts: { vehicle?: PlateVehicle | null; fail?: boolean; plus?: boolean; globalDaily?: number } = {}) {
  const mem = createMemoryPlateStore(catalog);
  let providerCalls = 0;
  const deps: LookupDeps = {
    store: mem.store,
    provider: { async lookup() {
      providerCalls++;
      if (opts.fail) { const { PlateProviderError } = await import('../plate/provider.ts'); throw new PlateProviderError('down', 502); }
      return opts.vehicle === undefined ? { brand: 'Marca', model: 'Modelo', year: 2020, fipeCodes: ['001234-5'] } : opts.vehicle;
    } },
    isPlus: async () => opts.plus ?? false,
    pepper: 'pepper',
    limits: { free: 3, plus: 30, globalDaily: opts.globalDaily ?? 1000 },
  };
  return { deps, mem, calls: () => providerCalls };
}

test('a valid plate returns the vehicle and the catalog rows of the same model year first', async () => {
  const { deps } = setup();
  const r = await lookupPlate(deps, { plate: 'abc-1234', installId: INSTALL });
  assert.equal(r.status, 'ok');
  if (r.status !== 'ok') return;
  assert.deepEqual(r.matches.map(m => m.modelYearId), ['y-2020']);
  assert.equal(r.cached, false);
});

test('the second lookup of the same plate comes from the cache (no second paid call)', async () => {
  const { deps, calls } = setup();
  await lookupPlate(deps, { plate: 'ABC1234', installId: INSTALL });
  const r = await lookupPlate(deps, { plate: 'abc1234', installId: OTHER });
  assert.equal(calls(), 1);
  assert.equal(r.status === 'ok' && r.cached, true);
});

test('plates are stored only as a keyed hash', async () => {
  const { deps, mem } = setup();
  await lookupPlate(deps, { plate: 'ABC1234', installId: INSTALL });
  const keys = [...mem.cache.keys()];
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify([...mem.cache]).includes('ABC1234'));
  assert.notEqual(await hashPlate('ABC1234', 'a'), await hashPlate('ABC1234', 'b'));
});

test('free devices get 3 lookups a day, then a limit answer that offers Plus', async () => {
  const { deps } = setup();
  for (let i = 0; i < 3; i++) assert.equal((await lookupPlate(deps, { plate: 'ABC1234', installId: INSTALL })).status, 'ok');
  assert.deepEqual(await lookupPlate(deps, { plate: 'ABC1234', installId: INSTALL }), { status: 'limit', plus: false, limit: 3 });
  assert.equal((await lookupPlate(deps, { plate: 'ABC1234', installId: OTHER })).status, 'ok', 'other devices are not affected');
});

test('Plus devices get the higher limit', async () => {
  const { deps } = setup({ plus: true });
  for (let i = 0; i < 30; i++) assert.equal((await lookupPlate(deps, { plate: 'ABC1234', installId: INSTALL })).status, 'ok');
  assert.deepEqual(await lookupPlate(deps, { plate: 'ABC1234', installId: INSTALL }), { status: 'limit', plus: true, limit: 30 });
});

test('when the daily budget is spent, cached plates still work and new ones are unavailable', async () => {
  const { deps, calls } = setup({ globalDaily: 1 });
  assert.equal((await lookupPlate(deps, { plate: 'ABC1234', installId: INSTALL })).status, 'ok');
  assert.equal((await lookupPlate(deps, { plate: 'ABC1234', installId: OTHER })).status, 'ok');
  assert.equal((await lookupPlate(deps, { plate: 'XYZ9A99', installId: OTHER })).status, 'unavailable');
  assert.equal(calls(), 1);
});

test('bad input, unknown plates and provider failures', async () => {
  assert.equal((await lookupPlate(setup().deps, { plate: 'ABC12', installId: INSTALL })).status, 'invalid_plate');
  assert.equal((await lookupPlate(setup().deps, { plate: 'ABC1234', installId: 'x' })).status, 'invalid_request');
  assert.equal((await lookupPlate(setup().deps, null)).status, 'invalid_request');
  assert.equal((await lookupPlate(setup({ vehicle: null }).deps, { plate: 'ABC1234', installId: INSTALL })).status, 'not_found');
  assert.equal((await lookupPlate(setup({ fail: true }).deps, { plate: 'ABC1234', installId: INSTALL })).status, 'unavailable');
  const off = setup().deps; off.provider = null;
  assert.equal((await lookupPlate(off, { plate: 'ABC1234', installId: INSTALL })).status, 'unavailable');
});

test('a vehicle whose FIPE code is not in the catalog still returns make and model, with no matches', async () => {
  const { deps } = setup({ vehicle: { brand: 'Marca', model: 'Raro', year: 1990, fipeCodes: ['555555-5'] } });
  const r = await lookupPlate(deps, { plate: 'ABC1234', installId: INSTALL });
  assert.equal(r.status === 'ok' && r.matches.length, 0);
});

test('rankMatches: exact year first, zero km for this year, otherwise all versions', () => {
  const rows = (years: number[]) => years.map(y => ({ ...catalog[0], modelYearId: String(y), modelYear: y }));
  assert.deepEqual(rankMatches(rows([2019, 2020, 2021]), 2020).map(m => m.modelYear), [2020]);
  assert.deepEqual(rankMatches(rows([2025, 32000]), 2026, 2026).map(m => m.modelYear), [32000]);
  assert.deepEqual(rankMatches(rows([2018, 2019]), 2024).map(m => m.modelYear), [2019, 2018]);
  assert.deepEqual(rankMatches(rows([2018, 2019]), null).map(m => m.modelYear), [2019, 2018]);
});

test('RevenueCat check: active, expired, lifetime, missing key or user', async () => {
  const now = Date.parse('2026-10-14T00:00:00Z');
  const fetchFor = (exp: string | null | undefined) => (async () => Response.json({ subscriber: { entitlements: exp === undefined ? {} : { plus: { expires_date: exp } } } })) as unknown as typeof fetch;
  assert.equal(await createRevenueCatCheck({ secretKey: 's', fetchImpl: fetchFor('2026-11-01T00:00:00Z'), now: () => now })('u'), true);
  assert.equal(await createRevenueCatCheck({ secretKey: 's', fetchImpl: fetchFor('2026-10-01T00:00:00Z'), now: () => now })('u'), false);
  assert.equal(await createRevenueCatCheck({ secretKey: 's', fetchImpl: fetchFor(null), now: () => now })('u'), true);
  assert.equal(await createRevenueCatCheck({ secretKey: 's', fetchImpl: fetchFor(undefined), now: () => now })('u'), false);
  assert.equal(await createRevenueCatCheck({ fetchImpl: fetchFor(null) })('u'), false);
  assert.equal(await createRevenueCatCheck({ secretKey: 's', fetchImpl: fetchFor(null) })(undefined), false);
});
