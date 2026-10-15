import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics } from '../src/services/analytics.ts';

function recorder(status = 201) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(null, { status }); }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

test('analytics is off without Supabase keys and sends nothing', async () => {
  const r = recorder();
  const a = createAnalytics({ platform: 'android', appVersion: '0.1.0', fetchImpl: r.fetchImpl });
  assert.equal(a.enabled, false);
  assert.equal(await a.track('price_viewed'), false);
  assert.equal(r.calls.length, 0);
});

test('analytics posts only anonymous fields to app_events', async () => {
  const r = recorder();
  const a = createAnalytics({ url: 'https://x.supabase.co/', anonKey: 'anon', platform: 'ios', appVersion: '1.2.3', fetchImpl: r.fetchImpl });
  assert.equal(await a.track('price_viewed'), true);
  assert.equal(r.calls[0].url, 'https://x.supabase.co/rest/v1/app_events');
  const body = JSON.parse(String(r.calls[0].init.body));
  assert.deepEqual(Object.keys(body).sort(), ['app_version', 'event', 'platform', 'session_id']);
  assert.equal(body.event, 'price_viewed');
  assert.match(body.session_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('one session id per launch, shared by every event', async () => {
  const r = recorder();
  const a = createAnalytics({ url: 'https://x', anonKey: 'k', platform: 'android', appVersion: '1', fetchImpl: r.fetchImpl });
  await a.track('app_open'); await a.track('lookup_started');
  const ids = r.calls.map(c => JSON.parse(String(c.init.body)).session_id);
  assert.equal(ids[0], ids[1]);
});

test('a failing network never throws', async () => {
  const fetchImpl = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  const a = createAnalytics({ url: 'https://x', anonKey: 'k', platform: 'android', appVersion: '1', fetchImpl });
  assert.equal(await a.track('app_open'), false);
  const r = recorder(500);
  const b = createAnalytics({ url: 'https://x', anonKey: 'k', platform: 'android', appVersion: '1', fetchImpl: r.fetchImpl });
  assert.equal(await b.track('app_open'), false);
});

test('unknown events are dropped', async () => {
  const r = recorder();
  const a = createAnalytics({ url: 'https://x', anonKey: 'k', platform: 'android', appVersion: '1', fetchImpl: r.fetchImpl });
  assert.equal(await a.track('email' as never), false);
  assert.equal(r.calls.length, 0);
});
