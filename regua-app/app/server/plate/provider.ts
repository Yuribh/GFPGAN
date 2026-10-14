// Adapter for a paid plate-lookup provider (plate -> make, model, year, FIPE code). Every call to the provider lives here.
// Providers differ in URL, auth and field names, so the URL and auth come from env vars and the response is read
// leniently (see parsePlateResponse). Check the field names against your provider's docs and add a test with a real
// response before launch.

export interface PlateVehicle {
  brand: string;
  model: string;
  /** model year ("ano modelo"); null when the provider does not say */
  year: number | null;
  /** FIPE codes like "001234-5"; several when the plate matches more than one version */
  fipeCodes: string[];
}

export interface PlateProvider { lookup(plate: string): Promise<PlateVehicle | null> }

export interface PlateProviderOptions {
  /** e.g. "https://api.example.com/v1/placa/{plate}"; {plate} is replaced */
  urlTemplate: string;
  token: string;
  /** "bearer" (default), "header:<Name>" or "query:<param>" */
  auth?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class PlateProviderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

const FIPE_CODE = /^\d{6}-?\d$/;
const normFipe = (c: string) => { const d = c.replace(/\D/g, ''); return d.length === 7 ? `${d.slice(0, 6)}-${d.slice(6)}` : null; };
const asText = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of Object.keys(obj)) if (keys.includes(k.toLowerCase().replace(/[_\s-]/g, ''))) return obj[k];
  return undefined;
}

/** Collects FIPE codes anywhere in the payload: "codigo_fipe": "...", "fipe": [{ "codigo": ... }], etc. */
function collectFipeCodes(v: unknown, out: Set<string>, underFipeKey = false, depth = 0): void {
  if (depth > 6 || v == null) return;
  if (typeof v === 'string' || typeof v === 'number') {
    const s = String(v).trim();
    if (underFipeKey && FIPE_CODE.test(s)) { const c = normFipe(s); if (c) out.add(c); }
    return;
  }
  if (Array.isArray(v)) { for (const x of v) collectFipeCodes(x, out, underFipeKey, depth + 1); return; }
  if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const key = k.toLowerCase().replace(/[_\s-]/g, '');
      const isFipe = key.includes('fipe') || ((underFipeKey) && (key === 'codigo' || key === 'code' || key === 'cod'));
      collectFipeCodes(x, out, isFipe, depth + 1);
    }
  }
}

/** Reads the common shapes Brazilian plate APIs use. Returns null when the payload has no vehicle. */
export function parsePlateResponse(json: unknown): PlateVehicle | null {
  if (!json || typeof json !== 'object') return null;
  // many providers wrap the answer: { data: {...} }, { resultado: {...} }, { veiculo: {...} }
  let root = json as Record<string, unknown>;
  for (let i = 0; i < 3; i++) {
    const inner = pick(root, ['data', 'dados', 'resultado', 'result', 'veiculo', 'vehicle', 'response']);
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) root = inner as Record<string, unknown>; else break;
  }
  const brand = asText(pick(root, ['marca', 'brand', 'fabricante']));
  const model = asText(pick(root, ['modelo', 'model', 'versao', 'marcamodelo']));
  const yearRaw = asText(pick(root, ['anomodelo', 'modelyear', 'ano', 'year']));
  const year = /^\d{4}/.test(yearRaw) ? Number(yearRaw.slice(0, 4)) : null;
  const codes = new Set<string>();
  collectFipeCodes(json, codes);
  if (!brand && !model && codes.size === 0) return null;
  return { brand, model, year, fipeCodes: [...codes] };
}

export function createPlateProvider(opts: PlateProviderOptions): PlateProvider {
  const f = opts.fetchImpl ?? fetch;
  const auth = opts.auth ?? 'bearer';
  return {
    async lookup(plate) {
      let url = opts.urlTemplate.replace('{plate}', encodeURIComponent(plate));
      const headers: Record<string, string> = { accept: 'application/json' };
      if (auth === 'bearer') headers.authorization = `Bearer ${opts.token}`;
      else if (auth.startsWith('header:')) headers[auth.slice(7)] = opts.token;
      else if (auth.startsWith('query:')) url += `${url.includes('?') ? '&' : '?'}${encodeURIComponent(auth.slice(6))}=${encodeURIComponent(opts.token)}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
      let res: Response;
      try { res = await f(url, { headers, signal: ctrl.signal }); }
      catch (e) { throw new PlateProviderError(`provider unreachable: ${(e as Error).message}`, 0); }
      finally { clearTimeout(timer); }
      if (res.status === 404) return null;
      if (!res.ok) throw new PlateProviderError(`provider answered ${res.status}`, res.status);
      let body: unknown;
      try { body = await res.json(); } catch { throw new PlateProviderError('provider sent invalid JSON', res.status); }
      return parsePlateResponse(body);
    },
  };
}
