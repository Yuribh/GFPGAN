// Side-by-side comparison of up to 3 vehicles. Pure: the screen only renders what this returns.
import type { VehicleResult } from '../data/types.ts';

export const MAX_COMPARE = 3;

/** Adds an id to the comparison list: no duplicates, newest last, oldest dropped past the limit. */
export function addToCompare(list: string[], id: string, max = MAX_COMPARE): string[] {
  const rest = list.filter(x => x !== id);
  return [...rest, id].slice(-max);
}

export interface CompareRow {
  id: string;
  label: string;
  priceCents: number;
  /** vs the previous month */
  monthPercent: number | null;
  /** vs the oldest month within the last 12 */
  yearPercent: number | null;
  /** how much more than the cheapest in the list (0 for the cheapest) */
  overCheapestCents: number;
  cheapest: boolean;
}

const pct = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : null);

export function compareRows(vehicles: VehicleResult[]): CompareRow[] {
  if (!vehicles.length) return [];
  const min = Math.min(...vehicles.map(v => v.latest.priceCents));
  return vehicles.map(v => {
    const last12 = v.history.slice(-12);
    return {
      id: v.year.id,
      label: `${v.brand.name} ${v.model.name}`,
      priceCents: v.latest.priceCents,
      monthPercent: v.change ? v.change.percent : null,
      yearPercent: last12.length > 1 ? pct(last12[0].priceCents, v.latest.priceCents) : null,
      overCheapestCents: v.latest.priceCents - min,
      cheapest: vehicles.length > 1 && v.latest.priceCents === min,
    };
  });
}
