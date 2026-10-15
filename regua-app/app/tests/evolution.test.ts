import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeSince, monthsBefore, pointsSince } from '../src/logic/evolution.ts';
import type { PricePoint } from '../src/data/types.ts';

const p = (referenceMonth: string, reais: number): PricePoint => ({ modelYearId: 'y', referenceMonth, priceCents: reais * 100, currency: 'BRL' });

test('months before, across years', () => {
  assert.equal(monthsBefore('2026-10', 6), '2026-04');
  assert.equal(monthsBefore('2026-10', 12), '2025-10');
  assert.equal(monthsBefore('2026-03', 6), '2025-09');
  assert.equal(monthsBefore('2026-01', 1), '2025-12');
});

test('6 and 12 month windows and changes', () => {
  const months = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const pts = months.map((m, i) => p(m, 200_000 - i * 1_000));
  assert.equal(pointsSince(pts, 6).length, 7);            // April to October
  assert.equal(pointsSince(pts, 6)[0].referenceMonth, '2026-04');
  assert.equal(pointsSince(pts, 12).length, 13);
  const six = changeSince(pts, 6)!;
  assert.equal(six.from.referenceMonth, '2026-04');
  assert.equal(six.cents, -600_000);
  assert.equal(Math.round(six.percent * 100) / 100, -3.09);
  assert.equal(changeSince(pts, 12)!.cents, -1_200_000);
});

test('a missing month never stretches the window; a missing start gives no change', () => {
  const pts = [p('2025-09', 100), p('2026-05', 110), p('2026-10', 120)];   // gap, and no April
  assert.deepEqual(pointsSince(pts, 6).map(x => x.referenceMonth), ['2026-05', '2026-10']);
  assert.equal(changeSince(pts, 6), null);
  assert.equal(changeSince([], 6), null);
});
