// Imports the FIPE table into the database: the newest month first, then older months for the price history.
// Resumable: stops cleanly at --max-minutes and continues where it left off on the next run.
// Usage: DATABASE_URL=postgres://... FIPE_API_TOKEN=... node scripts/import-fipe.mts --months 12 --max-minutes 330 --rpm 60 [--budget 900]
import pg from 'pg';
import { createFipeProvider } from '../server/fipe/provider.ts';
import { runIngestion } from '../server/fipe/ingest.ts';
import { createPgStore, throttledFetch } from '../server/fipe/pg-store.ts';

const arg = (name: string, d: number) => { const i = process.argv.indexOf(`--${name}`); const n = i > 0 ? Number(process.argv[i + 1]) : NaN; return Number.isFinite(n) && n > 0 ? n : d; };
const months = arg('months', 12);
const maxMinutes = arg('max-minutes', 330);
const rpm = arg('rpm', Number(process.env.FIPE_REQUESTS_PER_MINUTE) || 60);
// optional cap on requests per run (the free FIPE plan allows about 1,000 a day); 0 or absent = no cap
const maxRequests = arg('budget', Number(process.env.FIPE_REQUESTS_PER_RUN) || Infinity);
let spent = 0;
const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL'); process.exit(2); }

const client = new pg.Client({ connectionString: url, ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false } });
await client.connect();
const store = createPgStore(client);
const provider = createFipeProvider({
  baseUrl: process.env.FIPE_API_URL || undefined,
  token: process.env.FIPE_API_TOKEN || undefined,
  fetchImpl: throttledFetch(rpm),
});
const deadline = Date.now() + maxMinutes * 60_000;

try {
  const refs = (await provider.references()).slice(0, months);
  console.log(`Months to import (newest first): ${refs.map(r => r.month.trim()).join(', ')}`);
  for (const ref of refs) {
    if (await store.monthComplete(ref.code)) { console.log(`= ${ref.month.trim()} already complete`); continue; }
    const minutesLeft = (deadline - Date.now()) / 60_000;
    if (minutesLeft < 2) { console.log('Time limit reached; the next run continues from here.'); break; }
    // a request budget that fits the time left; the job resumes from its checkpoint next time
    const budget = Math.min(Math.floor(minutesLeft * rpm), maxRequests - spent);
    if (budget < 2) { console.log('Request cap reached; the next run continues from here.'); break; }
    console.log(`> ${ref.month.trim()} (budget ${budget} requests)`);
    const r = await runIngestion(provider, store, { referenceCode: ref.code, requestBudget: budget });
    spent += r.requestsUsed;
    console.log(`  ${r.status}: ${r.pricesWritten} prices, ${r.skippedNoPrice} without price, ${r.requestsUsed} requests${r.error ? ` (${r.error})` : ''}`);
    if (r.status === 'succeeded') await store.markMonthComplete(ref.code);
    else { if (r.status === 'failed') process.exitCode = 1; break; }
  }
  const { rows } = await client.query(`select (select count(*) from brands) brands, (select count(*) from model_years) model_years,
    (select count(*) from price_points) prices, (select count(*) from reference_months) months`);
  console.log('Database now has:', rows[0]);
} finally {
  await client.end();
}
