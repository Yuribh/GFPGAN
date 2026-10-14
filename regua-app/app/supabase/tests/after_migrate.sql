-- Supabase grants table privileges to these roles by default; RLS is what restricts them.
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
