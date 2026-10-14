-- Plate lookup (Edge Function plate-lookup). The provider charges per query, so results are cached and usage is capped.
-- Plates are never stored in clear: plate_hash is an HMAC with a server-side secret (PLATE_HASH_PEPPER).
-- Only the service role (the Edge Function) touches these tables: RLS on, no policies, no grants to the app.

create table plate_cache (
  plate_hash text primary key check (plate_hash ~ '^[0-9a-f]{64}$'),
  vehicle jsonb not null,
  fetched_at timestamptz not null default now()
);

-- per device per day; install_id is a random id the app creates on first use (no link to a person)
create table plate_usage (
  install_id uuid not null,
  day date not null,
  lookups integer not null default 0,
  primary key (install_id, day)
);

-- what was actually paid for each day (calls that reached the provider budget)
create table plate_budget (
  day date primary key,
  lookups integer not null default 0
);

alter table plate_cache enable row level security;
alter table plate_usage enable row level security;
alter table plate_budget enable row level security;
revoke all on plate_cache, plate_usage, plate_budget from anon, authenticated;

-- Atomic: counts one lookup for the device unless it is over its limit; then reserves one unit of the day's budget.
-- 'device_limit' = this device is done for today; 'global_limit' = budget spent (cached plates can still be served).
create function take_plate_quota(p_install_id uuid, p_device_limit integer, p_global_limit integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_count integer;
begin
  insert into plate_usage as u (install_id, day, lookups) values (p_install_id, v_day, 1)
    on conflict (install_id, day) do update set lookups = u.lookups + 1
    where u.lookups < p_device_limit
    returning lookups into v_count;
  if v_count is null then return 'device_limit'; end if;

  insert into plate_budget as b (day, lookups) values (v_day, 1)
    on conflict (day) do update set lookups = b.lookups + 1
    where b.lookups < p_global_limit
    returning lookups into v_count;
  if v_count is null or v_count > p_global_limit then return 'global_limit'; end if;
  return 'ok';
end $$;
revoke execute on function take_plate_quota(uuid, integer, integer) from public, anon, authenticated;

-- daily cleanup: usage rows older than 7 days, cached plates older than 90 days
create function prune_plate_data() returns void language sql security definer set search_path = public as $$
  delete from plate_usage where day < current_date - 7;
  delete from plate_budget where day < current_date - 400;
  delete from plate_cache where fetched_at < now() - interval '90 days';
$$;
revoke execute on function prune_plate_data() from public, anon, authenticated;
