-- Generic daily limits for paid features (first user: the advisor, which calls a paid AI API).
-- Same rules as take_plate_quota (0006): per install per day, plus a global daily budget. Service role only.
create table feature_usage (
  feature text not null check (feature ~ '^[a-z_]{1,32}$'),
  install_id uuid not null,
  day date not null,
  uses integer not null default 0,
  primary key (feature, install_id, day)
);
create table feature_budget (
  feature text not null check (feature ~ '^[a-z_]{1,32}$'),
  day date not null,
  uses integer not null default 0,
  primary key (feature, day)
);
alter table feature_usage enable row level security;
alter table feature_budget enable row level security;
revoke all on feature_usage, feature_budget from anon, authenticated;

create function take_feature_quota(p_feature text, p_install_id uuid, p_device_limit integer, p_global_limit integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_count integer;
begin
  insert into feature_usage as u (feature, install_id, day, uses) values (p_feature, p_install_id, v_day, 1)
    on conflict (feature, install_id, day) do update set uses = u.uses + 1
    where u.uses < p_device_limit
    returning uses into v_count;
  if v_count is null then return 'device_limit'; end if;

  insert into feature_budget as b (feature, day, uses) values (p_feature, v_day, 1)
    on conflict (feature, day) do update set uses = b.uses + 1
    where b.uses < p_global_limit
    returning uses into v_count;
  if v_count is null then return 'global_limit'; end if;
  return 'ok';
end $$;
revoke execute on function take_feature_quota(text, uuid, integer, integer) from public, anon, authenticated;

create function prune_feature_usage() returns void language sql security definer set search_path = public as $$
  delete from feature_usage where day < current_date - 7;
  delete from feature_budget where day < current_date - 400;
$$;
revoke execute on function prune_feature_usage() from public, anon, authenticated;
