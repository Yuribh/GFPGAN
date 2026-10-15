// CatalogStore backed by Supabase: write functions through RPC, runs and checkpoints through the REST API.
// Uses the service role key, so it must only ever run on the server (scheduled Edge Function), never in the app.
import type { CatalogStore } from './ingest.ts';

export interface SupabaseStoreOptions { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch }

export function createSupabaseStore(opts: SupabaseStoreOptions): CatalogStore {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.url.replace(/\/$/, '');
  const headers = {
    apikey: opts.serviceRoleKey,
    authorization: `Bearer ${opts.serviceRoleKey}`,
    'content-type': 'application/json',
  };
  async function call<T>(path: string, init: RequestInit): Promise<T> {
    const res = await f(base + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`Supabase ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  const rpc = <T>(fn: string, args: Record<string, unknown>) => call<T>(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

  return {
    upsertReferenceMonth: r => rpc<string>('ingest_reference_month', { p_source_code: r.sourceCode, p_year: r.year, p_month: r.month }),
    upsertBrand: b => rpc<string>('ingest_brand', { p_type: b.vehicleType, p_source_code: b.sourceCode, p_name: b.name }),
    upsertModel: m => rpc<string>('ingest_model', { p_brand_id: m.brandId, p_source_code: m.sourceCode, p_name: m.name }),
    upsertModelYear: y => rpc<string>('ingest_model_year', {
      p_model_id: y.modelId, p_source_code: y.sourceCode, p_model_year: y.modelYear, p_fuel: y.fuel, p_fipe_code: y.fipeCode,
    }),
    upsertPricePoint: async p => { await rpc('ingest_price_point', { p_model_year_id: p.modelYearId, p_reference_month_id: p.referenceMonthId, p_price_cents: p.priceCents }); },
    async getCheckpoint(ref) {
      const rows = await call<{ key: string }[]>(`/rest/v1/ingestion_checkpoints?select=key&reference_code=eq.${encodeURIComponent(ref)}`, { method: 'GET' });
      return new Set(rows.map(r => r.key));
    },
    async addCheckpoint(ref, key) {
      await call('/rest/v1/ingestion_checkpoints?on_conflict=reference_code,key', {
        method: 'POST', body: JSON.stringify({ reference_code: Number(ref), key }),
        headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
      });
    },
    async startRun() {
      const rows = await call<{ id: string }[]>('/rest/v1/ingestion_runs?select=id', {
        method: 'POST', body: JSON.stringify({ status: 'running' }), headers: { prefer: 'return=representation' },
      });
      return rows[0].id;
    },
    async finishRun(id, r) {
      // the schema allows running | succeeded | failed; a budget stop is recorded as failed with its reason
      const status = r.status === 'partial' ? 'failed' : r.status;
      await call(`/rest/v1/ingestion_runs?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify({ status, rows_written: r.rowsWritten, error: r.error ?? null, finished_at: new Date().toISOString() }),
        headers: { prefer: 'return=minimal' },
      });
    },
  };
}
