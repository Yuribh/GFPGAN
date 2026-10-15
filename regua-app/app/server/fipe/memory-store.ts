// In-memory CatalogStore with the same unique keys as the SQL schema. Used by tests.
import type { CatalogStore } from './ingest.ts';

export function createMemoryStore() {
  let n = 0;
  const id = () => `id-${++n}`;
  const months = new Map<number, { id: string; year: number; month: number }>();
  const brands = new Map<string, { id: string; name: string }>();
  const models = new Map<string, { id: string; name: string }>();
  const years = new Map<string, { id: string; fipeCode: string; modelYear: number; fuel: string }>();
  const prices = new Map<string, number>();
  const checkpoints = new Map<string, Set<string>>();
  const runs: { id: string; status: string; rowsWritten: number; error?: string }[] = [];

  const store: CatalogStore = {
    async upsertReferenceMonth(r) {
      const cur = months.get(r.sourceCode) ?? { id: id(), ...r };
      months.set(r.sourceCode, { ...cur, year: r.year, month: r.month });
      return cur.id;
    },
    async upsertBrand(b) {
      const k = `${b.vehicleType}|${b.sourceCode}`;
      const cur = brands.get(k) ?? { id: id(), name: b.name };
      brands.set(k, { ...cur, name: b.name });
      return cur.id;
    },
    async upsertModel(m) {
      const k = `${m.brandId}|${m.sourceCode}`;
      const cur = models.get(k) ?? { id: id(), name: m.name };
      models.set(k, { ...cur, name: m.name });
      return cur.id;
    },
    async upsertModelYear(y) {
      const k = `${y.modelId}|${y.sourceCode}`;
      const cur = years.get(k) ?? { id: id(), fipeCode: y.fipeCode, modelYear: y.modelYear, fuel: y.fuel };
      years.set(k, { ...cur, fipeCode: y.fipeCode, modelYear: y.modelYear, fuel: y.fuel });
      return cur.id;
    },
    async upsertPricePoint(p) { prices.set(`${p.modelYearId}|${p.referenceMonthId}`, p.priceCents); },
    async getCheckpoint(ref) { return new Set(checkpoints.get(ref) ?? []); },
    async addCheckpoint(ref, key) { (checkpoints.get(ref) ?? checkpoints.set(ref, new Set()).get(ref)!).add(key); },
    async startRun() { const r = { id: id(), status: 'running', rowsWritten: 0 }; runs.push(r); return r.id; },
    async finishRun(runId, r) { Object.assign(runs.find(x => x.id === runId)!, r); },
  };
  return { store, months, brands, models, years, prices, runs };
}
