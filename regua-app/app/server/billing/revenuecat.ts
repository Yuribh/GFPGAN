// RevenueCat webhook: signature check and event mapping. Runs on Node (tests) and Deno (Edge Function);
// both have WebCrypto. Docs read 2026-10-13: revenuecat.com/docs/integrations/webhooks and .../event-types-and-fields

const enc = new TextEncoder();

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifies `X-RevenueCat-Webhook-Signature: t=<unix seconds>,v1=<hex hmac-sha256 of "t.rawBody">`. */
export async function verifySignature(rawBody: string, header: string | null, secret: string,
  nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.trim().split('=', 2) as [string, string]));
  const t = Number(parts.t), v1 = parts.v1;
  if (!Number.isInteger(t) || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`)));
  const hex = Array.from(mac, b => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqualHex(hex, v1.toLowerCase());
}

export type SubStatus = 'active' | 'grace' | 'expired' | 'cancelled';
export interface BillingUpdate {
  userId: string; store: 'apple' | 'google'; externalId: string; status: SubStatus;
  renewsAt: string | null; eventId: string; eventAt: string;
}
export type MapResult = { kind: 'apply'; update: BillingUpdate } | { kind: 'ignore'; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_BY_TYPE: Record<string, SubStatus> = {
  INITIAL_PURCHASE: 'active', RENEWAL: 'active', UNCANCELLATION: 'active', PRODUCT_CHANGE: 'active',
  SUBSCRIPTION_EXTENDED: 'active', REFUND_REVERSED: 'active',
  // cancelled = auto-renew off; access continues until EXPIRATION, per RevenueCat's docs
  CANCELLATION: 'cancelled',
  BILLING_ISSUE: 'grace',
  EXPIRATION: 'expired',
};

// deno-lint-ignore no-explicit-any
export function mapEvent(body: any, opts: { entitlement?: string; environment?: 'PRODUCTION' | 'SANDBOX' } = {}): MapResult {
  const e = body?.event;
  if (!e || typeof e !== 'object') return { kind: 'ignore', reason: 'no event' };
  if (e.type === 'TEST') return { kind: 'ignore', reason: 'test event' };
  if (opts.environment && e.environment !== opts.environment) return { kind: 'ignore', reason: `environment ${e.environment}` };
  const status = STATUS_BY_TYPE[e.type];
  if (!status) return { kind: 'ignore', reason: `event type ${e.type} does not change access` };
  const entitlement = opts.entitlement ?? 'plus';
  if (!Array.isArray(e.entitlement_ids) || !e.entitlement_ids.includes(entitlement)) {
    return { kind: 'ignore', reason: 'not the plus entitlement' };
  }
  const store = e.store === 'APP_STORE' ? 'apple' : e.store === 'PLAY_STORE' ? 'google' : null;
  if (!store) return { kind: 'ignore', reason: `store ${e.store}` };
  // the app logs in to RevenueCat with the Supabase user id; anonymous RevenueCat ids are not ours
  const userId = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])].find((x: unknown) => typeof x === 'string' && UUID.test(x));
  if (!userId) return { kind: 'ignore', reason: 'no app user id that is a user of ours' };
  if (typeof e.id !== 'string' || !Number.isFinite(e.event_timestamp_ms) || !e.original_transaction_id) {
    return { kind: 'ignore', reason: 'missing id, timestamp or transaction' };
  }
  const graceEnd = status === 'grace' && e.grace_period_expiration_at_ms ? e.grace_period_expiration_at_ms : null;
  const exp = graceEnd ?? e.expiration_at_ms;
  return {
    kind: 'apply',
    update: {
      userId: userId.toLowerCase(), store, externalId: String(e.original_transaction_id), status,
      renewsAt: Number.isFinite(exp) ? new Date(exp).toISOString() : null,
      eventId: e.id, eventAt: new Date(e.event_timestamp_ms).toISOString(),
    },
  };
}
