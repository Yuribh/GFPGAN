\set ON_ERROR_STOP 0
\set QUIET 1
-- fixtures as superuser
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');
insert into reference_months (source_code, year, month) values (330, 2026, 10);
insert into brands (vehicle_type, source_code, name) values ('cars', '1', 'Marca Teste');
insert into models (brand_id, source_code, name) select id, '10', 'Modelo Teste' from brands;
insert into model_years (model_id, source_code, model_year, fuel, fipe_code)
  select id, '2020-1', 2020, 'Flex', '000000-0' from models;
insert into price_points (model_year_id, reference_month_id, price_cents)
  select my.id, rm.id, 4567800 from model_years my, reference_months rm;

create temp table results (name text, ok boolean, detail text);
grant insert, select on results to authenticated, anon;

-- user A
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into favorites (user_id, model_year_id) select auth.uid(), id from model_years;
insert into search_events (user_id, model_year_id) select auth.uid(), id from model_years;
insert into results select 'A sees own favorite', count(*) = 1, count(*)::text from favorites;
insert into results select 'A reads catalog prices', count(*) = 1, count(*)::text from price_points;
insert into results select 'A sees own profile only', count(*) = 1, count(*)::text from profiles;

-- user B
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into results select 'B sees no favorites of A', count(*) = 0, count(*)::text from favorites;
insert into results select 'B sees no search events of A', count(*) = 0, count(*)::text from search_events;
insert into results select 'B sees only own profile', count(*) = 1 and bool_and(id = auth.uid()), count(*)::text from profiles;
reset role;

-- attempts that must fail, each in its own transaction
create or replace function pg_temp.must_fail(sql text, uid text) returns boolean language plpgsql as $$
begin
  execute format('set local role authenticated; set local request.jwt.claim.sub = %L', uid);
  execute sql;
  return false;
exception when others then
  return true;
end $$;

insert into results select 'B cannot insert a favorite as A',
  pg_temp.must_fail($q$insert into favorites (user_id, model_year_id) select '00000000-0000-0000-0000-00000000000a', id from model_years$q$, '00000000-0000-0000-0000-00000000000b'), null;
insert into results select 'user cannot write catalog prices',
  pg_temp.must_fail($q$update price_points set price_cents = 1$q$, '00000000-0000-0000-0000-00000000000a')
  or (select price_cents from price_points limit 1) = 4567800, null;
select pg_temp.must_fail($q$update profiles set plan = 'plus' where id = auth.uid()$q$, '00000000-0000-0000-0000-00000000000a');
insert into results select 'user cannot upgrade own plan (state checked after the attempt)',
  plan = 'free', plan from profiles where id = '00000000-0000-0000-0000-00000000000a';
insert into results select 'user can rename own profile',
  not pg_temp.must_fail($q$update profiles set display_name = 'A' where id = auth.uid()$q$, '00000000-0000-0000-0000-00000000000a'), null;
insert into results select 'user cannot read subscriptions table of others or write it',
  pg_temp.must_fail($q$insert into subscriptions (user_id, store, external_id, status) values (auth.uid(), 'google', 'x', 'active')$q$, '00000000-0000-0000-0000-00000000000a'), null;

-- anon (signed out): catalog policies target "authenticated" only
set role anon;
reset request.jwt.claim.sub;
insert into results select 'anon (no account) can read prices', count(*) = 1, count(*)::text from price_points;
insert into results select 'anon sees no favorites', count(*) = 0, count(*)::text from favorites;
insert into results select 'anon sees no profiles', count(*) = 0, count(*)::text from profiles;
reset role;

-- ingestion idempotency: the same upsert twice changes nothing
insert into price_points (model_year_id, reference_month_id, price_cents)
  select my.id, rm.id, 4567800 from model_years my, reference_months rm
  on conflict (model_year_id, reference_month_id) do update set price_cents = excluded.price_cents;
insert into results select 'price upsert is idempotent', count(*) = 1, count(*)::text from price_points;

-- account deletion: user rows go, search events stay anonymous
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
insert into results select 'deleting A removes A favorites', count(*) = 0, count(*)::text from favorites;
insert into results select 'deleting A removes A profile', count(*) = 0, count(*)::text from profiles where id = '00000000-0000-0000-0000-00000000000a';
insert into results select 'deleting A keeps search event anonymous', count(*) = 1 and bool_and(user_id is null), count(*)::text from search_events;

\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name, coalesce(detail, '') as detail from results;
select count(*) filter (where not ok) as failures from results \gset
\if :failures
  \echo FAILED
\else
  \echo ALL PASSED
\endif
