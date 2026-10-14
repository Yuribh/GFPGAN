-- Anonymous usage counts for the launch metrics (lookups per day, share of sessions that reach a price).
-- No user id, no device id, no IP: only the event name, a random per-launch session id, platform and app version.
-- The app (anon key) may insert rows but never read, change or delete them; the owner reads them in the dashboard.
create table app_events (
  id bigint generated always as identity primary key,
  event text not null check (event in ('app_open', 'lookup_started', 'price_viewed', 'favorite_added', 'share', 'plus_viewed', 'plus_purchased', 'plate_lookup', 'plate_found')),
  session_id uuid not null,
  platform text not null check (platform in ('android', 'ios', 'web')),
  app_version text not null check (char_length(app_version) <= 32),
  created_at timestamptz not null default now()
);
create index app_events_created_at on app_events (created_at);
alter table app_events enable row level security;

grant insert on app_events to anon, authenticated;
create policy app_events_insert on app_events for insert to anon, authenticated with check (true);
-- no select/update/delete policy: with RLS on, those are denied to the app

-- Daily numbers for the launch plan. Read with the service role (dashboard), not exposed to the app.
create view app_daily_metrics with (security_invoker = true) as
select
  date_trunc('day', created_at at time zone 'America/Sao_Paulo')::date as day,
  count(*) filter (where event = 'price_viewed') as prices_viewed,
  count(distinct session_id) as sessions,
  count(distinct session_id) filter (where event = 'price_viewed') as sessions_with_price,
  round(100.0 * count(distinct session_id) filter (where event = 'price_viewed') / nullif(count(distinct session_id), 0), 1) as pct_sessions_with_price,
  count(*) filter (where event = 'plus_purchased') as plus_purchases
from app_events
group by 1
order by 1 desc;
revoke all on app_daily_metrics from anon, authenticated;

-- keep one year of rows (run monthly from the scheduler, or by hand)
create function prune_app_events() returns void language sql security definer set search_path = public as
  $$ delete from app_events where created_at < now() - interval '1 year' $$;
revoke execute on function prune_app_events() from public, anon, authenticated;
