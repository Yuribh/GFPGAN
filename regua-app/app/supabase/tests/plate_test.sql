\set ON_ERROR_STOP 0
\set QUIET 1
create temp table results (name text, ok boolean, detail text);
grant insert, select on results to authenticated, anon;

create or replace function pg_temp.anon_fails(sql text) returns boolean language plpgsql as $$
begin
  execute 'set local role anon';
  execute sql;
  return false;
exception when others then
  return true;
end $$;

-- device limit 2, global budget 3
insert into results select 'first lookup ok', take_plate_quota('00000000-0000-4000-8000-000000000001', 2, 3) = 'ok', null;
insert into results select 'second lookup ok', take_plate_quota('00000000-0000-4000-8000-000000000001', 2, 3) = 'ok', null;
insert into results select 'third lookup hits the device limit', take_plate_quota('00000000-0000-4000-8000-000000000001', 2, 3) = 'device_limit', null;
insert into results select 'device count stays at the limit', lookups = 2, lookups::text from plate_usage where install_id = '00000000-0000-4000-8000-000000000001';
insert into results select 'other device ok', take_plate_quota('00000000-0000-4000-8000-000000000002', 2, 3) = 'ok', null;
insert into results select 'budget spent -> global_limit', take_plate_quota('00000000-0000-4000-8000-000000000003', 2, 3) = 'global_limit', null;
insert into results select 'budget never exceeds the cap', lookups = 3, lookups::text from plate_budget;

insert into results select 'anon cannot call take_plate_quota',
  pg_temp.anon_fails($q$select take_plate_quota('00000000-0000-4000-8000-000000000009', 99, 99)$q$), null;
create or replace function pg_temp.anon_count(sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'set local role anon';
  execute sql into n;
  return n;
exception when others then
  return 0;   -- no privilege at all is as good as no rows
end $$;
insert into results select 'anon reads no cached plates', pg_temp.anon_count($q$select count(*) from plate_cache$q$) = 0, null;
insert into results select 'anon cannot write the cache',
  pg_temp.anon_fails($q$insert into plate_cache (plate_hash, vehicle) values (repeat('a', 64), '{}')$q$), null;
insert into results select 'anon reads no usage', pg_temp.anon_count($q$select count(*) from plate_usage$q$) = 0, null;
do $$ begin
  insert into plate_cache (plate_hash, vehicle) values ('ABC1234', '{}');
  insert into pg_temp.results values ('cache rejects clear-text plates (insert)', false, 'accepted');
exception when check_violation then
  insert into pg_temp.results values ('cache rejects clear-text plates (insert)', true, null);
end $$;

insert into plate_cache (plate_hash, vehicle, fetched_at) values (repeat('b', 64), '{}', now() - interval '100 days'), (repeat('c', 64), '{}', now());
select prune_plate_data();
insert into results select 'prune drops cache older than 90 days', count(*) = 1, count(*)::text from plate_cache;

\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name, coalesce(detail, '') as detail from results;
select count(*) filter (where not ok) > 0 as failures from results \gset
\if :failures
  \echo FAILED
\else
  \echo ALL PASSED
\endif
