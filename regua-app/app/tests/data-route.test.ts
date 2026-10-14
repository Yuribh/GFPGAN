import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withLiveIds } from '../src/data/index.ts';
import type { FipeRepository } from '../src/data/types.ts';

test('with Supabase, ids from the FIPE API (plate lookups) still open; catalog ids go to Supabase', async () => {
  const seen: string[] = [];
  const base: FipeRepository = {
    listBrands: async () => [], listModels: async () => [], listYears: async () => [],
    getVehicle: async id => { seen.push(id); return null; },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 404 })) as typeof fetch;
  try {
    const repo = withLiveIds(base);
    await repo.getVehicle('3f1c2a9e-0000-4000-8000-000000000000');
    assert.equal(await repo.getVehicle('fipe:cars:002182-2:2025-6'), null);   // live repository (API says 404 here)
    assert.deepEqual(seen, ['3f1c2a9e-0000-4000-8000-000000000000']);
  } finally { globalThis.fetch = realFetch; }
});
