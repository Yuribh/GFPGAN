import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHistoryResponse, type HistoryReport, HistoryProviderError } from '../history/provider.ts';
import { createRevenueCatPurchaseCheck, getHistoryReport, type HistoryDeps } from '../history/report.ts';
import { createMemoryHistoryStore } from '../history/memory-store.ts';

const status = (r: HistoryReport | null, k: string) => r?.checks.find(c => c.key === k)?.status;

// ---------- parsing (invented shapes in the style of Brazilian vehicle-check APIs) ----------
test('reads yes/no strings, booleans and "nada consta"', () => {
  const r = parseHistoryResponse({ veiculo: { marca: 'MARCA', modelo: 'MODELO', ano_modelo: '2019', cor: 'PRATA' },
    leilao: 'NÃO', roubo_furto: { possui: false }, sinistro: 'Nada consta', gravame: { situacao: 'ATIVO', agente_financeiro: 'BANCO X' },
    restricoes: [], recall: true });
  assert.deepEqual(r?.vehicle, { brand: 'MARCA', model: 'MODELO', year: 2019, color: 'PRATA' });
  assert.equal(status(r, 'leilao'), 'ok');
  assert.equal(status(r, 'roubo_furto'), 'ok');
  assert.equal(status(r, 'sinistro'), 'ok');
  assert.equal(status(r, 'gravame'), 'alert');
  assert.equal(status(r, 'restricoes'), 'ok');
  assert.equal(status(r, 'recall'), 'alert');
});
test('lists of records mean an alert, and details are kept when short', () => {
  const r = parseHistoryResponse({ data: { leiloes: [{ data: '2021-03-01', leiloeiro: 'X' }], indicadorRouboFurto: 'SIM',
    restricao_judicial: { possuiRegistro: true, descricao: 'Bloqueio de transferência' } } });
  assert.equal(status(r, 'leilao'), 'alert');
  assert.equal(status(r, 'roubo_furto'), 'alert');
  assert.deepEqual(r?.checks.find(c => c.key === 'restricoes'), { key: 'restricoes', status: 'alert', detail: 'Bloqueio de transferência' });
});
test('missing or unreadable checks are "unknown", never "ok"', () => {
  const r = parseHistoryResponse({ marca: 'M', modelo: 'X', leilao: 'pendente de consulta' });
  assert.equal(status(r, 'leilao'), 'unknown');
  assert.equal(status(r, 'sinistro'), 'unknown');
  assert.equal(r?.checks.length, 6);
  assert.equal(parseHistoryResponse({ mensagem: 'erro' }), null);
});
test('owner data is never copied into the report', () => {
  const r = parseHistoryResponse({ marca: 'M', modelo: 'X', proprietario: { nome: 'Fulano de Tal', cpf: '000.000.000-00' }, leilao: false });
  assert.ok(!JSON.stringify(r).includes('Fulano') && !JSON.stringify(r).includes('000.000'));
});

// ---------- flow ----------
const REPORT: HistoryReport = { vehicle: { brand: 'M', model: 'X', year: 2020 }, checks: [{ key: 'leilao', status: 'ok' }] };
function setup(opts: { owns?: boolean; fail?: boolean; missing?: boolean } = {}) {
  const mem = createMemoryHistoryStore();
  let calls = 0;
  const deps: HistoryDeps = {
    store: mem.store,
    provider: { async lookup() { calls++; if (opts.fail) throw new HistoryProviderError('down', 502); return opts.missing ? null : REPORT; } },
    ownsTransaction: async () => opts.owns ?? true,
    pepper: 'p',
  };
  return { deps, mem, calls: () => calls };
}
const req = (plate = 'ABC1234', transactionId = 'GPA.1234') => ({ plate, transactionId, rcUserId: '$RCAnonymousID:abc' });

test('a paid purchase gets the report, and can re-download it for the same plate', async () => {
  const { deps, calls } = setup();
  assert.deepEqual(await getHistoryReport(deps, req()), { status: 'ok', report: REPORT, cached: false });
  assert.deepEqual(await getHistoryReport(deps, req('abc-1234')), { status: 'ok', report: REPORT, cached: true });
  assert.equal(calls(), 1);
});
test('a purchase cannot be reused for another plate', async () => {
  const { deps } = setup();
  await getHistoryReport(deps, req());
  assert.deepEqual(await getHistoryReport(deps, req('XYZ9A99')), { status: 'already_used' });
});
test('without a matching purchase there is no report and no provider call', async () => {
  const { deps, calls } = setup({ owns: false });
  assert.deepEqual(await getHistoryReport(deps, req()), { status: 'not_paid' });
  assert.equal(calls(), 0);
});
test('provider failure or unknown plate releases the purchase for a retry', async () => {
  const s = setup({ fail: true });
  assert.deepEqual(await getHistoryReport(s.deps, req()), { status: 'unavailable' });
  assert.equal(s.mem.used.size, 0);
  const m = setup({ missing: true });
  assert.deepEqual(await getHistoryReport(m.deps, req()), { status: 'not_found' });
  assert.equal(m.mem.used.size, 0);
  assert.equal((await getHistoryReport(m.deps, req('XYZ9A99'))).status, 'not_found', 'the same purchase still works for another plate');
});
test('bad input', async () => {
  const { deps } = setup();
  assert.equal((await getHistoryReport(deps, { plate: 'ABC1234' })).status, 'invalid_request');
  assert.equal((await getHistoryReport(deps, req('AB'))).status, 'invalid_plate');
  assert.equal((await getHistoryReport(deps, { ...req(), transactionId: 'x y' })).status, 'invalid_request');
  const off = setup().deps; off.provider = null;
  assert.equal((await getHistoryReport(off, req())).status, 'unavailable');
});
test('RevenueCat purchase check matches id or store transaction id for the product', async () => {
  const fetchImpl = (async () => Response.json({ subscriber: { non_subscriptions: {
    historico_veicular: [{ id: 'rc-1', store_transaction_id: 'GPA.1' }], outro: [{ id: 'rc-9' }] } } })) as unknown as typeof fetch;
  const check = createRevenueCatPurchaseCheck({ secretKey: 's', fetchImpl });
  assert.equal(await check('u', 'rc-1'), true);
  assert.equal(await check('u', 'GPA.1'), true);
  assert.equal(await check('u', 'rc-9'), false, 'another product does not count');
  assert.equal(await createRevenueCatPurchaseCheck({ fetchImpl })('u', 'rc-1'), false, 'no secret key, no report');
});
