// Client for the plate-lookup Edge Function. With no Supabase keys it answers from a fake, so the screen can be tried
// without a provider. When the server finds the plate but our catalog lacks its FIPE codes (table not imported yet,
// or no Supabase at all), `resolve` prices it with the FIPE API directly.
import { publicKeyHeaders } from './keys.ts';
export interface CatalogMatchDto { modelYearId: string; brand: string; model: string; modelYear: number; fuel: string; fipeCode: string }

export interface PlateVehicleDto { brand: string; model: string; year: number | null; fipeCodes?: string[] }
export type PlateAnswer =
  | { status: 'ok'; vehicle: PlateVehicleDto; matches: CatalogMatchDto[] }
  | { status: 'invalid_plate' | 'not_found' | 'unavailable' | 'offline' }
  | { status: 'limit'; plus: boolean; limit: number };

export interface PlateClientOptions {
  url?: string; anonKey?: string; fetchImpl?: typeof fetch;
  resolve?: (fipeCodes: string[], year: number | null) => Promise<CatalogMatchDto[]>;
  /** sample answers point at the invented catalog (fake.ts) instead of a real FIPE code */
  sampleCatalog?: boolean;
}

export function createPlateClient(opts: PlateClientOptions) {
  const f = opts.fetchImpl ?? fetch;
  const endpoint = opts.url && opts.anonKey ? opts.url.replace(/\/$/, '') + '/functions/v1/plate-lookup' : null;
  return {
    sample: !endpoint,
    async lookup(plate: string, installId: string, rcUserId?: string): Promise<PlateAnswer> {
      const a = endpoint ? await ask(plate, installId, rcUserId) : await sampleAnswer(plate, Boolean(opts.sampleCatalog));
      if (a.status !== 'ok' || a.matches.length || !a.vehicle.fipeCodes?.length || !opts.resolve) return a;
      try { return { ...a, matches: await opts.resolve(a.vehicle.fipeCodes, a.vehicle.year) }; }
      catch { return a; }   // FIPE API down: the screen offers the manual search
    },
  };

  async function ask(plate: string, installId: string, rcUserId?: string): Promise<PlateAnswer> {
    let res: Response;
    try {
      res = await f(endpoint!, {
        method: 'POST',
        headers: { ...publicKeyHeaders(opts.anonKey!), 'content-type': 'application/json' },
        body: JSON.stringify({ plate, installId, rcUserId }),
      });
    } catch {
      return { status: 'offline' };
    }
    let body: Record<string, unknown> = {};
    try { body = await res.json(); } catch { /* keep empty */ }
    switch (body.status) {
      case 'ok': return {
        status: 'ok',
        vehicle: body.vehicle as PlateVehicleDto,
        matches: (body.matches as CatalogMatchDto[]) ?? [],
      };
      case 'limit': return { status: 'limit', plus: Boolean(body.plus), limit: Number(body.limit) || 0 };
      case 'invalid_plate': case 'not_found': return { status: body.status };
      default: return { status: 'unavailable' };
    }
  }
}

// Sample mode: every valid plate is the same vehicle: a real Toyota Corolla Altis Híbrido 2025 (priced through the
// FIPE API), or with the invented catalog the sample "Modelo B 2.0 Automático" (ids from src/data/fake.ts).
async function sampleAnswer(plate: string, sampleCatalog: boolean): Promise<PlateAnswer> {
  await new Promise(r => setTimeout(r, 400));
  if (plate.endsWith('000')) return { status: 'not_found' };
  if (!sampleCatalog) return { status: 'ok', vehicle: { brand: 'TOYOTA', model: 'COROLLA ALTIS HYBRID', year: 2025, fipeCodes: ['002182-2'] }, matches: [] };
  return {
    status: 'ok',
    vehicle: { brand: 'Marca Exemplo Alfa', model: 'Modelo B 2.0 Automático', year: 2021 },
    matches: [{ modelYearId: 'y-3', brand: 'Marca Exemplo Alfa', model: 'Modelo B 2.0 Automático', modelYear: 2021, fuel: 'Gasolina', fipeCode: '900002-9' }],
  };
}
