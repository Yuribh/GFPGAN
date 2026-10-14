import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepository } from '../src/data/fake.ts';
import { formatBRL, formatMonth, formatModelYear, formatPercent } from '../src/format.ts';

const repo = createFakeRepository();

test('formatBRL formats cents with Brazilian separators', () => {
  assert.equal(formatBRL(4_567_890), 'R$ 45.678,90');
  assert.equal(formatBRL(5), 'R$ 0,05');
  assert.equal(formatBRL(100_000_000), 'R$ 1.000.000,00');
  assert.equal(formatBRL(-12_345), '-R$ 123,45');
});

test('formatMonth, model year and percent', () => {
  assert.equal(formatMonth('2026-10'), 'outubro de 2026');
  assert.throws(() => formatMonth('2026-13'));
  assert.throws(() => formatMonth('oct'));
  assert.equal(formatModelYear(32000), '0 km');
  assert.equal(formatModelYear(2020), '2020');
  assert.equal(formatPercent(3.24), '+3,2%');
  assert.equal(formatPercent(-1.05), '-1,1%');
  assert.equal(formatPercent(0.01), '0,0%');
});

test('brands are filtered by vehicle type and sorted', async () => {
  const cars = await repo.listBrands('cars');
  assert.deepEqual(cars.map(b => b.name), ['Marca Exemplo Alfa', 'Marca Exemplo Beta']);
  assert.equal((await repo.listBrands('trucks')).length, 1);
});

test('models and years drill down, newest year first, zero km on top', async () => {
  const models = await repo.listModels('b-car-1');
  assert.equal(models.length, 2);
  const years = await repo.listYears('m-2');
  assert.deepEqual(years.map(y => y.modelYear), [32000, 2021]);
  assert.deepEqual(await repo.listModels('nope'), []);
});

test('getVehicle returns latest price, change and history', async () => {
  const v = await repo.getVehicle('y-1');
  assert.ok(v);
  assert.equal(v.history.length, 12);
  assert.equal(v.latest.referenceMonth, '2026-10');
  assert.equal(v.latest.currency, 'BRL');
  assert.ok(v.change);
  const prev = v.history[v.history.length - 2].priceCents;
  assert.equal(v.change.cents, v.latest.priceCents - prev);
  assert.ok(Number.isInteger(v.latest.priceCents));
});

test('sparse vehicle has one month and no change', async () => {
  const v = await repo.getVehicle('y-8');
  assert.ok(v);
  assert.equal(v.history.length, 1);
  assert.equal(v.change, null);
});

test('unknown vehicle returns null instead of throwing', async () => {
  assert.equal(await repo.getVehicle('missing'), null);
});

test('errors from the data layer surface to the caller', async () => {
  const failing = createFakeRepository({ failWith: new Error('timeout') });
  await assert.rejects(() => failing.listBrands('cars'), /timeout/);
});
