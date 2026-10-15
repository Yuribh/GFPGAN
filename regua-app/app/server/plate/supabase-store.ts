// PlateStore backed by Supabase (service role key: server only, never in the app).
import type { CatalogMatch, PlateStore, QuotaResult } from './lookup.ts';
import type { PlateVehicle } from './provider.ts';

type Row = { id: string; model_year: number; fuel: string; fipe_code: string; models: { name: string; brands: { name: string } } };

export function createSupabasePlateStore(opts: { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch }): PlateStore {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.url.replace(/\/$/, '');
  const headers = { apikey: opts.serviceRoleKey, authorization: `Bearer ${opts.serviceRoleKey}`, 'content-type': 'application/json' };
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await f(base + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`Supabase ${res.status} on ${path.split('?')[0]}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  return {
    async getCached(h) {
      const rows = await call<{ vehicle: PlateVehicle }[]>(`/rest/v1/plate_cache?plate_hash=eq.${h}&fetched_at=gte.${encodeURIComponent(new Date(Date.now() - 90 * 864e5).toISOString())}&select=vehicle`);
      return rows[0]?.vehicle ?? null;
    },
    async putCached(h, v) {
      await call('/rest/v1/plate_cache', {
        method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ plate_hash: h, vehicle: v, fetched_at: new Date().toISOString() }),
      });
    },
    takeQuota: (id, deviceLimit, globalLimit) => call<QuotaResult>('/rest/v1/rpc/take_plate_quota', {
      method: 'POST', body: JSON.stringify({ p_install_id: id, p_device_limit: deviceLimit, p_global_limit: globalLimit }),
    }),
    async matchFipeCodes(codes) {
      const list = codes.map(c => `"${c}"`).join(',');
      const rows = await call<Row[]>(`/rest/v1/model_years?fipe_code=in.(${encodeURIComponent(list)})&select=id,model_year,fuel,fipe_code,models(name,brands(name))&limit=50`);
      return rows.map((r): CatalogMatch => ({
        modelYearId: r.id, brand: r.models.brands.name, model: r.models.name, modelYear: r.model_year, fuel: r.fuel, fipeCode: r.fipe_code,
      }));
    },
  };
}
