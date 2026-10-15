-- Billing webhook write path. Called only by the billing-webhook Edge Function (service role).
-- Idempotent: the same event twice is a no-op. Ordered: an event older than the last one applied is ignored
-- (RevenueCat retries for hours, so a late retry must not undo a newer state).
alter table subscriptions add column last_event_at timestamptz;

create or replace function apply_billing_event(
  p_user_id uuid, p_store text, p_external_id text, p_status text,
  p_renews_at timestamptz, p_event_id text, p_event_at timestamptz
) returns text language plpgsql as $$
declare cur subscriptions%rowtype; has_access boolean;
begin
  select * into cur from subscriptions where store = p_store and external_id = p_external_id for update;
  if found and cur.last_event_id = p_event_id then return 'duplicate'; end if;
  if found and cur.last_event_at is not null and cur.last_event_at > p_event_at then return 'stale'; end if;

  insert into subscriptions (user_id, store, external_id, status, renews_at, last_event_id, last_event_at)
  values (p_user_id, p_store, p_external_id, p_status, p_renews_at, p_event_id, p_event_at)
  on conflict (store, external_id) do update set
    user_id = excluded.user_id, status = excluded.status, renews_at = excluded.renews_at,
    last_event_id = excluded.last_event_id, last_event_at = excluded.last_event_at;

  -- access: anything but expired, as long as the paid period has not ended
  has_access := exists (
    select 1 from subscriptions
    where user_id = p_user_id and status <> 'expired' and (renews_at is null or renews_at > now()));
  update profiles set plan = case when has_access then 'plus' else 'free' end where id = p_user_id;
  return 'applied';
end $$;

revoke execute on function apply_billing_event(uuid, text, text, text, timestamptz, text, timestamptz)
  from public, anon, authenticated;
