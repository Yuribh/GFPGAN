// RevenueCat webhook (Deno Edge Function). NOT RUN YET: Deno is not available in this environment.
// The logic it calls is tested: server/tests/billing-account.test.ts and supabase/tests/billing_test.sql.
import { mapEvent, verifySignature } from '../../../server/billing/revenuecat.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const raw = await req.text();   // raw bytes: re-serializing would break the signature
  const ok = await verifySignature(raw, req.headers.get('x-revenuecat-webhook-signature'), Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '');
  if (!ok) return new Response('bad signature', { status: 401 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  const mapped = mapEvent(body, { environment: (Deno.env.get('REVENUECAT_ENVIRONMENT') as 'PRODUCTION' | 'SANDBOX') ?? 'PRODUCTION' });
  if (mapped.kind === 'ignore') return Response.json({ ignored: mapped.reason });  // 200 so RevenueCat does not retry
  const u = mapped.update;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/apply_billing_event`, {
    method: 'POST',
    headers: { apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_user_id: u.userId, p_store: u.store, p_external_id: u.externalId, p_status: u.status,
      p_renews_at: u.renewsAt, p_event_id: u.eventId, p_event_at: u.eventAt }),
  });
  // non-200 makes RevenueCat retry (5, 10, 20, 40, 80 minutes); the SQL function is idempotent and ordered
  if (!res.ok) return new Response('database error', { status: 500 });
  return Response.json({ result: await res.json() });
});
