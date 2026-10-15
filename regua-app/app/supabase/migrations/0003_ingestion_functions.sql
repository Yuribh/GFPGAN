-- Write path for the monthly FIPE ingestion job. Called through Supabase RPC with the service role only.
-- Every function is an upsert on the table's unique key, so a run can repeat without duplicating rows.

create table ingestion_checkpoints (
  reference_code integer not null,
  key text not null,                         -- "type|brand|model" or "type|brand|*"
  created_at timestamptz not null default now(),
  primary key (reference_code, key)
);
alter table ingestion_checkpoints enable row level security;   -- no policies: service role only

create or replace function ingest_reference_month(p_source_code integer, p_year smallint, p_month smallint)
returns uuid language sql as $$
  insert into reference_months (source_code, year, month, published_at)
  values (p_source_code, p_year, p_month, now())
  on conflict (source_code) do update set year = excluded.year, month = excluded.month
  returning id
$$;

create or replace function ingest_brand(p_type vehicle_type, p_source_code text, p_name text)
returns uuid language sql as $$
  insert into brands (vehicle_type, source_code, name) values (p_type, p_source_code, p_name)
  on conflict (vehicle_type, source_code) do update set name = excluded.name
  returning id
$$;

create or replace function ingest_model(p_brand_id uuid, p_source_code text, p_name text)
returns uuid language sql as $$
  insert into models (brand_id, source_code, name) values (p_brand_id, p_source_code, p_name)
  on conflict (brand_id, source_code) do update set name = excluded.name
  returning id
$$;

create or replace function ingest_model_year(p_model_id uuid, p_source_code text, p_model_year smallint, p_fuel text, p_fipe_code text)
returns uuid language sql as $$
  insert into model_years (model_id, source_code, model_year, fuel, fipe_code)
  values (p_model_id, p_source_code, p_model_year, p_fuel, p_fipe_code)
  on conflict (model_id, source_code) do update
    set model_year = excluded.model_year, fuel = excluded.fuel, fipe_code = excluded.fipe_code
  returning id
$$;

create or replace function ingest_price_point(p_model_year_id uuid, p_reference_month_id uuid, p_price_cents bigint)
returns void language sql as $$
  insert into price_points (model_year_id, reference_month_id, price_cents)
  values (p_model_year_id, p_reference_month_id, p_price_cents)
  on conflict (model_year_id, reference_month_id) do update set price_cents = excluded.price_cents
$$;

-- only the service role may call these; the app's users never can
revoke execute on function
  ingest_reference_month(integer, smallint, smallint), ingest_brand(vehicle_type, text, text),
  ingest_model(uuid, text, text), ingest_model_year(uuid, text, smallint, text, text),
  ingest_price_point(uuid, uuid, bigint)
  from public, anon, authenticated;
