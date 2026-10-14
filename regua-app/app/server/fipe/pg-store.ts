// CatalogStore over a direct Postgres connection (the Supabase database URL), for the import job that runs
// on GitHub Actions or a computer. Same SQL write functions as the Edge Function store (migration 0003).
import type { CatalogStore } from './ingest.ts';

export interface Queryable { query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }

/** checkpoint key that marks a reference month as fully imported */
export const MONTH_DONE = '*complete*';

export function createPgStore(db: Queryable): CatalogStore & { monthComplete(ref: string): Promise<boolean>; markMonthComplete(ref: string): Promise<void> } {
  const one = async (sql: string, params: unknown[]) => String(Object.values((await db.query(sql, params)).rows[0])[0]);
  return {
    upsertReferenceMonth: r => one('select ingest_reference_month($1, $2::smallint, $3::smallint)', [r.sourceCode, r.year, r.month]),
    upsertBrand: b => one('select ingest_brand($1::vehicle_type, $2, $3)', [b.vehicleType, b.sourceCode, b.name]),
    upsertModel: m => one('select ingest_model($1::uuid, $2, $3)', [m.brandId, m.sourceCode, m.name]),
    upsertModelYear: y => one('select ingest_model_year($1::uuid, $2, $3::smallint, $4, $5)', [y.modelId, y.sourceCode, y.modelYear, y.fuel, y.fipeCode]),
    upsertPricePoint: async p => { await db.query('select ingest_price_point($1::uuid, $2::uuid, $3::bigint)', [p.modelYearId, p.referenceMonthId, p.priceCents]); },
    async getCheckpoint(ref) {
      const { rows } = await db.query('select key from ingestion_checkpoints where reference_code = $1', [Number(ref)]);
      return new Set(rows.map(r => String(r.key)));
    },
    async addCheckpoint(ref, key) {
      await db.query('insert into ingestion_checkpoints (reference_code, key) values ($1, $2) on conflict do nothing', [Number(ref), key]);
    },
    startRun: async () => one("insert into ingestion_runs (status) values ('running') returning id", []),
    async finishRun(id, r) {
      const status = r.status === 'partial' ? 'failed' : r.status;   // schema: running | succeeded | failed
      await db.query('update ingestion_runs set status = $2, rows_written = $3, error = $4, finished_at = now() where id = $1::uuid',
        [id, status, r.rowsWritten, r.error ?? null]);
    },
    async monthComplete(ref) {
      const { rows } = await db.query('select 1 from ingestion_checkpoints where reference_code = $1 and key = $2', [Number(ref), MONTH_DONE]);
      return rows.length > 0;
    },
    async markMonthComplete(ref) {
      await db.query('insert into ingestion_checkpoints (reference_code, key) values ($1, $2) on conflict do nothing', [Number(ref), MONTH_DONE]);
    },
  };
}

/** fetch that waits so at most `perMinute` requests start per minute (the FIPE API asks for 50 to 60). */
export function throttledFetch(perMinute: number, base: typeof fetch = fetch, sleep = (ms: number) => new Promise(r => setTimeout(r, ms)), now = () => Date.now()): typeof fetch {
  const gap = 60_000 / Math.max(1, perMinute);
  let next = 0;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const t = now();
    const wait = Math.max(0, next - t);
    next = Math.max(t, next) + gap;
    if (wait) await sleep(wait);
    return base(input, init);
  }) as typeof fetch;
}
