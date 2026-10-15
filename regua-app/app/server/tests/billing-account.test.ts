import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature, mapEvent } from '../billing/revenuecat.ts';
import { deleteAccount } from '../account/delete.ts';

const SECRET = 'whsec_test';
const sign = (t: number, body: string, secret = SECRET) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const USER = '0b6f4f6e-1a2b-4c3d-8e9f-0123456789ab';
const ev = (over: Record<string, unknown> = {}) => ({ api_version: '1.0', event: {
  id: 'evt-1', type: 'INITIAL_PURCHASE', app_user_id: USER, original_app_user_id: USER, aliases: [USER],
  original_transaction_id: 'GPA.1', store: 'PLAY_STORE', environment: 'PRODUCTION', entitlement_ids: ['plus'],
  event_timestamp_ms: 1_760_000_000_000, expiration_at_ms: 1_762_600_000_000, ...over } });

test('valid signature is accepted (independent HMAC from node:crypto)', async () => {
  const body = JSON.stringify(ev()); const t = 1_760_000_000;
  assert.equal(await verifySignature(body, sign(t, body), SECRET, t), true);
});
test('tampered body, wrong secret, old timestamp and missing header are rejected', async () => {
  const body = JSON.stringify(ev()); const t = 1_760_000_000;
  assert.equal(await verifySignature(body.replace('PLAY_STORE', 'APP_STORE'), sign(t, body), SECRET, t), false);
  assert.equal(await verifySignature(body, sign(t, body, 'other'), SECRET, t), false);
  assert.equal(await verifySignature(body, sign(t, body), SECRET, t + 301), false);
  assert.equal(await verifySignature(body, null, SECRET, t), false);
  assert.equal(await verifySignature(body, 't=abc,v1=zz', SECRET, t), false);
});

test('purchase maps to an active subscription for our user', () => {
  const r = mapEvent(ev(), { environment: 'PRODUCTION' });
  assert.equal(r.kind, 'apply');
  if (r.kind !== 'apply') return;
  assert.deepEqual(r.update, { userId: USER, store: 'google', externalId: 'GPA.1', status: 'active',
    renewsAt: new Date(1_762_600_000_000).toISOString(), eventId: 'evt-1', eventAt: new Date(1_760_000_000_000).toISOString() });
});
test('cancellation keeps access until expiration; expiration ends it', () => {
  const c = mapEvent(ev({ type: 'CANCELLATION' })); const x = mapEvent(ev({ type: 'EXPIRATION' }));
  assert.equal(c.kind === 'apply' && c.update.status, 'cancelled');
  assert.equal(x.kind === 'apply' && x.update.status, 'expired');
});
test('billing issue uses the grace period end', () => {
  const r = mapEvent(ev({ type: 'BILLING_ISSUE', grace_period_expiration_at_ms: 1_761_000_000_000 }));
  assert.equal(r.kind === 'apply' && r.update.status, 'grace');
  assert.equal(r.kind === 'apply' && r.update.renewsAt, new Date(1_761_000_000_000).toISOString());
});
test('ignored: test events, pauses, sandbox in production, other entitlements, anonymous ids, other stores', () => {
  assert.equal(mapEvent(ev({ type: 'TEST' })).kind, 'ignore');
  assert.equal(mapEvent(ev({ type: 'SUBSCRIPTION_PAUSED' })).kind, 'ignore');
  assert.equal(mapEvent(ev({ environment: 'SANDBOX' }), { environment: 'PRODUCTION' }).kind, 'ignore');
  assert.equal(mapEvent(ev({ entitlement_ids: ['other'] })).kind, 'ignore');
  assert.equal(mapEvent(ev({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: '$RCAnonymousID:abc', aliases: [] })).kind, 'ignore');
  assert.equal(mapEvent(ev({ store: 'STRIPE' })).kind, 'ignore');
  assert.equal(mapEvent({}).kind, 'ignore');
});
test('user id is found in aliases when the last seen id is anonymous', () => {
  const r = mapEvent(ev({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: '$RCAnonymousID:abc', aliases: ['$RCAnonymousID:abc', USER] }));
  assert.equal(r.kind === 'apply' && r.update.userId, USER);
});

function authApi(userId: string | null, deleteOk = true) {
  const calls: { url: string; method: string; auth: string }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const h = init.headers as Record<string, string>;
    calls.push({ url, method: init.method ?? 'GET', auth: h.authorization });
    if (url.endsWith('/auth/v1/user')) return userId ? Response.json({ id: userId }) : new Response('bad jwt', { status: 401 });
    return new Response(null, { status: deleteOk ? 200 : 500 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}
const deps = (f: typeof fetch) => ({ supabaseUrl: 'https://x.supabase.co', serviceRoleKey: 'svc', anonKey: 'anon', fetchImpl: f });

test('delete account deletes exactly the caller, with the service key', async () => {
  const api = authApi(USER);
  const r = await deleteAccount('Bearer user-jwt', deps(api.fetchImpl));
  assert.equal(r.status, 204);
  assert.equal(api.calls[0].auth, 'Bearer user-jwt');
  assert.deepEqual(api.calls[1], { url: `https://x.supabase.co/auth/v1/admin/users/${USER}`, method: 'DELETE', auth: 'Bearer svc' });
});
test('delete account refuses without a valid sign-in and never calls delete', async () => {
  const api = authApi(null);
  assert.equal((await deleteAccount('Bearer forged', deps(api.fetchImpl))).status, 401);
  assert.equal((await deleteAccount(null, deps(api.fetchImpl))).status, 401);
  assert.ok(api.calls.every(c => c.method !== 'DELETE'));
});
test('delete account reports a failed delete', async () => {
  assert.equal((await deleteAccount('Bearer user-jwt', deps(authApi(USER, false).fetchImpl))).status, 502);
});
