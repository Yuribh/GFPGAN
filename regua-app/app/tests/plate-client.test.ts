import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlateClient } from '../src/data/plate.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const answering = (status: number, body: unknown, seen: RequestInit[] = []) =>
  (async (_url: string, init: RequestInit) => { seen.push(init); return Response.json(body, { status }); }) as unknown as typeof fetch;

test('without Supabase keys the client answers sample data and does not call the network', async () => {
  const c = createPlateClient({ fetchImpl: (() => { throw new Error('no network'); }) as unknown as typeof fetch });
  assert.equal(c.sample, true);
  const a = await c.lookup('ABC1234', ID);
  assert.equal(a.status, 'ok');
  assert.equal((await c.lookup('ABC1000', ID)).status, 'not_found');
});

test('sends the plate, install id and RevenueCat id to the function with the anon key', async () => {
  const seen: RequestInit[] = [];
  const c = createPlateClient({ url: 'https://x.supabase.co', anonKey: 'anon', fetchImpl: answering(200, { status: 'ok', vehicle: { brand: 'M', model: 'X', year: 2020 }, matches: [] }, seen) });
  const a = await c.lookup('ABC1234', ID, 'rc-1');
  assert.equal(a.status, 'ok');
  assert.deepEqual(JSON.parse(String(seen[0].body)), { plate: 'ABC1234', installId: ID, rcUserId: 'rc-1' });
  assert.equal((seen[0].headers as Record<string, string>).apikey, 'anon');
});

test('maps the function answers the screen handles', async () => {
  const mk = (s: number, b: unknown) => createPlateClient({ url: 'https://x', anonKey: 'k', fetchImpl: answering(s, b) });
  assert.deepEqual(await mk(429, { status: 'limit', plus: false, limit: 3 }).lookup('ABC1234', ID), { status: 'limit', plus: false, limit: 3 });
  assert.deepEqual(await mk(404, { status: 'not_found' }).lookup('ABC1234', ID), { status: 'not_found' });
  assert.deepEqual(await mk(503, { status: 'unavailable' }).lookup('ABC1234', ID), { status: 'unavailable' });
  assert.deepEqual(await mk(500, 'oops').lookup('ABC1234', ID), { status: 'unavailable' });
  const offline = createPlateClient({ url: 'https://x', anonKey: 'k', fetchImpl: (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch });
  assert.deepEqual(await offline.lookup('ABC1234', ID), { status: 'offline' });
});

test('a plate whose FIPE codes are not in our catalog is priced through the resolver', async () => {
  const asked: unknown[] = [];
  const match = { modelYearId: 'fipe:cars:002182-2:2025-6', brand: 'Toyota', model: 'Corolla', modelYear: 2025, fuel: 'Híbrido', fipeCode: '002182-2' };
  const resolve = async (codes: string[], year: number | null) => { asked.push([codes, year]); return [match]; };
  const server = (matches: unknown[]) => answering(200, { status: 'ok', vehicle: { brand: 'TOYOTA', model: 'COROLLA', year: 2025, fipeCodes: ['002182-2'] }, matches });
  const a = await createPlateClient({ url: 'https://x', anonKey: 'k', fetchImpl: server([]), resolve }).lookup('ABC1234', ID);
  assert.deepEqual(a.status === 'ok' && a.matches, [match]);
  assert.deepEqual(asked, [[['002182-2'], 2025]]);
  // the catalog already had it: no extra calls
  const own = { ...match, modelYearId: 'uuid-1' };
  const b = await createPlateClient({ url: 'https://x', anonKey: 'k', fetchImpl: server([own]), resolve }).lookup('ABC1234', ID);
  assert.deepEqual(b.status === 'ok' && b.matches, [own]);
  assert.equal(asked.length, 1);
  // FIPE API down: the vehicle still shows, with the manual search
  const c = await createPlateClient({ url: 'https://x', anonKey: 'k', fetchImpl: server([]), resolve: async () => { throw new Error('down'); } }).lookup('ABC1234', ID);
  assert.deepEqual(c.status === 'ok' && c.matches, []);
});

test('sample mode: a real FIPE code, or the invented catalog when asked', async () => {
  const resolved: string[][] = [];
  const real = await createPlateClient({ resolve: async codes => { resolved.push(codes); return []; } }).lookup('ABC1234', ID);
  assert.deepEqual(real.status === 'ok' && real.vehicle.fipeCodes, ['002182-2']);
  assert.deepEqual(resolved, [['002182-2']]);
  const fake = await createPlateClient({ sampleCatalog: true }).lookup('ABC1234', ID);
  assert.equal(fake.status === 'ok' && fake.matches[0].modelYearId, 'y-3');
});
