// Reads imported prices through PostgREST with the app's own repository (src/data/supabase.ts), like the phone does.
// Usage: DATABASE_URL=... PGRST_URL=http://127.0.0.1:3000 ANON_KEY=<jwt> node scripts/smoke-read.mts
import pg from 'pg';
import { createSupabaseRepository } from '../src/data/supabase.ts';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query('select model_year_id from (select distinct model_year_id from price_points) t order by random() limit 3');
await db.end();
if (!rows.length) { console.error('FAIL: no prices were imported'); process.exit(1); }

// the app calls <supabase>/rest/v1/...; plain PostgREST serves the same paths at its root
const base = process.env.PGRST_URL!.replace(/\/$/, '');
const fetchImpl = ((u: string, init?: RequestInit) => fetch(u.replace('http://supabase.local/rest/v1', base), init)) as typeof fetch;
const repo = createSupabaseRepository({ url: 'http://supabase.local', anonKey: process.env.ANON_KEY!, fetchImpl });

let failures = 0;
const brands = await repo.listBrands('cars');
console.log(`brands (cars): ${brands.length}, first: ${brands[0]?.name}`);
if (!brands.length) failures++;
for (const r of rows) {
  const v = await repo.getVehicle(String(r.model_year_id));
  if (!v || v.latest.priceCents <= 0 || !v.brand.name || !v.model.name || !/^\d{6}-\d$/.test(v.year.fipeCode)) { failures++; console.log('FAIL', r.model_year_id, v); continue; }
  console.log(`OK  ${v.brand.name} ${v.model.name} ${v.year.modelYear} ${v.year.fuel} FIPE ${v.year.fipeCode}: R$ ${(v.latest.priceCents / 100).toFixed(2)} (${v.latest.referenceMonth})`);
  const models = await repo.listModels(v.brand.id);
  const years = await repo.listYears(v.model.id);
  if (!models.some(m => m.id === v.model.id) || !years.some(y => y.id === v.year.id)) { failures++; console.log('FAIL listing does not contain the vehicle'); }
}
// the public key must not write the catalog
const write = await fetch(`${base}/brands`, { method: 'POST', headers: { authorization: `Bearer ${process.env.ANON_KEY}`, 'content-type': 'application/json' }, body: '{"vehicle_type":"cars","source_code":"x","name":"x"}' });
console.log(`anon write attempt -> HTTP ${write.status}`);
if (write.ok) failures++;
console.log(failures ? `\n${failures} failures` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
