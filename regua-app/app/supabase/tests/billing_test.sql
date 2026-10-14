\set QUIET 1
create temp table results (name text, ok boolean, detail text);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'c@example.test');
create temp table r (step text, outcome text);

insert into r select 'buy',     apply_billing_event('00000000-0000-0000-0000-0000000000c1', 'google', 'GPA.1', 'active',    now() + interval '30 days', 'ev1', now() - interval '3 hours');
insert into results select 'purchase gives plus', plan = 'plus', plan from profiles where id = '00000000-0000-0000-0000-0000000000c1';
insert into r select 'buy again', apply_billing_event('00000000-0000-0000-0000-0000000000c1', 'google', 'GPA.1', 'active',    now() + interval '30 days', 'ev1', now() - interval '3 hours');
insert into results select 'same event twice is a duplicate', outcome = 'duplicate', outcome from r where step = 'buy again';
insert into r select 'cancel',  apply_billing_event('00000000-0000-0000-0000-0000000000c1', 'google', 'GPA.1', 'cancelled', now() + interval '30 days', 'ev2', now() - interval '2 hours');
insert into results select 'cancel keeps plus until the period ends', plan = 'plus', plan from profiles where id = '00000000-0000-0000-0000-0000000000c1';
insert into r select 'late retry of purchase', apply_billing_event('00000000-0000-0000-0000-0000000000c1', 'google', 'GPA.1', 'active', now() + interval '30 days', 'ev0', now() - interval '5 hours');
insert into results select 'an older event arriving late is ignored', outcome = 'stale', outcome from r where step = 'late retry of purchase';
insert into results select 'status still cancelled after the stale event', status = 'cancelled', status from subscriptions where external_id = 'GPA.1';
insert into r select 'expire',  apply_billing_event('00000000-0000-0000-0000-0000000000c1', 'google', 'GPA.1', 'expired',   now() - interval '1 minute', 'ev3', now() - interval '1 hour');
insert into results select 'expiration moves to free', plan = 'free', plan from profiles where id = '00000000-0000-0000-0000-0000000000c1';
insert into results select 'one subscription row', count(*) = 1, count(*)::text from subscriptions;
insert into results select 'no execute for ' || r, not has_function_privilege(r, 'apply_billing_event(uuid,text,text,text,timestamptz,text,timestamptz)', 'execute'), null
  from unnest(array['anon','authenticated']) r;

\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name, coalesce(detail, '') as detail from results;
select count(*) filter (where not ok) > 0 as failures from results \gset
\if :failures
  \echo FAILED
\else
  \echo ALL PASSED
\endif
