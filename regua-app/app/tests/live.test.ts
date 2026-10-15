import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiveRepository, isLiveId, parseFipeId, parseLiveId, parseYear } from '../src/data/live.ts';

// Shapes and values from the real API (Toyota Corolla Altis Híbrido 2025, FIPE 002182-2, seen 2026-10-14);
// the September price is invented to check the monthly change.
function api(opts: { failRefs?: boolean } = {}) {
  const calls: string[] = [];
  const car = (month: string, price: string) => ({ brand: 'Toyota', codeFipe: '002182-2', fuel: 'Híbrido', fuelAcronym: 'H',
    model: 'Corolla Altis Híbrido 1.8 16V Aut.', modelYear: 2025, price, priceHistory: [], referenceMonth: month, vehicleType: 1 });
  const y = '/cars/brands/56/models/9984/years/2025-6';
  const routes: Record<string, unknown> = {
    '/references': [{ code: '329', month: 'setembro/2026' }, { code: '330', month: 'outubro/2026' }, { code: '328', month: 'agosto/2026' }],
    '/cars/brands': [{ code: '59', name: 'VW - VolksWagen' }, { code: '56', name: 'Toyota' }],
    '/cars/brands/56/models': [{ code: '9984', name: 'Corolla Altis Híbrido 1.8 16V Aut.' }],
    '/cars/brands/56/models/9984/years': [{ code: '2024-6', name: '2024 Híbrido' }, { code: '2025-6', name: '2025 Híbrido' }],
    [y]: car('outubro de 2026', 'R$ 173.645,00'),
    [`${y}?reference=330`]: car('outubro de 2026', 'R$ 173.645,00'),
    [`${y}?reference=329`]: car('setembro de 2026', 'R$ 175.000,00'),
    // by FIPE code (plate lookups)
    '/cars/002182-2/years': [{ code: '2024-6', name: '2024 Híbrido' }, { code: '2025-6', name: '2025 Híbrido' }],
    '/cars/002182-2/years/2025-6': car('outubro de 2026', 'R$ 173.645,00'),
    '/cars/002182-2/years/2025-6?reference=330': car('outubro de 2026', 'R$ 173.645,00'),
    '/cars/002182-2/years/2024-6': car('outubro de 2026', 'R$ 160.000,00'),
    '/motorcycles/811001-0/years': [{ code: '2022-1', name: '2022 Gasolina' }],
    '/motorcycles/811001-0/years/2022-1': { ...car('outubro de 2026', 'R$ 15.000,00'), brand: 'Honda', model: 'CG 160', modelYear: 2022, codeFipe: '811001-0' },
  };
  const fetchImpl = (async (url: string) => {
    const path = url.replace('https://fipe.parallelum.com.br/api/v2', '');
    calls.push(path);
    if (path === '/references' && opts.failRefs) return new Response('{}', { status: 500 });
    if (path === `${y}?reference=328`) return new Response('{}', { status: 500 });   // an old month failing must not break the screen
    return path in routes ? Response.json(routes[path]) : new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

test('live repository walks brand -> model -> year -> real price with history', async () => {
  const { fetchImpl, calls } = api();
  const repo = createLiveRepository({ fetchImpl });
  const brands = await repo.listBrands('cars');
  assert.deepEqual(brands.map(b => b.name), ['Toyota', 'VW - VolksWagen']);
  const [model] = await repo.listModels(brands[0].id);
  assert.equal(model.id, 'cars:56:9984');
  const years = await repo.listYears(model.id);
  assert.deepEqual(years.map(y => [y.modelYear, y.fuel]), [[2025, 'Híbrido'], [2024, 'Híbrido']]);
  const v = await repo.getVehicle(years[0].id);
  assert.ok(v);
  assert.equal(v.latest.priceCents, 17_364_500);
  assert.equal(v.latest.referenceMonth, '2026-10');
  assert.equal(v.year.fipeCode, '002182-2');
  assert.equal(v.brand.name, 'Toyota');
  assert.deepEqual(v.history.map(p => p.referenceMonth), ['2026-09', '2026-10']);
  assert.equal(v.change?.cents, -135_500);
  // answers are reused within the session; only the month that failed is asked again
  const n = calls.length;
  await repo.getVehicle(years[0].id); await repo.listBrands('cars');
  assert.deepEqual(calls.slice(n), ['/cars/brands/56/models/9984/years/2025-6?reference=328']);
});

test('live repository still shows the current price when the month list fails', async () => {
  const repo = createLiveRepository({ fetchImpl: api({ failRefs: true }).fetchImpl });
  const v = await repo.getVehicle('cars:56:9984:2025-6');
  assert.equal(v?.latest.priceCents, 17_364_500);
  assert.equal(v?.history.length, 1);
  assert.equal(v?.change, null);
});

test('live ids and year labels', () => {
  assert.deepEqual(parseLiveId('motorcycles:80:5:2020-1'), { type: 'motorcycles', brand: '80', model: '5', year: '2020-1' });
  assert.equal(parseLiveId('y-1'), null);
  assert.equal(parseLiveId('2b6f-uuid'), null);
  assert.deepEqual(parseYear({ code: '32000-1', name: '32000 Gasolina' }), { modelYear: 32000, fuel: 'Gasolina' });
  assert.deepEqual(parseYear({ code: '2019-3', name: '' }), { modelYear: 2019, fuel: 'Diesel' });
});

test('unknown vehicle -> null, not an error', async () => {
  const repo = createLiveRepository({ fetchImpl: api().fetchImpl });
  assert.equal(await repo.getVehicle('cars:56:1:2025-6'), null);
  assert.equal(await repo.getVehicle('y-1'), null);
});

test('plate FIPE codes -> versions by FIPE code, the plate year first, and their price', async () => {
  const repo = createLiveRepository({ fetchImpl: api().fetchImpl });
  const m = await repo.matchFipeCodes(['002182-2'], 2025);
  assert.deepEqual(m, [{ modelYearId: 'fipe:cars:002182-2:2025-6', brand: 'Toyota', model: 'Corolla Altis Híbrido 1.8 16V Aut.', modelYear: 2025, fuel: 'Híbrido', fipeCode: '002182-2' }]);
  // year unknown: every year, newest first
  assert.deepEqual((await repo.matchFipeCodes(['002182-2'], null)).map(x => x.modelYear), [2025, 2024]);
  // a motorcycle code is not found among cars, then is found among motorcycles
  const moto = await repo.matchFipeCodes(['811001-0'], 2022);
  assert.equal(moto[0].modelYearId, 'fipe:motorcycles:811001-0:2022-1');
  assert.equal(moto[0].brand, 'Honda');
  assert.deepEqual(await repo.matchFipeCodes(['999999-9'], 2020), []);
  const v = await repo.getVehicle(m[0].modelYearId);
  assert.equal(v?.latest.priceCents, 17_364_500);
  assert.equal(v?.year.fipeCode, '002182-2');
  assert.deepEqual((await repo.listYears(v!.model.id)).map(y => y.id), ['fipe:cars:002182-2:2025-6', 'fipe:cars:002182-2:2024-6']);
  assert.deepEqual(parseFipeId('fipe:trucks:500001-1:2010-3'), { type: 'trucks', code: '500001-1', year: '2010-3' });
  assert.equal(parseFipeId('fipe:boats:500001-1:2010-3'), null);
  assert.ok(isLiveId('fipe:cars:002182-2:2025-6') && isLiveId('cars:56:9984:2025-6') && !isLiveId('3f1c2a9e-0000-4000-8000-000000000000'));
});

test('answers saved on the phone: reused after a restart, refreshed when old, used offline', async () => {
  const saved = new Map<string, string>();
  const persist = { get: async (k: string) => saved.get(k) ?? null, set: async (k: string, v: string) => { saved.set(k, v); } };
  let t = Date.parse('2026-10-14T12:00:00Z');
  const first = api();
  const v1 = await createLiveRepository({ fetchImpl: first.fetchImpl, persist, now: () => t }).getVehicle('cars:56:9984:2025-6');
  assert.equal(v1?.latest.priceCents, 17_364_500);
  assert.ok(saved.has('fipe:/references') && saved.has('fipe:/cars/brands/56/models/9984/years/2025-6?reference=330'));

  // app restarted an hour later: nothing asked again except the month that failed before
  const second = api();
  const v2 = await createLiveRepository({ fetchImpl: second.fetchImpl, persist, now: () => t + 3_600_000 }).getVehicle('cars:56:9984:2025-6');
  assert.deepEqual(v2, v1);
  assert.deepEqual(second.calls, ['/cars/brands/56/models/9984/years/2025-6?reference=328']);

  // a day later the month list is asked again (a new month may be out); prices of past months never are
  t += 86_400_000;
  const third = api();
  await createLiveRepository({ fetchImpl: third.fetchImpl, persist, now: () => t }).getVehicle('cars:56:9984:2025-6');
  assert.deepEqual(third.calls.filter(c => !c.endsWith('reference=328')), ['/references']);

  // offline: the brand list saved earlier still shows, even when old
  const lists = createLiveRepository({ fetchImpl: api().fetchImpl, persist, now: () => t });
  await lists.listBrands('cars');
  const offline = createLiveRepository({ fetchImpl: (async () => { throw new TypeError('Network request failed'); }) as typeof fetch, persist, now: () => t + 30 * 86_400_000 });
  assert.deepEqual((await offline.listBrands('cars')).map(b => b.name), ['Toyota', 'VW - VolksWagen']);
  await assert.rejects(offline.listBrands('trucks'));   // never seen: the screen shows its error
});

test('saved answers: a broken store never breaks the screen', async () => {
  const persist = { get: async () => { throw new Error('disk'); }, set: async () => { throw new Error('full'); } };
  const v = await createLiveRepository({ fetchImpl: api().fetchImpl, persist }).getVehicle('cars:56:9984:2025-6');
  assert.equal(v?.latest.priceCents, 17_364_500);
});
