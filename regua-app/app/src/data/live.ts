// Live repository: reads the official FIPE table straight from the public FIPE API (no Supabase needed).
// Ids carry the API path ("cars:56:9984:2025-6"), so a saved favourite can be fetched again later.
// Each phone calls the API itself; the free tier allows a few hundred requests a day per address, plenty for one person.
import { parsePriceToCents, parseReferenceMonth } from '../../server/fipe/parse.ts';
import type { Brand, FipeRepository, Model, ModelYear, PricePoint, VehicleType } from './types.ts';
import { buildVehicleResult } from './vehicle.ts';

export interface LiveRepoOptions { baseUrl?: string; fetchImpl?: typeof fetch; historyMonths?: number }

type CodeName = { code: string; name: string };
type Reference = { code: string; month: string };
type Vehicle = { brand: string; codeFipe: string; fuel: string; model: string; modelYear: number; price: string; referenceMonth: string };

const FUELS: Record<string, string> = { '1': 'Gasolina', '2': 'Álcool', '3': 'Diesel', '4': 'Elétrico', '5': 'Flex', '6': 'Híbrido' };
const TYPES: VehicleType[] = ['cars', 'motorcycles', 'trucks'];
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'pt-BR');

/** "cars:56:9984:2025-6" -> its parts; null for anything else (e.g. an id saved by another data source) */
export function parseLiveId(id: string): { type: VehicleType; brand: string; model?: string; year?: string } | null {
  const [type, brand, model, year] = id.split(':');
  if (!TYPES.includes(type as VehicleType) || !brand) return null;
  return { type: type as VehicleType, brand, model, year };
}

/** "2025 Híbrido" / code "2025-6" -> { modelYear: 2025, fuel: "Híbrido" } (32000 = zero km) */
export function parseYear(y: CodeName): { modelYear: number; fuel: string } {
  const [yr, fuelCode] = y.code.split('-');
  const fromName = y.name.replace(/^\s*\d{4,5}\s*/, '').trim();
  return { modelYear: Number(yr), fuel: fromName || FUELS[fuelCode] || '' };
}

export function createLiveRepository(opts: LiveRepoOptions = {}): FipeRepository {
  const base = (opts.baseUrl ?? 'https://fipe.parallelum.com.br/api/v2').replace(/\/$/, '');
  const f = opts.fetchImpl ?? fetch;
  const historyMonths = opts.historyMonths ?? 6;
  const cache = new Map<string, Promise<unknown>>();

  async function load<T>(path: string, allow404 = false): Promise<T | null> {
    for (let attempt = 0; ; attempt++) {
      const res = await f(base + path, { headers: { accept: 'application/json' } });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404 && allow404) return null;
      if (res.status === 429 && attempt < 2) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
      throw new Error(res.status === 429 ? 'Muitas consultas seguidas. Tente de novo em alguns minutos.' : `Não foi possível carregar (${res.status})`);
    }
  }
  // remembers answers for the session; a failed call is forgotten so it can be retried
  function get<T>(path: string, allow404 = false): Promise<T | null> {
    let p = cache.get(path) as Promise<T | null> | undefined;
    if (!p) {
      p = load<T>(path, allow404);
      cache.set(path, p);
      p.catch(() => cache.delete(path));
    }
    return p;
  }

  return {
    async listBrands(type) {
      return (await get<CodeName[]>(`/${type}/brands`))!.map(b => ({ id: `${type}:${b.code}`, vehicleType: type, name: b.name })).sort(byName);
    },
    async listModels(brandId) {
      const p = parseLiveId(brandId);
      if (!p) return [];
      return (await get<CodeName[]>(`/${p.type}/brands/${p.brand}/models`))!.map(m => ({ id: `${brandId}:${m.code}`, brandId, name: m.name })).sort(byName);
    },
    async listYears(modelId) {
      const p = parseLiveId(modelId);
      if (!p?.model) return [];
      const ys = (await get<CodeName[]>(`/${p.type}/brands/${p.brand}/models/${p.model}/years`))!;
      return ys.map(y => ({ id: `${modelId}:${y.code}`, modelId, fipeCode: '', ...parseYear(y) }))
        .sort((a, b) => b.modelYear - a.modelYear);
    },
    async getVehicle(modelYearId) {
      const p = parseLiveId(modelYearId);
      if (!p?.model || !p.year) return null;
      const path = `/${p.type}/brands/${p.brand}/models/${p.model}/years/${p.year}`;
      // newest months first; without them, at least the current price
      const refs = await get<Reference[]>('/references').catch(() => null);
      const recent = (refs ?? []).slice().sort((a, b) => Number(b.code) - Number(a.code)).slice(0, historyMonths);
      const answers: (Vehicle | null)[] = [];
      if (recent.length === 0) answers.push(await get<Vehicle>(path, true));
      // a few at a time, to stay under the API's per-minute limit
      for (let i = 0; i < recent.length; i += 3) {
        const batch = recent.slice(i, i + 3).map((r, j) => get<Vehicle>(`${path}?reference=${r.code}`, true)
          .catch(e => { if (i + j === 0) throw e; return null; }));   // the latest month must load; older ones may fail
        answers.push(...await Promise.all(batch));
      }
      const valid = answers.filter((v): v is Vehicle => !!v);
      const v = valid[0];
      if (!v) return null;
      const points: PricePoint[] = [];
      for (const a of valid) {
        try {
          const { year, month } = parseReferenceMonth(a.referenceMonth);
          const referenceMonth = `${year}-${String(month).padStart(2, '0')}`;
          if (!points.some(x => x.referenceMonth === referenceMonth)) {
            points.push({ modelYearId, referenceMonth, priceCents: parsePriceToCents(a.price), currency: 'BRL' });
          }
        } catch { /* skip a month the API answered in an unexpected format */ }
      }
      const brand: Brand = { id: `${p.type}:${p.brand}`, vehicleType: p.type, name: v.brand };
      const model: Model = { id: `${brand.id}:${p.model}`, brandId: brand.id, name: v.model };
      const year: ModelYear = { id: modelYearId, modelId: model.id, modelYear: v.modelYear, fuel: v.fuel, fipeCode: v.codeFipe };
      return buildVehicleResult(brand, model, year, points);
    },
  };
}
