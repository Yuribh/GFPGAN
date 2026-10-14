// Applies supabase/migrations/*.sql in order, once each, on the database in DATABASE_URL (Supabase: Project Settings >
// Database > Connection string, "Session pooler" URI). Records what ran in public.regua_migrations.
// Usage: DATABASE_URL=postgres://... node scripts/migrate.mts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const dir = join(import.meta.dirname, '..', 'supabase', 'migrations');
const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL'); process.exit(2); }

const client = new pg.Client({ connectionString: url, ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('create table if not exists public.regua_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await client.query('select name from public.regua_migrations')).rows.map(r => r.name));
  const files = readdirSync(dir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();
  for (const f of files) {
    if (done.has(f)) { console.log(`= ${f}`); continue; }
    await client.query('begin');
    try {
      await client.query(readFileSync(join(dir, f), 'utf8'));
      await client.query('insert into public.regua_migrations (name) values ($1)', [f]);
      await client.query('commit');
      console.log(`+ ${f}`);
    } catch (e) {
      await client.query('rollback');
      console.error(`! ${f}: ${(e as Error).message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
