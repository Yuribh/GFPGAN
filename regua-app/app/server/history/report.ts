// Paid vehicle history report: one store purchase (consumable product) = one report.
// The purchase is checked with RevenueCat on the server and spent only once; if the provider fails, it is released
// so the user can try again without paying twice. Reports are cached 7 days by HMAC(plate).
import { normalizePlate } from '../../src/logic/plate.ts';
import { hashPlate } from '../plate/lookup.ts';
import { HistoryProviderError, type HistoryProvider, type HistoryReport } from './provider.ts';

export const HISTORY_PRODUCT = 'historico_veicular';

export interface HistoryStore {
  getCached(plateHash: string): Promise<HistoryReport | null>;
  putCached(plateHash: string, r: HistoryReport): Promise<void>;
  /** 'new' = reserved now; 'same' = already used for this plate (re-download); 'other' = used for another plate */
  claim(transactionId: string, plateHash: string): Promise<'new' | 'same' | 'other'>;
  release(transactionId: string): Promise<void>;
}

export interface HistoryDeps {
  store: HistoryStore;
  provider: HistoryProvider | null;
  /** true when this RevenueCat user bought HISTORY_PRODUCT in the transaction given */
  ownsTransaction(rcUserId: string, transactionId: string): Promise<boolean>;
  pepper: string;
}

export type HistoryResult =
  | { status: 'ok'; report: HistoryReport; cached: boolean }
  | { status: 'invalid_plate' | 'invalid_request' | 'not_paid' | 'already_used' | 'not_found' | 'unavailable' };

export const HISTORY_HTTP: Record<HistoryResult['status'], number> = {
  ok: 200, invalid_plate: 400, invalid_request: 400, not_paid: 402, already_used: 409, not_found: 404, unavailable: 503,
};

export async function getHistoryReport(deps: HistoryDeps, body: unknown): Promise<HistoryResult> {
  const req = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const rcUserId = typeof req.rcUserId === 'string' && req.rcUserId.length <= 100 ? req.rcUserId : null;
  const transactionId = typeof req.transactionId === 'string' && /^[\w.:-]{4,200}$/.test(req.transactionId) ? req.transactionId : null;
  if (!rcUserId || !transactionId || typeof req.plate !== 'string') return { status: 'invalid_request' };
  const plate = normalizePlate(req.plate);
  if (!plate) return { status: 'invalid_plate' };
  if (!deps.provider) return { status: 'unavailable' };

  if (!(await deps.ownsTransaction(rcUserId, transactionId).catch(() => false))) return { status: 'not_paid' };
  const key = await hashPlate(plate, deps.pepper);
  const claim = await deps.store.claim(transactionId, key);
  if (claim === 'other') return { status: 'already_used' };

  const cached = await deps.store.getCached(key);
  if (cached) return { status: 'ok', report: cached, cached: true };

  let report: HistoryReport | null;
  try {
    report = await deps.provider.lookup(plate);
  } catch (e) {
    if (claim === 'new') await deps.store.release(transactionId);
    if (e instanceof HistoryProviderError) return { status: 'unavailable' };
    throw e;
  }
  if (!report) {
    if (claim === 'new') await deps.store.release(transactionId);   // nothing to show: the purchase stays usable
    return { status: 'not_found' };
  }
  await deps.store.putCached(key, report);
  return { status: 'ok', report, cached: false };
}

/** RevenueCat REST: GET /v1/subscribers/{id} -> subscriber.non_subscriptions[product][] with id / store_transaction_id. */
export function createRevenueCatPurchaseCheck(opts: { secretKey?: string; product?: string; fetchImpl?: typeof fetch }) {
  const f = opts.fetchImpl ?? fetch;
  const product = opts.product ?? HISTORY_PRODUCT;
  return async (rcUserId: string, transactionId: string): Promise<boolean> => {
    if (!opts.secretKey) return false;
    const res = await f(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcUserId)}`, {
      headers: { authorization: `Bearer ${opts.secretKey}`, accept: 'application/json' },
    });
    if (!res.ok) return false;
    const body = await res.json() as { subscriber?: { non_subscriptions?: Record<string, { id?: string; store_transaction_id?: string }[]> } };
    const list = body.subscriber?.non_subscriptions?.[product] ?? [];
    return list.some(t => t.id === transactionId || t.store_transaction_id === transactionId);
  };
}
