// In-memory PlateStore for tests and local runs.
import type { CatalogMatch, PlateStore, QuotaResult } from './lookup.ts';
import type { PlateVehicle } from './provider.ts';

export function createMemoryPlateStore(catalog: CatalogMatch[] = []) {
  const cache = new Map<string, PlateVehicle>();
  const perDevice = new Map<string, number>();
  let global = 0;
  const store: PlateStore = {
    async getCached(h) { return cache.get(h) ?? null; },
    async putCached(h, v) { cache.set(h, v); },
    async takeQuota(id, deviceLimit, globalLimit): Promise<QuotaResult> {
      const n = perDevice.get(id) ?? 0;
      if (n >= deviceLimit) return 'device_limit';
      perDevice.set(id, n + 1);
      if (global >= globalLimit) return 'global_limit';
      global++;
      return 'ok';
    },
    async matchFipeCodes(codes) { return catalog.filter(m => codes.includes(m.fipeCode)); },
  };
  return { store, cache, perDevice, resetDay() { perDevice.clear(); global = 0; } };
}
