import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepository } from '../src/data/fake.ts';
import { addToCompare, compareRows } from '../src/logic/compare.ts';
import { buildReportHtml } from '../src/logic/report.ts';
import { formatKm, maskBRLInput, parseBRLInput, versusFipe } from '../src/logic/saleCard.ts';

const repo = createFakeRepository();

test('addToCompare keeps at most 3, no duplicates, newest last', () => {
  assert.deepEqual(addToCompare([], 'a'), ['a']);
  assert.deepEqual(addToCompare(['a', 'b'], 'a'), ['b', 'a']);
  assert.deepEqual(addToCompare(['a', 'b', 'c'], 'd'), ['b', 'c', 'd']);
});

test('compareRows marks the cheapest and the difference to it', async () => {
  const vs = (await Promise.all(['y-1', 'y-3', 'y-8'].map(id => repo.getVehicle(id)))).filter(v => v !== null);
  const rows = compareRows(vs);
  const cheapest = rows.filter(r => r.cheapest);
  assert.equal(cheapest.length, 1);
  assert.equal(cheapest[0].overCheapestCents, 0);
  for (const r of rows) assert.ok(r.overCheapestCents >= 0);
  assert.equal(rows.find(r => r.id === 'y-8')!.yearPercent, null, 'one month of data has no yearly change');
  assert.equal(typeof rows.find(r => r.id === 'y-1')!.yearPercent, 'number');
  assert.equal(compareRows([vs[0]])[0].cheapest, false, 'a single vehicle is not "the cheapest"');
  assert.deepEqual(compareRows([]), []);
});

test('parseBRLInput reads Brazilian prices and rejects junk', () => {
  assert.equal(parseBRLInput('45.900'), 4_590_000);
  assert.equal(parseBRLInput('R$ 45.900,50'), 4_590_050);
  assert.equal(parseBRLInput('45900,5'), 4_590_050);
  assert.equal(parseBRLInput('1.234.567'), 123_456_700);
  for (const bad of ['', 'abc', '45.90', '45,900.00', '0', '1,234']) assert.equal(parseBRLInput(bad), null, bad);
});

test('masks and labels for the sale card', () => {
  assert.equal(maskBRLInput('045900abc'), '45.900');
  assert.equal(maskBRLInput('1234567'), '1.234.567');
  assert.equal(formatKm('45000'), '45.000 km');
  assert.equal(formatKm(''), '');
  assert.equal(versusFipe(9_500_000, 10_000_000), '5,0% abaixo da FIPE');
  assert.equal(versusFipe(10_100_000, 10_000_000), '1,0% acima da FIPE');
  assert.equal(versusFipe(10_000_000, 10_000_000), 'no preço da FIPE');
});

test('report HTML has the price, the monthly table and escapes names', async () => {
  const v = (await repo.getVehicle('y-1'))!;
  const evil = { ...v, model: { ...v.model, name: 'Modelo <script>alert(1)</script>' } };
  const html = buildReportHtml(evil, new Date('2026-10-14T12:00:00Z'), { sample: true });
  assert.ok(html.includes('Modelo &lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('R$ '));
  assert.equal((html.match(/<tr><td>/g) ?? []).length, Math.min(12, v.history.length));
  assert.ok(html.includes('Dados de exemplo'));
  assert.ok(html.includes('<svg'));
  const one = buildReportHtml((await repo.getVehicle('y-8'))!, new Date());
  assert.ok(!one.includes('<svg'), 'no chart with one month');
});
