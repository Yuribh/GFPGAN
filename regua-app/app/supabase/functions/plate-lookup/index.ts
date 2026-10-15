// Plate lookup (Deno Edge Function). NOT RUN YET: Deno is not available in this environment.
// The logic it calls is tested: server/tests/plate.test.ts and supabase/tests/plate_test.sql.
// The app calls it with the anon key (default JWT check on). Provider token and secrets stay here, never in the app.
import { createPlateProvider } from '../../../server/plate/provider.ts';
import { createRevenueCatCheck, HTTP_STATUS, lookupPlate } from '../../../server/plate/lookup.ts';
import { createSupabasePlateStore } from '../../../server/plate/supabase-store.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const num = (k: string, d: number) => { const n = Number(Deno.env.get(k)); return Number.isFinite(n) && n >= 0 ? n : d; };

const provider = env('PLATE_API_URL') && env('PLATE_API_TOKEN')
  ? createPlateProvider({ urlTemplate: env('PLATE_API_URL'), token: env('PLATE_API_TOKEN'), auth: env('PLATE_API_AUTH') || 'bearer' })
  : null;
const store = createSupabasePlateStore({ url: env('SUPABASE_URL'), serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') });
const isPlus = createRevenueCatCheck({ secretKey: env('REVENUECAT_SECRET_KEY') || undefined });

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!env('PLATE_HASH_PEPPER')) return Response.json({ status: 'unavailable' }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ status: 'invalid_request' }, { status: 400 }); }
  try {
    const result = await lookupPlate({
      store, provider, isPlus, pepper: env('PLATE_HASH_PEPPER'),
      limits: { free: num('PLATE_FREE_DAILY', 3), plus: num('PLATE_PLUS_DAILY', 30), globalDaily: num('PLATE_GLOBAL_DAILY', 300) },
    }, body);
    return Response.json(result, { status: HTTP_STATUS[result.status] });
  } catch (e) {
    console.error('plate-lookup failed', (e as Error).message);   // never log the plate
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
});
