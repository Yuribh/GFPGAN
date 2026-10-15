import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONTH_DONE, createPgStore, throttledFetch } from '../fipe/pg-store.ts';

function fakeDb(answers: Record<string, unknown>[] = []) {
  const calls: { text: string; params?: unknown[] }[] = [];
  return { calls, db: { async query(text: string, params?: unknown[]) { calls.push({ text, params }); return { rows: answers.length ? [answers.shift()!] : [] }; } } };
}

test('pg store calls the ingestion SQL functions with typed parameters', async () => {
  const { db, calls } = fakeDb([{ ingest_brand: 'b-1' }]);
  const store = createPgStore(db);
  assert.equal(await store.upsertBrand({ vehicleType: 'cars', sourceCode: '1', name: 'Marca' }), 'b-1');
  assert.match(calls[0].text, /select ingest_brand\(\$1::vehicle_type, \$2, \$3\)/);
  assert.deepEqual(calls[0].params, ['cars', '1', 'Marca']);
  await store.upsertPricePoint({ modelYearId: 'y', referenceMonthId: 'r', priceCents: 123 });
  assert.match(calls[1].text, /ingest_price_point\(\$1::uuid, \$2::uuid, \$3::bigint\)/);
});

test('a budget stop is recorded as failed with its reason (schema has no "partial")', async () => {
  const { db, calls } = fakeDb();
  await createPgStore(db).finishRun('run-1', { status: 'partial', rowsWritten: 5, error: 'budget' });
  assert.deepEqual(calls[0].params, ['run-1', 'failed', 5, 'budget']);
});

test('month completion uses a reserved checkpoint key', async () => {
  const { db, calls } = fakeDb();
  const store = createPgStore(db);
  assert.equal(await store.monthComplete('330'), false);
  await store.markMonthComplete('330');
  assert.deepEqual(calls[1].params, [330, MONTH_DONE]);
});

test('throttledFetch spaces requests to the rate asked', async () => {
  let clock = 0;
  const waits: number[] = [];
  const f = throttledFetch(60, (async () => new Response('ok')) as unknown as typeof fetch,
    async ms => { waits.push(ms); clock += ms; }, () => clock);
  await f('a'); await f('b'); await f('c');
  assert.deepEqual(waits, [1000, 1000], '60 per minute = one per second; the first goes at once');
});
