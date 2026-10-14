import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPlate, maskPlateInput, normalizePlate } from '../src/logic/plate.ts';

test('normalizePlate accepts old and Mercosul plates in any case and with separators', () => {
  assert.equal(normalizePlate('abc1234'), 'ABC1234');
  assert.equal(normalizePlate(' ABC-1234 '), 'ABC1234');
  assert.equal(normalizePlate('abc1d23'), 'ABC1D23');
  assert.equal(normalizePlate('ABC 1D23'), 'ABC1D23');
});

test('normalizePlate rejects anything that is not a plate', () => {
  for (const bad of ['', 'ABC123', 'ABC12345', '1BC1234', 'ABCD234', 'ABC1DD3', 'ÁBC1234', 'abc1d2x']) {
    assert.equal(normalizePlate(bad), null, bad);
  }
});

test('formatPlate shows the dash only on old plates', () => {
  assert.equal(formatPlate('ABC1234'), 'ABC-1234');
  assert.equal(formatPlate('ABC1D23'), 'ABC1D23');
});

test('maskPlateInput keeps 7 uppercase letters/digits', () => {
  assert.equal(maskPlateInput('abc-1d2345'), 'ABC1D23');
  assert.equal(maskPlateInput('a b.c'), 'ABC');
});
