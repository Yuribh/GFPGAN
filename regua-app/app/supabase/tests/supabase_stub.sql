-- Minimal stand-in for what Supabase provides, so migrations can be tested on plain Postgres.
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
-- Supabase's auth.uid() reads the user id from the request's JWT claims; here it reads a setting.
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
-- Supabase's default: new functions in public are executable by anon and authenticated.
alter default privileges in schema public grant execute on functions to anon, authenticated;
