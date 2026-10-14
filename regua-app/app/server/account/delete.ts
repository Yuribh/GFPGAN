// Account deletion: verify who is asking with their own token, then delete them with the admin API.
// The database cascades (tested in supabase/tests/rls_test.sql): favorites, tokens, profile and
// subscriptions go; search events stay, without the user id. Apple requires deletion inside the app.
export interface DeleteDeps { supabaseUrl: string; serviceRoleKey: string; anonKey: string; fetchImpl?: typeof fetch }

export async function deleteAccount(authorization: string | null, deps: DeleteDeps): Promise<{ status: number; body: string }> {
  const f = deps.fetchImpl ?? fetch;
  const base = deps.supabaseUrl.replace(/\/$/, '');
  if (!authorization?.startsWith('Bearer ')) return { status: 401, body: 'sign in first' };
  const who = await f(`${base}/auth/v1/user`, { headers: { authorization, apikey: deps.anonKey } });
  if (!who.ok) return { status: 401, body: 'sign in first' };
  const user = await who.json() as { id?: string };
  if (!user.id) return { status: 401, body: 'sign in first' };
  const del = await f(`${base}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${deps.serviceRoleKey}`, apikey: deps.serviceRoleKey },
  });
  if (!del.ok) return { status: 502, body: 'could not delete, try again' };
  return { status: 204, body: '' };
}
