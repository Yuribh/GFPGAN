// Real repository: reads the catalog from Supabase's REST API (PostgREST) with the public anon key.
// Signed-out reads are allowed by migration 0002, so lookups need no account.
import type { Brand, FipeRepository, Model, ModelYear, PricePoint, VehicleType } from './types.ts';
import { buildVehicleResult } from './vehicle.ts';

export interface SupabaseRepoOptions { url: string; anonKey: string; fetchImpl?: typeof fetch; historyMonths?: number }

type BrandRow = { id: string; vehicle_type: VehicleType; name: string };
type ModelRow = { id: string; brand_id: string; name: string };
type YearRow = { id: string; model_id: string; model_year: number; fuel: string; fipe_code: string };
type VehicleRow = YearRow & {
  models: ModelRow & { brands: BrandRow };
  price_points: { price_cents: number; currency: string; reference_months: { year: number; month: number } }[];
};

const brand = (r: BrandRow): Brand => ({ id: r.id, vehicleType: r.vehicle_type, name: r.name });
const model = (r: ModelRow): Model => ({ id: r.id, brandId: r.brand_id, name: r.name });
const year = (r: YearRow): ModelYear => ({ id: r.id, modelId: r.model_id, modelYear: r.model_year, fuel: r.fuel, fipeCode: r.fipe_code });
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'pt-BR');

export function createSupabaseRepository(opts: SupabaseRepoOptions): FipeRepository {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.url.replace(/\/$/, '') + '/rest/v1';
  const historyMonths = opts.historyMonths ?? 24;
  async function get<T>(path: string): Promise<T> {
    const res = await f(base + path, { headers: { apikey: opts.anonKey, authorization: `Bearer ${opts.anonKey}`, accept: 'application/json' } });
    if (!res.ok) throw new Error(`Não foi possível carregar (${res.status})`);
    return (await res.json()) as T;
  }
  const eq = (v: string) => `eq.${encodeURIComponent(v)}`;

  return {
    async listBrands(type) {
      return (await get<BrandRow[]>(`/brands?select=id,vehicle_type,name&vehicle_type=${eq(type)}&order=name`)).map(brand).sort(byName);
    },
    async listModels(brandId) {
      return (await get<ModelRow[]>(`/models?select=id,brand_id,name&brand_id=${eq(brandId)}&order=name`)).map(model).sort(byName);
    },
    async listYears(modelId) {
      return (await get<YearRow[]>(`/model_years?select=id,model_id,model_year,fuel,fipe_code&model_id=${eq(modelId)}&order=model_year.desc`))
        .map(year).sort((a, b) => b.modelYear - a.modelYear);
    },
    async getVehicle(modelYearId) {
      const select = 'id,model_id,model_year,fuel,fipe_code,models(id,brand_id,name,brands(id,vehicle_type,name)),'
        + 'price_points(price_cents,currency,reference_months(year,month))';
      const rows = await get<VehicleRow[]>(`/model_years?select=${encodeURIComponent(select)}&id=${eq(modelYearId)}`);
      const r = rows[0];
      if (!r || !r.models?.brands) return null;
      const points: PricePoint[] = (r.price_points ?? [])
        .filter(p => p.reference_months)
        .map(p => ({
          modelYearId: r.id,
          referenceMonth: `${p.reference_months.year}-${String(p.reference_months.month).padStart(2, '0')}`,
          priceCents: Number(p.price_cents),
          currency: 'BRL' as const,
        }))
        .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
        .slice(-historyMonths);
      return buildVehicleResult(brand(r.models.brands), model(r.models), year(r), points);
    },
  };
}
