// Plate lookup: validate, apply the daily limits, use the cache, call the provider, match the FIPE codes to our catalog.
// Runs in the plate-lookup Edge Function (Deno) and in the Node tests; storage and provider are injected.
import { normalizePlate } from '../../src/logic/plate.ts';
import { PlateProviderError, type PlateProvider, type PlateVehicle } from './provider.ts';

export interface CatalogMatch { modelYearId: string; brand: string; model: string; modelYear: number; fuel: string; fipeCode: string }
export type QuotaResult = 'ok' | 'device_limit' | 'global_limit';

export interface PlateStore {
  getCached(plateHash: string): Promise<PlateVehicle | null>;
  putCached(plateHash: string, v: PlateVehicle): Promise<void>;
  /** counts one lookup for the device today, unless it is over its limit or the day's global budget is spent */
  takeQuota(installId: string, deviceLimit: number, globalLimit: number): Promise<QuotaResult>;
  matchFipeCodes(codes: string[]): Promise<CatalogMatch[]>;
}

export interface LookupDeps {
  store: PlateStore;
  provider: PlateProvider | null;            // null when no provider is configured
  isPlus(rcUserId: string | undefined): Promise<boolean>;
  pepper: string;                            // secret used to hash plates; plates are never stored in clear
  limits: { free: number; plus: number; globalDaily: number };
}

export type LookupResult =
  | { status: 'ok'; vehicle: { brand: string; model: string; year: number | null; fipeCodes: string[] }; matches: CatalogMatch[]; cached: boolean }
  | { status: 'invalid_plate' }
  | { status: 'invalid_request' }
  | { status: 'not_found' }
  | { status: 'limit'; plus: boolean; limit: number }
  | { status: 'unavailable' };

export const HTTP_STATUS: Record<LookupResult['status'], number> = {
  ok: 200, invalid_plate: 400, invalid_request: 400, not_found: 404, limit: 429, unavailable: 503,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enc = new TextEncoder();

export async function hashPlate(plate: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(plate)));
  return Array.from(mac, b => b.toString(16).padStart(2, '0')).join('');
}

/** Best rows first: same model year as the plate, then zero km when the plate's year is the current one or newer. */
export function rankMatches(matches: CatalogMatch[], year: number | null, currentYear = new Date().getFullYear()): CatalogMatch[] {
  const score = (m: CatalogMatch) => (year != null && m.modelYear === year ? 0 : year != null && year >= currentYear && m.modelYear === 32000 ? 1 : 2);
  const exact = matches.filter(m => score(m) < 2);
  const list = exact.length ? exact : matches;
  return [...list].sort((a, b) => score(a) - score(b) || b.modelYear - a.modelYear || a.model.localeCompare(b.model, 'pt-BR'));
}

export async function lookupPlate(deps: LookupDeps, body: unknown): Promise<LookupResult> {
  const req = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const installId = typeof req.installId === 'string' && UUID.test(req.installId) ? req.installId : null;
  if (!installId || typeof req.plate !== 'string') return { status: 'invalid_request' };
  const plate = normalizePlate(req.plate);
  if (!plate) return { status: 'invalid_plate' };
  if (!deps.provider) return { status: 'unavailable' };

  const rcUserId = typeof req.rcUserId === 'string' && req.rcUserId.length <= 100 ? req.rcUserId : undefined;
  const plus = await deps.isPlus(rcUserId).catch(() => false);
  const deviceLimit = plus ? deps.limits.plus : deps.limits.free;

  // every lookup counts, cached or not, so the limit is predictable for the user
  const quota = await deps.store.takeQuota(installId, deviceLimit, deps.limits.globalDaily);
  if (quota === 'device_limit') return { status: 'limit', plus, limit: deviceLimit };

  const key = await hashPlate(plate, deps.pepper);
  let vehicle = await deps.store.getCached(key);
  const cached = Boolean(vehicle);
  if (!vehicle) {
    if (quota === 'global_limit') return { status: 'unavailable' };   // budget spent: only cached plates today
    try {
      vehicle = await deps.provider.lookup(plate);
    } catch (e) {
      if (e instanceof PlateProviderError) return { status: 'unavailable' };
      throw e;
    }
    if (!vehicle) return { status: 'not_found' };
    await deps.store.putCached(key, vehicle);
  }
  const matches = vehicle.fipeCodes.length ? rankMatches(await deps.store.matchFipeCodes(vehicle.fipeCodes), vehicle.year) : [];
  // the FIPE codes go back too: when our catalog lacks them, the app prices the plate with the FIPE API directly
  return { status: 'ok', vehicle: { brand: vehicle.brand, model: vehicle.model, year: vehicle.year, fipeCodes: vehicle.fipeCodes }, matches, cached };
}

/** Plus check on the server, with RevenueCat's REST API and the secret key (never the app's word for it). */
export function createRevenueCatCheck(opts: { secretKey?: string; entitlement?: string; fetchImpl?: typeof fetch; now?: () => number }) {
  const f = opts.fetchImpl ?? fetch;
  const ent = opts.entitlement ?? 'plus';
  return async (rcUserId: string | undefined): Promise<boolean> => {
    if (!opts.secretKey || !rcUserId) return false;
    const res = await f(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcUserId)}`, {
      headers: { authorization: `Bearer ${opts.secretKey}`, accept: 'application/json' },
    });
    if (!res.ok) return false;
    const body = await res.json() as { subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> } };
    const e = body.subscriber?.entitlements?.[ent];
    if (!e) return false;
    return e.expires_date == null || Date.parse(e.expires_date) > (opts.now?.() ?? Date.now());
  };
}
