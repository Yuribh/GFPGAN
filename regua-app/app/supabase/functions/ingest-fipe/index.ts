// Scheduled Edge Function (Deno). Runs one budgeted slice of the monthly ingestion and returns.
// Schedule it often (for example every 10 minutes on days 1 to 12) so slices add up to a full month;
// each call stops before the request budget or the function time limit and resumes from the checkpoint.
// NOT RUN YET: written for Supabase's Deno runtime, which is not available in this environment.
import { createFipeProvider } from '../../../server/fipe/provider.ts';
import { createSupabaseStore } from '../../../server/fipe/supabase-store.ts';
import { runIngestion } from '../../../server/fipe/ingest.ts';

Deno.serve(async req => {
  // only the scheduler (or you) may trigger it
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('INGEST_CRON_SECRET')}`) {
    return new Response('unauthorized', { status: 401 });
  }
  const provider = createFipeProvider({ token: Deno.env.get('FIPE_API_TOKEN') ?? undefined });
  const store = createSupabaseStore({
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  });
  const result = await runIngestion(provider, store, {
    requestBudget: Number(Deno.env.get('FIPE_REQUESTS_PER_RUN') ?? '400'),
  });
  return Response.json(result, { status: result.status === 'failed' ? 500 : 200 });
});
