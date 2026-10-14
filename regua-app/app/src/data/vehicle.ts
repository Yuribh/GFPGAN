import type { Brand, Model, ModelYear, PricePoint, VehicleResult } from './types.ts';

/** Builds the result screen's data from a vehicle and its price history (any order). Shared by every repository. */
export function buildVehicleResult(brand: Brand, model: Model, year: ModelYear, points: PricePoint[]): VehicleResult | null {
  const history = [...points].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const change = prev && prev.priceCents > 0
    ? { cents: latest.priceCents - prev.priceCents, percent: ((latest.priceCents - prev.priceCents) / prev.priceCents) * 100 }
    : null;
  return { brand, model, year, latest, change, history };
}
