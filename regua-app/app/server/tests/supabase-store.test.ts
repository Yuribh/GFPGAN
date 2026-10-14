import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStore } from '../fipe/supabase-store.ts';

function recorder(responses: Record<string, unknown> = {}) {
  const calls: { url: string; method: string; body: unknown; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null, headers: init.headers as Record<string, string> });
    const key = Object.keys(responses).find(k => url.includes(k));
    return new Response(key ? JSON.stringify(responses[key]) : '', { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

test('RPC calls use the argument names of the SQL functions and the service key', async () => {
  const r = recorder({ 'rpc/ingest_brand': 'brand-uuid' });
  const s = createSupabaseStore({ url: 'https://x.supabase.co/', serviceRoleKey: 'svc', fetchImpl: r.fetchImpl });
  const id = await s.upsertBrand({ vehicleType: 'cars', sourceCode: '1', name: 'Marca' });
  assert.equal(id, 'brand-uuid');
  assert.equal(r.calls[0].url, 'https://x.supabase.co/rest/v1/rpc/ingest_brand');
  assert.deepEqual(r.calls[0].body, { p_type: 'cars', p_source_code: '1', p_name: 'Marca' });
  assert.equal(r.calls[0].headers.apikey, 'svc');
  assert.equal(r.calls[0].headers.authorization, 'Bearer svc');
});

test('price point args match ingest_price_point(uuid, uuid, bigint)', async () => {
  const r = recorder();
  const s = createSupabaseStore({ url: 'https://x.supabase.co', serviceRoleKey: 'svc', fetchImpl: r.fetchImpl });
  await s.upsertPricePoint({ modelYearId: 'y', referenceMonthId: 'm', priceCents: 4567800 });
  assert.deepEqual(r.calls[0].body, { p_model_year_id: 'y', p_reference_month_id: 'm', p_price_cents: 4567800 });
});

test('a partial run is stored with a status the schema accepts', async () => {
  const r = recorder();
  const s = createSupabaseStore({ url: 'https://x.supabase.co', serviceRoleKey: 'svc', fetchImpl: r.fetchImpl });
  await s.finishRun('run-1', { status: 'partial', rowsWritten: 10, error: 'budget' });
  assert.equal(r.calls[0].method, 'PATCH');
  assert.equal((r.calls[0].body as { status: string }).status, 'failed');
  assert.match(r.calls[0].url, /ingestion_runs\?id=eq\.run-1$/);
});

test('HTTP errors surface with status and path', async () => {
  const fetchImpl = (async () => new Response('permission denied', { status: 401 })) as typeof fetch;
  const s = createSupabaseStore({ url: 'https://x.supabase.co', serviceRoleKey: 'bad', fetchImpl });
  await assert.rejects(() => s.upsertBrand({ vehicleType: 'cars', sourceCode: '1', name: 'x' }), /Supabase 401 on \/rest\/v1\/rpc\/ingest_brand/);
});
