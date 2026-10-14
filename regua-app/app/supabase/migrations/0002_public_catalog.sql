-- Fix from replica-entrepreneur: price lookup must work without an account.
-- The catalog is public reference data, so signed-out users (anon) may read it.
-- Nothing else changes: user tables stay own-rows-only, and nobody writes the catalog from the app.
create policy catalog_read_anon on reference_months  for select to anon using (true);
create policy catalog_read_anon on brands            for select to anon using (true);
create policy catalog_read_anon on models            for select to anon using (true);
create policy catalog_read_anon on model_years       for select to anon using (true);
create policy catalog_read_anon on price_points      for select to anon using (true);
create policy catalog_read_anon on technical_sheets  for select to anon using (true);
