// Reads the real FIPE table the way the app does without Supabase: brands, models, years and the price with history.
// Usage: node scripts/smoke-live.mts   (needs internet access to the FIPE API)
import { createLiveRepository } from '../src/data/live.ts';

const repo = createLiveRepository();
const brands = await repo.listBrands('cars');
const toyota = brands.find(b => b.name === 'Toyota');
console.log(`car brands: ${brands.length}`);
if (!toyota) throw new Error('Toyota not in the brand list');
const models = await repo.listModels(toyota.id);
const corolla = models.find(m => m.id.endsWith(':9984')) ?? models[0];
console.log(`Toyota models: ${models.length}; using ${corolla.name}`);
const years = await repo.listYears(corolla.id);
console.log(`years: ${years.map(y => `${y.modelYear} ${y.fuel}`).join(', ')}`);
const v = await repo.getVehicle(years[0].id);
if (!v) throw new Error('no price');
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
console.log(`${v.brand.name} ${v.model.name} ${v.year.modelYear} (FIPE ${v.year.fipeCode}): ${brl(v.latest.priceCents)} in ${v.latest.referenceMonth}`);
console.log(`history: ${v.history.map(p => `${p.referenceMonth} ${brl(p.priceCents)}`).join(' | ')}`);
if (!(v.latest.priceCents > 0) || !/^\d{6}-\d$/.test(v.year.fipeCode)) throw new Error('unexpected answer');
// plate lookups find the vehicle by its FIPE code
const byCode = await repo.matchFipeCodes(['002182-2'], 2025);
console.log(`by FIPE code 002182-2 / 2025: ${JSON.stringify(byCode[0])}`);
const vc = byCode[0] && await repo.getVehicle(byCode[0].modelYearId);
if (!vc || !(vc.latest.priceCents > 0)) throw new Error('FIPE code lookup failed');
console.log(`  price: ${brl(vc.latest.priceCents)} (${vc.latest.referenceMonth}), ${vc.history.length} months`);
for (const t of ['motorcycles', 'trucks'] as const) console.log(`${t} brands: ${(await repo.listBrands(t)).length}`);
