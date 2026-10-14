\set QUIET 1
create temp table results (name text, ok boolean, detail text);
grant insert, select on results to authenticated, anon;

-- run the same writes twice
do $$
declare rm uuid; b uuid; m uuid; y uuid; i int;
begin
  for i in 1..2 loop
    rm := ingest_reference_month(330, 2026::smallint, 10::smallint);
    b  := ingest_brand('cars', '1', 'Marca Um');
    m  := ingest_model(b, '10', 'Modelo A');
    y  := ingest_model_year(m, '2020-1', 2020::smallint, 'Gasolina', '000001-1');
    perform ingest_price_point(y, rm, 4567800 + i);   -- second run carries a corrected price
  end loop;
end $$;
insert into results select 'ingest twice: one month', count(*) = 1, count(*)::text from reference_months;
insert into results select 'ingest twice: one brand', count(*) = 1, count(*)::text from brands;
insert into results select 'ingest twice: one model year', count(*) = 1, count(*)::text from model_years;
insert into results select 'ingest twice: one price, latest value kept', count(*) = 1 and max(price_cents) = 4567802, max(price_cents)::text from price_points;

-- the app's roles must not hold EXECUTE on any write function (checked directly, not by provoking an error,
-- because row level security raises the same error code and would hide a missing revoke)
insert into results
select 'no execute for ' || r || ' on ' || f, not has_function_privilege(r, f, 'execute'), null
from unnest(array['anon','authenticated']) r,
     unnest(array['ingest_reference_month(integer,smallint,smallint)','ingest_brand(vehicle_type,text,text)',
                  'ingest_model(uuid,text,text)','ingest_model_year(uuid,text,smallint,text,text)',
                  'ingest_price_point(uuid,uuid,bigint)']) f;
insert into results select 'no brand was written by the user', count(*) = 0, count(*)::text from brands where name = 'Invasor';

\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name, coalesce(detail, '') as detail from results;
select count(*) filter (where not ok) as failures from results \gset
\if :failures
  \echo FAILED
\else
  \echo ALL PASSED
\endif
