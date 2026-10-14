// Monthly ingestion job. Idempotent (every write is an upsert on a unique key) and resumable
// (a request budget stops the run cleanly; the next run continues from the checkpoint).
import type { FipeProvider, VehicleType } from './provider.ts';
import { parsePriceToCents, parseReferenceMonth, parseYearCode } from './parse.ts';

export interface CatalogStore {
  upsertReferenceMonth(r: { sourceCode: number; year: number; month: number }): Promise<string>;
  upsertBrand(b: { vehicleType: VehicleType; sourceCode: string; name: string }): Promise<string>;
  upsertModel(m: { brandId: string; sourceCode: string; name: string }): Promise<string>;
  upsertModelYear(y: { modelId: string; sourceCode: string; modelYear: number; fuel: string; fipeCode: string }): Promise<string>;
  upsertPricePoint(p: { modelYearId: string; referenceMonthId: string; priceCents: number }): Promise<void>;
  /** "done" keys already finished for this month, as type|brand|model */
  getCheckpoint(referenceCode: string): Promise<Set<string>>;
  addCheckpoint(referenceCode: string, key: string): Promise<void>;
  startRun(referenceCode: string): Promise<string>;
  finishRun(runId: string, r: { status: 'succeeded' | 'failed' | 'partial'; rowsWritten: number; error?: string }): Promise<void>;
}

export interface IngestOptions {
  types?: VehicleType[];
  /** stop before using more than this many requests (free API tier: 500 or 1,000 per day) */
  requestBudget?: number;
  /** which reference to load; defaults to the newest one */
  referenceCode?: string;
}

export interface IngestResult {
  referenceCode: string;
  status: 'succeeded' | 'partial' | 'failed';
  pricesWritten: number;
  skippedNoPrice: number;
  requestsUsed: number;
  error?: string;
}

class BudgetExhausted extends Error {}

export async function runIngestion(provider: FipeProvider, store: CatalogStore, opts: IngestOptions = {}): Promise<IngestResult> {
  const types = opts.types ?? ['cars', 'motorcycles', 'trucks'];
  const budget = opts.requestBudget ?? Infinity;
  const startRequests = provider.requestsMade;
  const used = () => provider.requestsMade - startRequests;
  const spend = (n = 1) => { if (used() + n > budget) throw new BudgetExhausted(); };

  spend();
  const refs = await provider.references();
  const ref = opts.referenceCode ? refs.find(r => r.code === opts.referenceCode) : refs[0];
  if (!ref) throw new Error('reference month not found at the source');
  const { year, month } = parseReferenceMonth(ref.month);
  const referenceMonthId = await store.upsertReferenceMonth({ sourceCode: Number(ref.code), year, month });
  const done = await store.getCheckpoint(ref.code);
  const runId = await store.startRun(ref.code);
  let pricesWritten = 0, skippedNoPrice = 0;

  try {
    for (const type of types) {
      spend();
      const brands = await provider.brands(type, ref.code);
      for (const b of brands) {
        const brandId = await store.upsertBrand({ vehicleType: type, sourceCode: b.code, name: b.name });
        let models: Awaited<ReturnType<FipeProvider['models']>> | null = null;
        const pending = () => models!.filter(m => !done.has(`${type}|${b.code}|${m.code}`));
        if (done.has(`${type}|${b.code}|*`)) continue;
        spend();
        models = await provider.models(type, b.code, ref.code);
        for (const m of pending()) {
          const modelId = await store.upsertModel({ brandId, sourceCode: m.code, name: m.name });
          spend();
          const years = await provider.years(type, b.code, m.code, ref.code);
          // reserve the whole model's requests up front, so a model is never half-written
          spend(years.length);
          for (const y of years) {
            const info = await provider.vehicle(type, b.code, m.code, y.code, ref.code);
            if (!info) { skippedNoPrice++; continue; }
            const { modelYear } = parseYearCode(y.code);
            const modelYearId = await store.upsertModelYear({
              modelId, sourceCode: y.code, modelYear, fuel: info.fuel, fipeCode: info.codeFipe,
            });
            await store.upsertPricePoint({ modelYearId, referenceMonthId, priceCents: parsePriceToCents(info.price) });
            pricesWritten++;
          }
          await store.addCheckpoint(ref.code, `${type}|${b.code}|${m.code}`);
          done.add(`${type}|${b.code}|${m.code}`);
        }
        await store.addCheckpoint(ref.code, `${type}|${b.code}|*`);
        done.add(`${type}|${b.code}|*`);
      }
    }
    await store.finishRun(runId, { status: 'succeeded', rowsWritten: pricesWritten });
    return { referenceCode: ref.code, status: 'succeeded', pricesWritten, skippedNoPrice, requestsUsed: used() };
  } catch (e) {
    const partial = e instanceof BudgetExhausted;
    const error = partial ? 'request budget reached, will resume on the next run' : String((e as Error).message ?? e);
    await store.finishRun(runId, { status: partial ? 'partial' : 'failed', rowsWritten: pricesWritten, error });
    return { referenceCode: ref.code, status: partial ? 'partial' : 'failed', pricesWritten, skippedNoPrice, requestsUsed: used(), error };
  }
}
