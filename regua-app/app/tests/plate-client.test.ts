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
