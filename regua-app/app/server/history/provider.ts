// Vehicle history provider (auction, theft, total loss, financing lien, restrictions, recall).
// Providers differ in URL, auth and field names: URL and auth come from env vars and the answer is read leniently.
// Before launch, confirm the field names against your provider's docs and add a test with a real (test) response.

export type CheckKey = 'leilao' | 'roubo_furto' | 'sinistro' | 'gravame' | 'restricoes' | 'recall';
export type CheckStatus = 'ok' | 'alert' | 'unknown';
export interface HistoryCheck { key: CheckKey; status: CheckStatus; detail?: string }
export interface HistoryReport {
  vehicle: { brand: string; model: string; year: number | null; color?: string };
  checks: HistoryCheck[];
}

export const CHECK_LABEL: Record<CheckKey, string> = {
  leilao: 'Passagem por leilão',
  roubo_furto: 'Roubo ou furto',
  sinistro: 'Sinistro / perda total',
  gravame: 'Financiamento (gravame)',
  restricoes: 'Restrições (judiciais e administrativas)',
  recall: 'Recall pendente',
};
const ORDER: CheckKey[] = ['leilao', 'roubo_furto', 'sinistro', 'gravame', 'restricoes', 'recall'];

// words that identify each check in the provider's keys (accents and separators removed)
const MATCH: Record<CheckKey, string[]> = {
  leilao: ['leilao', 'leiloes', 'auction'],
  roubo_furto: ['roubo', 'furto', 'theft', 'stolen'],
  sinistro: ['sinistro', 'perdatotal', 'indenizacao', 'indenizacoes', 'indenizado'],
  gravame: ['gravame', 'financiamento', 'alienacao'],
  restricoes: ['restricao', 'restricoes', 'renajud', 'bloqueio', 'judicial', 'impedimento'],
  recall: ['recall'],
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const NEGATIVE = new Set(['nao', 'n', 'no', 'false', 'naoconsta', 'nadaconsta', 'semregistro', 'semregistros', 'naopossui', 'negativo', 'inexistente', 'nenhum', 'nenhuma', 'ok', 'limpo', '0']);
const POSITIVE = new Set(['sim', 's', 'yes', 'true', 'consta', 'possui', 'positivo', 'existe', 'ativo', 'ativa', '1']);

/** true = something on record, false = nothing on record, null = cannot tell. */
function truthiness(v: unknown, depth = 0): boolean | null {
  if (v == null || depth > 4) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v > 0;
  if (typeof v === 'string') {
    const n = norm(v);
    if (!n) return null;
    if (NEGATIVE.has(n) || n.startsWith('nadaconsta') || n.startsWith('naoconsta') || n.startsWith('semregistro')) return false;
    if (POSITIVE.has(n) || n.startsWith('consta') || n.startsWith('possui')) return true;
    return null;
  }
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      const nk = norm(k);
      if (['possui', 'existe', 'consta', 'status', 'situacao', 'resultado', 'ocorrencia', 'ocorrencias', 'registros', 'registro', 'possuiregistro', 'temregistro'].includes(nk)) {
        const t = truthiness(o[k], depth + 1);
        if (t !== null) return t;
      }
    }
    return null;
  }
  return null;
}

function detailOf(v: unknown): string | undefined {
  if (typeof v === 'string') { const t = v.trim(); return t.length > 2 && t.length <= 160 && !POSITIVE.has(norm(t)) && !NEGATIVE.has(norm(t)) ? t : undefined; }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (['descricao', 'detalhe', 'detalhes', 'observacao', 'mensagem', 'agente', 'agentefinanceiro', 'motivo'].includes(norm(k)) && typeof x === 'string' && x.trim()) return x.trim().slice(0, 160);
    }
  }
  return undefined;
}

/** Walks the payload and fills each check from the first matching key. Personal data fields are never copied. */
export function parseHistoryResponse(json: unknown): HistoryReport | null {
  if (!json || typeof json !== 'object') return null;
  const found = new Map<CheckKey, HistoryCheck>();
  let brand = '', model = '', color = '', year: number | null = null;
  const visit = (v: unknown, depth: number) => {
    if (!v || typeof v !== 'object' || depth > 6) return;
    if (Array.isArray(v)) { for (const x of v) visit(x, depth + 1); return; }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const nk = norm(k);
      if (!brand && ['marca', 'brand', 'fabricante'].includes(nk) && typeof x === 'string') brand = x.trim();
      else if (!model && ['modelo', 'model', 'marcamodelo'].includes(nk) && typeof x === 'string') model = x.trim();
      else if (!color && ['cor', 'color'].includes(nk) && typeof x === 'string') color = x.trim();
      else if (year === null && ['anomodelo', 'ano', 'modelyear'].includes(nk) && /^\d{4}/.test(String(x))) year = Number(String(x).slice(0, 4));
      for (const key of ORDER) {
        if (found.has(key) || !MATCH[key].some(w => nk.includes(w))) continue;
        const t = truthiness(x);
        if (t !== null) found.set(key, { key, status: t ? 'alert' : 'ok', ...(t && detailOf(x) ? { detail: detailOf(x) } : {}) });
      }
      if (typeof x === 'object') visit(x, depth + 1);
    }
  };
  visit(json, 0);
  if (!found.size && !brand && !model) return null;
  return {
    vehicle: { brand, model, year, ...(color ? { color } : {}) },
    checks: ORDER.map(k => found.get(k) ?? { key: k, status: 'unknown' as const }),
  };
}

export interface HistoryProvider { lookup(plate: string): Promise<HistoryReport | null> }
export class HistoryProviderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function createHistoryProvider(opts: { urlTemplate: string; token: string; auth?: string; fetchImpl?: typeof fetch; timeoutMs?: number }): HistoryProvider {
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
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25_000);
      let res: Response;
      try { res = await f(url, { headers, signal: ctrl.signal }); }
      catch (e) { throw new HistoryProviderError(`provider unreachable: ${(e as Error).message}`, 0); }
      finally { clearTimeout(timer); }
      if (res.status === 404) return null;
      if (!res.ok) throw new HistoryProviderError(`provider answered ${res.status}`, res.status);
      let body: unknown;
      try { body = await res.json(); } catch { throw new HistoryProviderError('invalid JSON', res.status); }
      return parseHistoryResponse(body);
    },
  };
}
