-- Schedules the monthly FIPE import. Run ONCE in the Supabase SQL editor after deploying the ingest-fipe function.
-- Not a migration: it holds your project URL and secret. Replace the two <...> values before running.
-- Needs the pg_cron and pg_net extensions (Database > Extensions in the dashboard, or the two lines below).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- every 10 minutes on days 1 to 12 of each month: each call imports one slice and resumes from its checkpoint
select cron.schedule('ingest-fipe', '*/10 * 1-12 * *', $$
  select net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/ingest-fipe',
    headers := jsonb_build_object('Authorization', 'Bearer <INGEST_CRON_SECRET>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);

-- monthly cleanup of usage counts older than a year (migration 0005)
select cron.schedule('prune-app-events', '0 4 15 * *', $$ select prune_app_events(); $$);

-- daily cleanup of plate lookup data: device counters after 7 days, cached plates after 90 (migration 0006)
select cron.schedule('prune-plate-data', '30 4 * * *', $$ select prune_plate_data(); $$);

-- daily cleanup of advisor counters (migration 0007)
select cron.schedule('prune-feature-usage', '40 4 * * *', $$ select prune_feature_usage(); $$);

-- daily cleanup of cached history reports older than 7 days (migration 0008)
select cron.schedule('prune-history-cache', '50 4 * * *', $$ select prune_history_cache(); $$);

-- to check: select * from cron.job_run_details order by start_time desc limit 20;
-- to stop:  select cron.unschedule('ingest-fipe');
