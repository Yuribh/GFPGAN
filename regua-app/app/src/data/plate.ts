// Client for the plate-lookup Edge Function. With no Supabase keys (sample data) it answers from a fake,
// so the screen can be tried without a provider.
export interface CatalogMatchDto { modelYearId: string; brand: string; model: string; modelYear: number; fuel: string; fipeCode: string }

export type PlateAnswer =
  | { status: 'ok'; vehicle: { brand: string; model: string; year: number | null }; matches: CatalogMatchDto[] }
  | { status: 'invalid_plate' | 'not_found' | 'unavailable' | 'offline' }
  | { status: 'limit'; plus: boolean; limit: number };

export interface PlateClientOptions { url?: string; anonKey?: string; fetchImpl?: typeof fetch }

export function createPlateClient(opts: PlateClientOptions) {
  const f = opts.fetchImpl ?? fetch;
  const endpoint = opts.url && opts.anonKey ? opts.url.replace(/\/$/, '') + '/functions/v1/plate-lookup' : null;
  return {
    sample: !endpoint,
    async lookup(plate: string, installId: string, rcUserId?: string): Promise<PlateAnswer> {
      if (!endpoint) return sampleAnswer(plate);
      let res: Response;
      try {
        res = await f(endpoint, {
          method: 'POST',
          headers: { apikey: opts.anonKey!, authorization: `Bearer ${opts.anonKey}`, 'content-type': 'application/json' },
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
          vehicle: body.vehicle as { brand: string; model: string; year: number | null },
          matches: (body.matches as CatalogMatchDto[]) ?? [],
        };
        case 'limit': return { status: 'limit', plus: Boolean(body.plus), limit: Number(body.limit) || 0 };
        case 'invalid_plate': case 'not_found': return { status: body.status };
        default: return { status: 'unavailable' };
      }
    },
  };
}

// Sample mode: every valid plate is the sample "Modelo B 2.0 Automático" (ids from src/data/fake.ts).
async function sampleAnswer(plate: string): Promise<PlateAnswer> {
  await new Promise(r => setTimeout(r, 400));
  if (plate.endsWith('000')) return { status: 'not_found' };
  return {
    status: 'ok',
    vehicle: { brand: 'Marca Exemplo Alfa', model: 'Modelo B 2.0 Automático', year: 2021 },
    matches: [{ modelYearId: 'y-3', brand: 'Marca Exemplo Alfa', model: 'Modelo B 2.0 Automático', modelYear: 2021, fuel: 'Gasolina', fipeCode: '900002-9' }],
  };
}
