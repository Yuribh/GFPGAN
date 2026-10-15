// Paid vehicle history report (Deno Edge Function). NOT RUN YET: Deno is not available in this environment.
// The logic it calls is tested: server/tests/history.test.ts and supabase/tests/history_test.sql.
import { createHistoryProvider } from '../../../server/history/provider.ts';
import { HISTORY_HTTP, createRevenueCatPurchaseCheck, getHistoryReport } from '../../../server/history/report.ts';
import { createSupabaseHistoryStore } from '../../../server/history/supabase-store.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const provider = env('HISTORY_API_URL') && env('HISTORY_API_TOKEN')
  ? createHistoryProvider({ urlTemplate: env('HISTORY_API_URL'), token: env('HISTORY_API_TOKEN'), auth: env('HISTORY_API_AUTH') || 'bearer' })
  : null;
const store = createSupabaseHistoryStore({ url: env('SUPABASE_URL'), serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') });
const ownsTransaction = createRevenueCatPurchaseCheck({ secretKey: env('REVENUECAT_SECRET_KEY') || undefined });

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!env('PLATE_HASH_PEPPER')) return Response.json({ status: 'unavailable' }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ status: 'invalid_request' }, { status: 400 }); }
  try {
    const result = await getHistoryReport({ store, provider, ownsTransaction, pepper: env('PLATE_HASH_PEPPER') }, body);
    return Response.json(result, { status: HISTORY_HTTP[result.status] });
  } catch (e) {
    console.error('vehicle-history failed', (e as Error).message);   // never log the plate
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
});
