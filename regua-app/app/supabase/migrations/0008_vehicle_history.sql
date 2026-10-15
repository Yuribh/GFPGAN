-- Paid vehicle history reports (Edge Function vehicle-history). Service role only: RLS on, no policies, no grants.
-- Plates are stored only as HMAC(pepper, plate), same as the plate lookup (0006).
create table history_cache (
  plate_hash text primary key check (plate_hash ~ '^[0-9a-f]{64}$'),
  report jsonb not null,
  fetched_at timestamptz not null default now()
);
-- one row per store purchase spent; a purchase can be re-downloaded for the same plate, never used for another
create table history_purchases (
  transaction_id text primary key check (char_length(transaction_id) between 4 and 200),
  plate_hash text not null check (plate_hash ~ '^[0-9a-f]{64}$'),
  used_at timestamptz not null default now()
);
alter table history_cache enable row level security;
alter table history_purchases enable row level security;
revoke all on history_cache, history_purchases from anon, authenticated;

create function claim_history_purchase(p_transaction_id text, p_plate_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  insert into history_purchases (transaction_id, plate_hash) values (p_transaction_id, p_plate_hash)
    on conflict (transaction_id) do nothing;
  if found then return 'new'; end if;
  select plate_hash into v_hash from history_purchases where transaction_id = p_transaction_id;
  return case when v_hash = p_plate_hash then 'same' else 'other' end;
end $$;
revoke execute on function claim_history_purchase(text, text) from public, anon, authenticated;

create function prune_history_cache() returns void language sql security definer set search_path = public as $$
  delete from history_cache where fetched_at < now() - interval '7 days';
$$;
revoke execute on function prune_history_cache() from public, anon, authenticated;
