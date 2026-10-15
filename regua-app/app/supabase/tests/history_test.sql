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
create or replace function pg_temp.anon_count(sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'set local role anon';
  execute sql into n;
  return n;
exception when others then
  return 0;
end $$;

insert into results select 'first claim is new', claim_history_purchase('GPA.1', repeat('a', 64)) = 'new', null;
insert into results select 'same plate again is a re-download', claim_history_purchase('GPA.1', repeat('a', 64)) = 'same', null;
insert into results select 'another plate is refused', claim_history_purchase('GPA.1', repeat('b', 64)) = 'other', null;
insert into results select 'one row per purchase', count(*) = 1, count(*)::text from history_purchases;
insert into results select 'anon cannot claim', pg_temp.anon_fails($q$select claim_history_purchase('GPA.2', repeat('c', 64))$q$), null;
insert into results select 'anon reads no purchases', pg_temp.anon_count($q$select count(*) from history_purchases$q$) = 0, null;
insert into results select 'anon reads no reports', pg_temp.anon_count($q$select count(*) from history_cache$q$) = 0, null;
insert into history_cache (plate_hash, report, fetched_at) values (repeat('d', 64), '{}', now() - interval '8 days'), (repeat('e', 64), '{}', now());
select prune_history_cache();
insert into results select 'prune keeps 7 days', count(*) = 1, count(*)::text from history_cache;

\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name, coalesce(detail, '') as detail from results;
select count(*) filter (where not ok) > 0 as failures from results \gset
\if :failures
  \echo FAILED
\else
  \echo ALL PASSED
\endif
