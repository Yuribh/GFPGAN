// Client for the vehicle-history Edge Function, plus the sample report used when the app has no server keys.
import type { HistoryReport } from '../../server/history/provider.ts';
export type { HistoryReport, HistoryCheck, CheckKey, CheckStatus } from '../../server/history/provider.ts';
export { CHECK_LABEL } from '../../server/history/provider.ts';

export type HistoryAnswer =
  | { status: 'ok'; report: HistoryReport }
  | { status: 'not_paid' | 'already_used' | 'not_found' | 'unavailable' | 'offline' | 'invalid_plate' };

export function createHistoryClient(opts: { url?: string; anonKey?: string; fetchImpl?: typeof fetch }) {
  const f = opts.fetchImpl ?? fetch;
  const endpoint = opts.url && opts.anonKey ? opts.url.replace(/\/$/, '') + '/functions/v1/vehicle-history' : null;
  return {
    sample: !endpoint,
    async fetchReport(plate: string, transactionId: string, rcUserId: string): Promise<HistoryAnswer> {
      if (!endpoint) return { status: 'ok', report: SAMPLE_REPORT };
      let res: Response;
      try {
        res = await f(endpoint, {
          method: 'POST',
          headers: { apikey: opts.anonKey!, authorization: `Bearer ${opts.anonKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ plate, transactionId, rcUserId }),
        });
      } catch {
        return { status: 'offline' };
      }
      let body: Record<string, unknown> = {};
      try { body = await res.json(); } catch { /* keep empty */ }
      if (body.status === 'ok' && body.report) return { status: 'ok', report: body.report as HistoryReport };
      if (['not_paid', 'already_used', 'not_found', 'invalid_plate'].includes(String(body.status))) return { status: body.status as 'not_paid' };
      return { status: 'unavailable' };
    },
  };
}

export const SAMPLE_REPORT: HistoryReport = {
  vehicle: { brand: 'Marca Exemplo Alfa', model: 'Modelo B 2.0 Automático', year: 2021, color: 'Prata' },
  checks: [
    { key: 'leilao', status: 'ok' },
    { key: 'roubo_furto', status: 'ok' },
    { key: 'sinistro', status: 'ok' },
    { key: 'gravame', status: 'alert', detail: 'Financiamento ativo (exemplo)' },
    { key: 'restricoes', status: 'ok' },
    { key: 'recall', status: 'unknown' },
  ],
};
