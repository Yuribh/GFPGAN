// Consultor (Deno Edge Function). NOT RUN YET: Deno is not available in this environment.
// The logic it calls is tested: server/tests/advisor.test.ts and supabase/tests/quota_test.sql.
// ANTHROPIC_API_KEY stays here (Supabase secret), never in the app.
import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';
import { ADVISOR_HTTP, askAdvisor, type CallModel } from '../../../server/advisor/advisor.ts';
import { createClaudeCaller } from '../../../server/advisor/claude.ts';
import { createRevenueCatCheck } from '../../../server/plate/lookup.ts';
import { createSupabaseRepository } from '../../../src/data/supabase.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const num = (k: string, d: number) => { const n = Number(Deno.env.get(k)); return Number.isFinite(n) && n >= 0 ? n : d; };
const url = env('SUPABASE_URL'), serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

const claude = env('ANTHROPIC_API_KEY') ? createClaudeCaller(new Anthropic({ apiKey: env('ANTHROPIC_API_KEY') })) : null;
// log the kind of failure (never the question) so outages are visible in the function logs
const callModel: CallModel | null = claude && (async args => {
  try {
    return await claude(args);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.error('advisor: rate limited');
    else if (e instanceof Anthropic.APIError) console.error(`advisor: API error ${e.status}`);
    else console.error('advisor: network error');
    throw e;
  }
});
const catalog = createSupabaseRepository({ url, anonKey: serviceKey });
const isPlus = createRevenueCatCheck({ secretKey: env('REVENUECAT_SECRET_KEY') || undefined });

async function takeQuota(installId: string, deviceLimit: number, globalLimit: number) {
  const res = await fetch(`${url}/rest/v1/rpc/take_feature_quota`, {
    method: 'POST',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_feature: 'advisor', p_install_id: installId, p_device_limit: deviceLimit, p_global_limit: globalLimit }),
  });
  if (!res.ok) throw new Error(`quota ${res.status}`);
  return await res.json() as 'ok' | 'device_limit' | 'global_limit';
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ status: 'invalid_request' }, { status: 400 }); }
  try {
    const result = await askAdvisor({
      callModel, getVehicle: id => catalog.getVehicle(id), isPlus, takeQuota,
      limits: { free: num('ADVISOR_FREE_DAILY', 5), plus: num('ADVISOR_PLUS_DAILY', 50), globalDaily: num('ADVISOR_GLOBAL_DAILY', 2000) },
    }, body);
    return Response.json(result, { status: ADVISOR_HTTP[result.status] });
  } catch (e) {
    console.error('advisor failed', (e as Error).message);
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
});
