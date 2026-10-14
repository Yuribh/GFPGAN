import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdvisorClient } from '../src/data/advisor.ts';
import { createFakeRepository } from '../src/data/fake.ts';

const ID = '11111111-1111-4111-8111-111111111111';

test('sample mode answers locally and says it is an example', async () => {
  const c = createAdvisorClient({ fetchImpl: (() => { throw new Error('no network'); }) as unknown as typeof fetch });
  const v = await createFakeRepository().getVehicle('y-1');
  const a = await c.ask({ question: 'ok?', history: [], installId: ID, vehicle: v });
  assert.equal(a.status, 'ok');
  assert.match((a as { answer: string }).answer, /exemplo/);
});

test('sends only the vehicle id (the server reads the prices) and maps answers', async () => {
  const seen: RequestInit[] = [];
  const mk = (status: number, body: unknown) => createAdvisorClient({ url: 'https://x', anonKey: 'k',
    fetchImpl: (async (_u: string, init: RequestInit) => { seen.push(init); return Response.json(body, { status }); }) as unknown as typeof fetch });
  const v = await createFakeRepository().getVehicle('y-1');
  assert.deepEqual(await mk(200, { status: 'ok', answer: 'Oi' }).ask({ question: 'q', history: [], installId: ID, vehicle: v }), { status: 'ok', answer: 'Oi' });
  const sent = JSON.parse(String(seen[0].body));
  assert.equal(sent.modelYearId, 'y-1');
  assert.ok(!('vehicle' in sent) && !JSON.stringify(sent).includes('priceCents'));
  assert.deepEqual(await mk(429, { status: 'limit', plus: false, limit: 5 }).ask({ question: 'q', history: [], installId: ID }), { status: 'limit', plus: false, limit: 5 });
  assert.deepEqual(await mk(503, {}).ask({ question: 'q', history: [], installId: ID }), { status: 'unavailable' });
  const off = createAdvisorClient({ url: 'https://x', anonKey: 'k', fetchImpl: (async () => { throw new TypeError('fail'); }) as unknown as typeof fetch });
  assert.deepEqual(await off.ask({ question: 'q', history: [], installId: ID }), { status: 'offline' });
});
