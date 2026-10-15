import type { HistoryStore } from './report.ts';
import type { HistoryReport } from './provider.ts';

export function createMemoryHistoryStore() {
  const cache = new Map<string, HistoryReport>();
  const used = new Map<string, string>();
  const store: HistoryStore = {
    async getCached(h) { return cache.get(h) ?? null; },
    async putCached(h, r) { cache.set(h, r); },
    async claim(t, h) { const u = used.get(t); if (!u) { used.set(t, h); return 'new'; } return u === h ? 'same' : 'other'; },
    async release(t) { used.delete(t); },
  };
  return { store, cache, used };
}
