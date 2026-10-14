// Client for the advisor Edge Function. Without Supabase keys it answers locally from the sample data,
// so the screen can be tried; the answer says it is an example.
import type { VehicleResult } from './types.ts';
import { formatBRL } from '../format.ts';

export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export type AdvisorAnswer =
  | { status: 'ok'; answer: string }
  | { status: 'limit'; plus: boolean; limit: number }
  | { status: 'unavailable' | 'offline' | 'invalid_request' };

export function createAdvisorClient(opts: { url?: string; anonKey?: string; fetchImpl?: typeof fetch }) {
  const f = opts.fetchImpl ?? fetch;
  const endpoint = opts.url && opts.anonKey ? opts.url.replace(/\/$/, '') + '/functions/v1/advisor' : null;
  return {
    sample: !endpoint,
    async ask(args: { question: string; history: ChatTurn[]; installId: string; rcUserId?: string; vehicle?: VehicleResult | null }): Promise<AdvisorAnswer> {
      if (!endpoint) return sampleAnswer(args.vehicle ?? null);
      let res: Response;
      try {
        res = await f(endpoint, {
          method: 'POST',
          headers: { apikey: opts.anonKey!, authorization: `Bearer ${opts.anonKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ question: args.question, history: args.history, installId: args.installId, rcUserId: args.rcUserId, modelYearId: args.vehicle?.year.id }),
        });
      } catch {
        return { status: 'offline' };
      }
      let body: Record<string, unknown> = {};
      try { body = await res.json(); } catch { /* keep empty */ }
      if (body.status === 'ok' && typeof body.answer === 'string') return { status: 'ok', answer: body.answer };
      if (body.status === 'limit') return { status: 'limit', plus: Boolean(body.plus), limit: Number(body.limit) || 0 };
      if (body.status === 'invalid_request') return { status: 'invalid_request' };
      return { status: 'unavailable' };
    },
  };
}

async function sampleAnswer(v: VehicleResult | null): Promise<AdvisorAnswer> {
  await new Promise(r => setTimeout(r, 500));
  const base = v
    ? `Pela tabela FIPE, este ${v.model.name} vale ${formatBRL(v.latest.priceCents)}. Um preço de anúncio até uns 5% acima ou abaixo disso é comum; quilometragem, estado e histórico de revisões explicam a diferença.`
    : 'Antes de fechar negócio, compare o preço com a tabela FIPE, peça um laudo cautelar e consulte débitos e restrições no Detran.';
  return { status: 'ok', answer: `${base}\n\n(Resposta de exemplo: o consultor de verdade aparece quando o app estiver ligado ao servidor.)` };
}
