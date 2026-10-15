// Adapter for the public FIPE API (fipe.parallelum.com.br/api/v2). Every call to the data source lives here,
// so the source can be swapped without touching the schema or the job.
export type VehicleType = 'cars' | 'motorcycles' | 'trucks';
export interface CodeName { code: string; name: string }
export interface Reference { code: string; month: string }
export interface VehicleInfo {
  brand: string; codeFipe: string; fuel: string; model: string;
  modelYear: number; price: string; referenceMonth: string;
}
export interface FipeProvider {
  references(): Promise<Reference[]>;
  brands(type: VehicleType, ref: string): Promise<CodeName[]>;
  models(type: VehicleType, brand: string, ref: string): Promise<CodeName[]>;
  years(type: VehicleType, brand: string, model: string, ref: string): Promise<CodeName[]>;
  /** null when the source has no price for that year (404) */
  vehicle(type: VehicleType, brand: string, model: string, year: string, ref: string): Promise<VehicleInfo | null>;
  readonly requestsMade: number;
}

export interface ProviderOptions {
  baseUrl?: string;
  token?: string;                 // X-Subscription-Token, from the provider's site. Keep it in env vars.
  fetchImpl?: typeof fetch;
  maxRetries?: number;            // on 429 and 5xx
  sleep?: (ms: number) => Promise<void>;
}

export class ProviderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function createFipeProvider(opts: ProviderOptions = {}): FipeProvider {
  const base = (opts.baseUrl ?? 'https://fipe.parallelum.com.br/api/v2').replace(/\/$/, '');
  const doFetch = opts.fetchImpl ?? fetch;
  const maxRetries = opts.maxRetries ?? 4;
  const sleep = opts.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
  let requestsMade = 0;

  async function get<T>(path: string, allow404 = false): Promise<T | null> {
    for (let attempt = 0; ; attempt++) {
      requestsMade++;
      const res = await doFetch(base + path, {
        headers: { accept: 'application/json', ...(opts.token ? { 'X-Subscription-Token': opts.token } : {}) },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404 && allow404) return null;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) {
        throw new ProviderError(`FIPE API ${res.status} on ${path}`, res.status);
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
    }
  }
  const q = (ref: string) => `?reference=${encodeURIComponent(ref)}`;
  const seg = encodeURIComponent;

  return {
    get requestsMade() { return requestsMade; },
    references: async () => (await get<Reference[]>('/references'))!,
    brands: async (t, ref) => (await get<CodeName[]>(`/${t}/brands${q(ref)}`))!,
    models: async (t, b, ref) => (await get<CodeName[]>(`/${t}/brands/${seg(b)}/models${q(ref)}`))!,
    years: async (t, b, m, ref) => (await get<CodeName[]>(`/${t}/brands/${seg(b)}/models/${seg(m)}/years${q(ref)}`))!,
    vehicle: (t, b, m, y, ref) => get<VehicleInfo>(`/${t}/brands/${seg(b)}/models/${seg(m)}/years/${seg(y)}${q(ref)}`, true),
  };
}
