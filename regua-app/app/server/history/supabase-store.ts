// HistoryStore on Supabase (service role, server only).
import type { HistoryStore } from './report.ts';
import type { HistoryReport } from './provider.ts';

export function createSupabaseHistoryStore(opts: { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch }): HistoryStore {
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
      const since = encodeURIComponent(new Date(Date.now() - 7 * 864e5).toISOString());
      const rows = await call<{ report: HistoryReport }[]>(`/rest/v1/history_cache?plate_hash=eq.${h}&fetched_at=gte.${since}&select=report`);
      return rows[0]?.report ?? null;
    },
    async putCached(h, r) {
      await call('/rest/v1/history_cache', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ plate_hash: h, report: r, fetched_at: new Date().toISOString() }) });
    },
    claim: (t, h) => call<'new' | 'same' | 'other'>('/rest/v1/rpc/claim_history_purchase', { method: 'POST', body: JSON.stringify({ p_transaction_id: t, p_plate_hash: h }) }),
    async release(t) { await call(`/rest/v1/history_purchases?transaction_id=eq.${encodeURIComponent(t)}`, { method: 'DELETE' }); },
  };
}
