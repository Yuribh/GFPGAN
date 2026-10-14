// Account deletion (Deno Edge Function). NOT RUN YET. Logic tested in server/tests/billing-account.test.ts.
import { deleteAccount } from '../../../server/account/delete.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const r = await deleteAccount(req.headers.get('authorization'), {
    supabaseUrl: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  });
  return new Response(r.body || null, { status: r.status });
});
