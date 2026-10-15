\set ON_ERROR_STOP 0
\set QUIET 1
create temp table results (name text, ok boolean, detail text);
grant insert, select on results to authenticated, anon;

create or replace function pg_temp.must_fail(sql text) returns boolean language plpgsql as $$
begin
  execute 'set local role anon';
  execute sql;
  return false;
exception when others then
  return true;
end $$;
create or replace function pg_temp.works(sql text) returns boolean language plpgsql as $$
begin
  execute 'set local role anon';
  execute sql;
  return true;
exception when others then
  return false;
end $$;

insert into results select 'anon can insert a valid event',
  pg_temp.works($q$insert into app_events (event, session_id, platform, app_version) values ('price_viewed', gen_random_uuid(), 'android', '0.1.0')$q$), null;
insert into results select 'anon cannot insert an unknown event',
  pg_temp.must_fail($q$insert into app_events (event, session_id, platform, app_version) values ('email', gen_random_uuid(), 'android', '0.1.0')$q$), null;
insert into results select 'anon cannot insert an unknown platform',
  pg_temp.must_fail($q$insert into app_events (event, session_id, platform, app_version) values ('app_open', gen_random_uuid(), 'pc', '0.1.0')$q$), null;
create or replace function pg_temp.anon_count(sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'set local role anon';
  execute sql into n;
  return n;
exception when others then
  return 0;   -- no privilege at all is as good as no rows
end $$;
insert into results select 'anon reads no events', pg_temp.anon_count($q$select count(*) from app_events$q$) = 0, null;
insert into results select 'anon cannot delete events', not pg_temp.works($q$delete from app_events$q$) or (select count(*) from app_events) = 1, null;
insert into results select 'anon reads no metrics', pg_temp.anon_count($q$select count(*) from app_daily_metrics$q$) = 0, null;
insert into results select 'anon cannot prune', pg_temp.must_fail($q$select prune_app_events()$q$), null;

-- metrics: 2 sessions, 1 reached a price
insert into app_events (event, session_id, platform, app_version) values
  ('app_open', '00000000-0000-0000-0000-0000000000e1', 'ios', '0.1.0'),
  ('app_open', '00000000-0000-0000-0000-0000000000e2', 'ios', '0.1.0'),
  ('price_viewed', '00000000-0000-0000-0000-0000000000e2', 'ios', '0.1.0');
insert into results select 'metrics count sessions and prices',
  sessions = 3 and sessions_with_price = 2 and prices_viewed = 2,
  format('sessions=%s with_price=%s prices=%s', sessions, sessions_with_price, prices_viewed)
  from app_daily_metrics limit 1;
select prune_app_events();
insert into results select 'prune keeps recent rows', count(*) = 4, count(*)::text from app_events;

\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name, coalesce(detail, '') as detail from results;
select count(*) filter (where not ok) > 0 as failures from results \gset
\if :failures
  \echo FAILED
\else
  \echo ALL PASSED
\endif
