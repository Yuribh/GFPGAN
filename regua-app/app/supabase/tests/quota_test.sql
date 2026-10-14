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

insert into results select 'advisor 1 ok', take_feature_quota('advisor', '00000000-0000-4000-8000-0000000000a1', 2, 3) = 'ok', null;
insert into results select 'advisor 2 ok', take_feature_quota('advisor', '00000000-0000-4000-8000-0000000000a1', 2, 3) = 'ok', null;
insert into results select 'advisor 3 hits device limit', take_feature_quota('advisor', '00000000-0000-4000-8000-0000000000a1', 2, 3) = 'device_limit', null;
insert into results select 'other feature has its own count', take_feature_quota('other', '00000000-0000-4000-8000-0000000000a1', 2, 3) = 'ok', null;
insert into results select 'second device ok', take_feature_quota('advisor', '00000000-0000-4000-8000-0000000000a2', 2, 3) = 'ok', null;
insert into results select 'global budget spent', take_feature_quota('advisor', '00000000-0000-4000-8000-0000000000a3', 2, 3) = 'global_limit', null;
insert into results select 'budget never exceeds the cap', uses = 3, uses::text from feature_budget where feature = 'advisor';
do $$ begin
  perform take_feature_quota('Bad Name!', '00000000-0000-4000-8000-0000000000a9', 2, 3);
  insert into pg_temp.results values ('invalid feature name is refused', false, 'accepted');
exception when check_violation then
  insert into pg_temp.results values ('invalid feature name is refused', true, null);
end $$;
insert into results select 'anon cannot call take_feature_quota',
  pg_temp.anon_fails($q$select take_feature_quota('advisor', '00000000-0000-4000-8000-0000000000a9', 99, 99)$q$), null;

\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name, coalesce(detail, '') as detail from results;
select count(*) filter (where not ok) > 0 as failures from results \gset
\if :failures
  \echo FAILED
\else
  \echo ALL PASSED
\endif
