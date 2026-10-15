import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepository } from '../../src/data/fake.ts';
import { ADVISOR_HTTP, SYSTEM_PROMPT, askAdvisor, cleanHistory, vehicleFacts, type AdvisorDeps, type CallModel } from '../advisor/advisor.ts';
import { ADVISOR_MODEL, createClaudeCaller } from '../advisor/claude.ts';

const repo = createFakeRepository();
const ID = '11111111-1111-4111-8111-111111111111';

function setup(over: Partial<AdvisorDeps> & { reply?: string } = {}) {
  const calls: Parameters<CallModel>[0][] = [];
  let used = 0;
  const deps: AdvisorDeps = {
    callModel: async args => { calls.push(args); return { text: over.reply ?? 'Resposta.', refused: false, truncated: false }; },
    getVehicle: id => repo.getVehicle(id),
    isPlus: async () => false,
    takeQuota: async (_id, limit) => (used++ < limit ? 'ok' : 'device_limit'),
    limits: { free: 5, plus: 50, globalDaily: 1000 },
    now: () => new Date('2026-10-14T12:00:00Z'),
    ...over,
  };
  return { deps, calls };
}

test('the question goes with the catalog facts of the vehicle, after the stable system prompt', async () => {
  const { deps, calls } = setup();
  const r = await askAdvisor(deps, { installId: ID, question: 'Esse preço está bom?', modelYearId: 'y-1' });
  assert.deepEqual(r, { status: 'ok', answer: 'Resposta.' });
  assert.equal(calls[0].system, SYSTEM_PROMPT);
  const last = calls[0].messages.at(-1)!;
  assert.equal(last.role, 'user');
  assert.match(last.content, /Preço FIPE \(tabela de outubro de 2026\): R\$ /);
  assert.match(last.content, /Pergunta: Esse preço está bom\?$/);
  assert.match(last.content, /Data de hoje: 14\/10\/2026/);
  assert.ok(!SYSTEM_PROMPT.match(/\d{2}\/\d{2}\/\d{4}|R\$ \d/), 'no volatile data in the cached prefix');
});

test('prices from the client are ignored: only the catalog is used', async () => {
  const { deps, calls } = setup();
  await askAdvisor(deps, { installId: ID, question: 'Vale a pena?', modelYearId: 'y-1', priceCents: 1 });
  assert.ok(!calls[0].messages.at(-1)!.content.includes('R$ 0,01'));
});

test('without a vehicle the model is told so', async () => {
  const { deps, calls } = setup();
  await askAdvisor(deps, { installId: ID, question: 'O que checar antes de comprar um usado?' });
  assert.match(calls[0].messages[0].content, /Nenhum veículo selecionado/);
});

test('history is validated, trimmed and must alternate', () => {
  assert.deepEqual(cleanHistory(undefined), []);
  const ok = [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }];
  assert.deepEqual(cleanHistory(ok), ok);
  assert.equal(cleanHistory([{ role: 'user', text: 'a' }]), null, 'must end with an answer');
  assert.equal(cleanHistory([{ role: 'system', text: 'x' }, { role: 'assistant', text: 'b' }]), null);
  assert.equal(cleanHistory([{ role: 'user', text: 'a' }, { role: 'user', text: 'b' }]), null);
  const long = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: String(i) }));
  assert.equal(cleanHistory(long)!.length, 6);
  assert.equal(cleanHistory([{ role: 'user', text: 'x'.repeat(5000) }, { role: 'assistant', text: 'b' }])![0].text.length, 1500);
});

test('bad requests, limits and outages', async () => {
  assert.equal((await askAdvisor(setup().deps, { installId: 'x', question: 'a' })).status, 'invalid_request');
  assert.equal((await askAdvisor(setup().deps, { installId: ID, question: '' })).status, 'invalid_request');
  assert.equal((await askAdvisor(setup().deps, { installId: ID, question: 'x'.repeat(501) })).status, 'invalid_request');
  assert.equal((await askAdvisor(setup({ callModel: null }).deps, { installId: ID, question: 'a' })).status, 'unavailable');
  assert.equal((await askAdvisor(setup({ callModel: async () => { throw new Error('529'); } }).deps, { installId: ID, question: 'a' })).status, 'unavailable');
  assert.equal((await askAdvisor(setup({ takeQuota: async () => 'global_limit' }).deps, { installId: ID, question: 'a' })).status, 'unavailable');
  const { deps } = setup();
  for (let i = 0; i < 5; i++) assert.equal((await askAdvisor(deps, { installId: ID, question: 'a' })).status, 'ok');
  assert.deepEqual(await askAdvisor(deps, { installId: ID, question: 'a' }), { status: 'limit', plus: false, limit: 5 });
  assert.equal(ADVISOR_HTTP.limit, 429);
});

test('Plus gets the higher limit; a refusal becomes a polite answer; truncation is marked', async () => {
  const seen: number[] = [];
  const plus = setup({ isPlus: async () => true, takeQuota: async (_i, l) => { seen.push(l); return 'ok'; } });
  await askAdvisor(plus.deps, { installId: ID, question: 'a' });
  assert.deepEqual(seen, [50]);
  const refused = setup({ callModel: async () => ({ text: '', refused: true, truncated: false }) });
  assert.match((await askAdvisor(refused.deps, { installId: ID, question: 'a' }) as { answer: string }).answer, /Não consigo ajudar/);
  const cut = setup({ callModel: async () => ({ text: 'Começo', refused: false, truncated: true }) });
  assert.deepEqual(await askAdvisor(cut.deps, { installId: ID, question: 'a' }), { status: 'ok', answer: 'Começo…' });
});

test('vehicleFacts lists the monthly prices', async () => {
  const f = vehicleFacts((await repo.getVehicle('y-1'))!);
  assert.match(f, /Código FIPE: 900001-1/);
  assert.equal((f.match(/2026-\d\d=R\$/g) ?? []).length + (f.match(/2025-\d\d=R\$/g) ?? []).length, 12);
});

test('Claude adapter: request shape, refusal check before content, max_tokens', async () => {
  const sent: Record<string, unknown>[] = [];
  const fake = (res: { stop_reason: string | null; content: { type: string; text?: string }[] }) => ({
    beta: { messages: { create: async (p: Record<string, unknown>) => { sent.push(p); return res; } } },
  });
  const call = createClaudeCaller(fake({ stop_reason: 'end_turn', content: [{ type: 'thinking' }, { type: 'text', text: 'Oi' }] }));
  assert.deepEqual(await call({ system: 'S', messages: [{ role: 'user', content: 'q' }] }), { text: 'Oi', refused: false, truncated: false });
  const p = sent[0];
  assert.equal(p.model, ADVISOR_MODEL);
  assert.equal(p.model, 'claude-opus-5-5');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.output_config, { effort: 'low' });
  assert.ok(!('thinking' in p), 'thinking is not configured (always on for this model)');
  assert.deepEqual(p.system, [{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }]);
  assert.deepEqual(await createClaudeCaller(fake({ stop_reason: 'refusal', content: [{ type: 'text', text: 'parcial' }] }))({ system: 'S', messages: [] }),
    { text: '', refused: true, truncated: false });
  assert.equal((await createClaudeCaller(fake({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'x' }] }))({ system: 'S', messages: [] })).truncated, true);
});
