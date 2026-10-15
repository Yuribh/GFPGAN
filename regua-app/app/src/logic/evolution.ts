// Price evolution windows: "6 meses" goes from the table of 6 months ago to the latest one (7 tables), by calendar
// month, so a missing month never stretches the window.
import type { PricePoint } from '../data/types.ts';

/** "2026-10" minus 6 -> "2026-04" */
export function monthsBefore(ref: string, n: number): string {
  const [y, m] = ref.split('-').map(Number);
  const t = y * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** points (sorted oldest first) from `months` months before the latest one up to it */
export function pointsSince(points: PricePoint[], months: number): PricePoint[] {
  if (points.length === 0) return [];
  const from = monthsBefore(points[points.length - 1].referenceMonth, months);
  return points.filter(p => p.referenceMonth >= from);
}

/** change from exactly `months` months ago to the latest table; null when that month is not in the data */
export function changeSince(points: PricePoint[], months: number): { from: PricePoint; cents: number; percent: number } | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const from = points.find(p => p.referenceMonth === monthsBefore(last.referenceMonth, months));
  if (!from || from.priceCents <= 0) return null;
  const cents = last.priceCents - from.priceCents;
  return { from, cents, percent: (cents / from.priceCents) * 100 };
}

/** whole months from `a` to `b` ("2026-04" to "2026-10" -> 6) */
export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
}
