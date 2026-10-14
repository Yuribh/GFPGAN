-- Schema for the FIPE price clone (Postgres on Supabase).
-- Catalog tables are public read, written only by the ingestion job (service role).
-- User tables use row level security: a user sees and writes only their own rows.

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create type vehicle_type as enum ('cars', 'motorcycles', 'trucks');

-- ---------- catalog (from the FIPE data source, refreshed monthly) ----------
create table reference_months (
  id uuid primary key default gen_random_uuid(),
  source_code integer not null unique,          -- code the data source uses for the month
  year smallint not null check (year between 2000 and 2100),
  month smallint not null check (month between 1 and 12),
  published_at timestamptz,                     -- when we first saw it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  vehicle_type vehicle_type not null,
  source_code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_type, source_code)
);
create index on brands (vehicle_type, name);

create table models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  source_code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, source_code)
);
create index on models (brand_id, name);

-- one row per model + model year + fuel (the source id looks like "2020-1")
create table model_years (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references models(id) on delete cascade,
  source_code text not null,
  model_year smallint not null,                 -- 32000 in the source means "zero km"
  fuel text not null,
  fipe_code text not null,                      -- the FIPE code, shared across years of a model
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, source_code)
);
create index on model_years (fipe_code);
create index on model_years (model_id, model_year);

-- price per model_year per month. Money as integer cents plus currency.
create table price_points (
  id uuid primary key default gen_random_uuid(),
  model_year_id uuid not null references model_years(id) on delete cascade,
  reference_month_id uuid not null references reference_months(id) on delete cascade,
  price_cents bigint not null check (price_cents >= 0),
  currency char(3) not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_year_id, reference_month_id)    -- makes ingestion idempotent
);
create index on price_points (reference_month_id);
create index on price_points (model_year_id, reference_month_id desc);

-- optional technical sheet (only if you find a source you may use)
create table technical_sheets (
  id uuid primary key default gen_random_uuid(),
  model_year_id uuid not null unique references model_years(id) on delete cascade,
  specs jsonb not null default '{}',
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  reference_month_id uuid references reference_months(id) on delete set null,
  status text not null default 'running'
    check (status in ('running','succeeded','failed')),
  rows_written integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on ingestion_runs (started_at desc);

-- ---------- users ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan text not null default 'free' check (plan in ('free','plus')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_year_id uuid not null references model_years(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, model_year_id)
);
create index on favorites (user_id, created_at desc);
create index on favorites (model_year_id);      -- used by the alert job

create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,                   -- Expo push token
  platform text not null check (platform in ('ios','android')),
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on device_tokens (user_id);

-- feeds both "search history" and "most searched" ranking
create table search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,   -- kept anonymous after account deletion
  model_year_id uuid not null references model_years(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on search_events (user_id, created_at desc);
create index on search_events (model_year_id, created_at desc);

create materialized view popular_vehicles as
  select model_year_id, count(*) as searches
  from search_events
  where created_at > now() - interval '30 days'
  group by model_year_id;
create unique index on popular_vehicles (model_year_id);

-- store billing mirror, written by the RevenueCat webhook (service role only)
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store text not null check (store in ('apple','google')),
  external_id text not null,                    -- original transaction id
  status text not null check (status in ('active','grace','expired','cancelled')),
  renews_at timestamptz,
  last_event_id text,                           -- for webhook idempotency
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store, external_id)
);
create index on subscriptions (user_id);

-- notification dedupe: one alert per user per month
create table alert_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_month_id uuid not null references reference_months(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (user_id, reference_month_id)
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  for t in select unnest(array[
    'reference_months','brands','models','model_years','price_points',
    'technical_sheets','profiles','favorites','device_tokens','subscriptions'])
  loop
    execute format(
      'create trigger %I_updated_at before update on %I
       for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- access rules (row level security) ----------
alter table reference_months  enable row level security;
alter table brands            enable row level security;
alter table models            enable row level security;
alter table model_years       enable row level security;
alter table price_points      enable row level security;
alter table technical_sheets  enable row level security;
alter table ingestion_runs    enable row level security;   -- no policy: service role only
alter table profiles          enable row level security;
alter table favorites         enable row level security;
alter table device_tokens     enable row level security;
alter table search_events     enable row level security;
alter table subscriptions     enable row level security;
alter table alert_log         enable row level security;   -- no policy: service role only

-- catalog: anyone signed in can read, nobody writes from the app
create policy catalog_read on reference_months for select to authenticated using (true);
create policy catalog_read on brands           for select to authenticated using (true);
create policy catalog_read on models           for select to authenticated using (true);
create policy catalog_read on model_years      for select to authenticated using (true);
create policy catalog_read on price_points    for select to authenticated using (true);
create policy catalog_read on technical_sheets for select to authenticated using (true);

-- user tables: own rows only
create policy own_profile_read   on profiles for select to authenticated using (id = auth.uid());
create policy own_profile_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and plan = (select plan from profiles where id = auth.uid()));
  -- plan can only change through the billing webhook, never from the app

create policy own_favorites on favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_tokens on device_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_search_read   on search_events for select to authenticated using (user_id = auth.uid());
create policy own_search_insert on search_events for insert to authenticated with check (user_id = auth.uid());
create policy own_subscription_read on subscriptions for select to authenticated using (user_id = auth.uid());

-- create a profile row on sign up
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
