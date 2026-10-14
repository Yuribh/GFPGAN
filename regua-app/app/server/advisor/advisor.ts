// Consultor: answers buying/selling questions about a vehicle with Claude, grounded in the FIPE data from our catalog.
// Runs in the advisor Edge Function (Deno) and in the Node tests. The model call, the catalog and the quota are injected.
import type { VehicleResult } from '../../src/data/types.ts';
import { formatBRL, formatModelYear, formatMonth, formatPercent } from '../../src/format.ts';

export const MAX_QUESTION = 500;
export const MAX_TURNS = 6;           // earlier turns sent back for context (3 questions + 3 answers)
export const MAX_TURN_CHARS = 1500;

// Stable, cached prefix: never put per-request data (dates, prices, ids) in here.
export const SYSTEM_PROMPT = `Você é o Consultor da Régua, um app brasileiro que mostra o preço da tabela FIPE de carros, motos e caminhões.
Você ajuda pessoas comuns a comprar e vender veículos usados com mais segurança.

Como responder:
- Português do Brasil, tom direto e cordial, sem jargão. Frases curtas.
- No máximo uns 150 palavras. Use listas curtas quando ajudar. Sem títulos, sem tabelas, sem emojis.
- Quando houver dados do veículo na mensagem, use-os e cite os números (preço FIPE, variação). Nunca invente preços, porcentagens, dados de mercado, recalls ou defeitos que não estejam nos dados.
- A tabela FIPE é uma média de referência. O preço real muda com quilometragem, estado, região, versão, opcionais e histórico. Diga isso quando for relevante, sem repetir em toda resposta.
- Para "quanto pedir" ou "o preço está bom", dê uma faixa razoável em torno da FIPE explicando o porquê, e diga o que faz o valor subir ou cair.
- Recomende checagens práticas quando fizer sentido: laudo cautelar, vistoria, consulta de débitos e restrições no Detran, histórico de revisões, test drive.
- Você não é advogado, despachante nem consultor financeiro: em financiamento, impostos ou disputas, dê orientação geral e sugira procurar o órgão ou profissional certo.
- Não peça nem registre dados pessoais (CPF, nome, endereço). Se a pessoa enviar, não repita.
- Se a pergunta não tiver relação com veículos, compra, venda, manutenção ou custos de ter um veículo, diga com gentileza que só ajuda com esses assuntos.
- Se não souber, diga que não sabe.`;

export interface Turn { role: 'user' | 'assistant'; text: string }

export interface ModelReply { text: string; refused: boolean; truncated: boolean }
export type CallModel = (args: { system: string; messages: { role: 'user' | 'assistant'; content: string }[] }) => Promise<ModelReply>;

export type AdvisorResult =
  | { status: 'ok'; answer: string }
  | { status: 'invalid_request' }
  | { status: 'limit'; plus: boolean; limit: number }
  | { status: 'unavailable' };

export const ADVISOR_HTTP: Record<AdvisorResult['status'], number> = { ok: 200, invalid_request: 400, limit: 429, unavailable: 503 };

export interface AdvisorDeps {
  callModel: CallModel | null;                                  // null when no API key is configured
  getVehicle(modelYearId: string): Promise<VehicleResult | null>;
  isPlus(rcUserId: string | undefined): Promise<boolean>;
  takeQuota(installId: string, deviceLimit: number, globalLimit: number): Promise<'ok' | 'device_limit' | 'global_limit'>;
  limits: { free: number; plus: number; globalDaily: number };
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPE = { cars: 'carro', motorcycles: 'moto', trucks: 'caminhão' } as const;

/** The vehicle as plain facts for the model. Only data from our catalog, never from the client. */
export function vehicleFacts(v: VehicleResult): string {
  const pts = v.history.slice(-12);
  const yearPct = pts.length > 1 && pts[0].priceCents > 0 ? ((v.latest.priceCents - pts[0].priceCents) / pts[0].priceCents) * 100 : null;
  const lines = [
    `Veículo: ${v.brand.name} ${v.model.name} (${TYPE[v.brand.vehicleType]})`,
    `Ano modelo: ${formatModelYear(v.year.modelYear)} · Combustível: ${v.year.fuel} · Código FIPE: ${v.year.fipeCode}`,
    `Preço FIPE (tabela de ${formatMonth(v.latest.referenceMonth)}): ${formatBRL(v.latest.priceCents)}`,
    v.change ? `Variação no mês: ${formatPercent(v.change.percent)} (${formatBRL(v.change.cents)})` : 'Variação no mês: sem dado',
    yearPct === null ? null : `Variação em ${pts.length} meses: ${formatPercent(yearPct)} (de ${formatBRL(pts[0].priceCents)} em ${formatMonth(pts[0].referenceMonth)})`,
    `Preços mês a mês: ${pts.map(p => `${p.referenceMonth}=${formatBRL(p.priceCents)}`).join('; ')}`,
  ];
  return lines.filter(Boolean).join('\n');
}

/** Validates and trims the client's history: alternating user/assistant, short, ending with an assistant turn. */
export function cleanHistory(raw: unknown): Turn[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 40) return null;
  const turns: Turn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') return null;
    const { role, text } = t as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string' || !text.trim()) return null;
    turns.push({ role, text: text.slice(0, MAX_TURN_CHARS) });
  }
  let recent = turns.slice(-MAX_TURNS);
  while (recent.length && recent[0].role !== 'user') recent = recent.slice(1);
  for (let i = 0; i < recent.length; i++) if (recent[i].role !== (i % 2 === 0 ? 'user' : 'assistant')) return null;
  if (recent.length && recent[recent.length - 1].role !== 'assistant') return null;
  return recent;
}

export async function askAdvisor(deps: AdvisorDeps, body: unknown): Promise<AdvisorResult> {
  const req = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const installId = typeof req.installId === 'string' && UUID.test(req.installId) ? req.installId : null;
  const question = typeof req.question === 'string' ? req.question.trim() : '';
  const history = cleanHistory(req.history);
  const modelYearId = typeof req.modelYearId === 'string' && req.modelYearId.length <= 64 ? req.modelYearId : null;
  if (!installId || !question || question.length > MAX_QUESTION || !history) return { status: 'invalid_request' };
  if (!deps.callModel) return { status: 'unavailable' };

  const rcUserId = typeof req.rcUserId === 'string' && req.rcUserId.length <= 100 ? req.rcUserId : undefined;
  const plus = await deps.isPlus(rcUserId).catch(() => false);
  const limit = plus ? deps.limits.plus : deps.limits.free;
  const quota = await deps.takeQuota(installId, limit, deps.limits.globalDaily);
  if (quota === 'device_limit') return { status: 'limit', plus, limit };
  if (quota === 'global_limit') return { status: 'unavailable' };

  const vehicle = modelYearId ? await deps.getVehicle(modelYearId).catch(() => null) : null;
  const today = (deps.now?.() ?? new Date()).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  // volatile context goes in the user turn, after the cached system prompt
  const context = [`Data de hoje: ${today}.`, vehicle ? `Dados do veículo (do catálogo da Régua):\n${vehicleFacts(vehicle)}` : 'Nenhum veículo selecionado.'].join('\n');
  const messages = [
    ...history.map(t => ({ role: t.role, content: t.text })),
    { role: 'user' as const, content: `${context}\n\nPergunta: ${question}` },
  ];

  let reply: ModelReply;
  try {
    reply = await deps.callModel({ system: SYSTEM_PROMPT, messages });
  } catch {
    return { status: 'unavailable' };
  }
  if (reply.refused || !reply.text.trim()) {
    return { status: 'ok', answer: 'Não consigo ajudar com essa pergunta. Posso ajudar com preço, compra, venda e cuidados com o veículo.' };
  }
  const answer = reply.text.trim() + (reply.truncated ? '…' : '');
  return { status: 'ok', answer };
}
