// Fake data layer. SAMPLE DATA ONLY: brands, models and prices are invented and are NOT real FIPE values.
import type { Brand, FipeRepository, Model, ModelYear, PricePoint, VehicleResult, VehicleType } from './types.ts';
import { buildVehicleResult } from './vehicle.ts';

const brands: Brand[] = [
  { id: 'b-car-1', vehicleType: 'cars', name: 'Marca Exemplo Alfa' },
  { id: 'b-car-2', vehicleType: 'cars', name: 'Marca Exemplo Beta' },
  { id: 'b-mot-1', vehicleType: 'motorcycles', name: 'Marca Exemplo Moto' },
  { id: 'b-trk-1', vehicleType: 'trucks', name: 'Marca Exemplo Carga' },
];
const models: Model[] = [
  { id: 'm-1', brandId: 'b-car-1', name: 'Modelo A 1.0' },
  { id: 'm-2', brandId: 'b-car-1', name: 'Modelo B 2.0 Automático' },
  { id: 'm-3', brandId: 'b-car-2', name: 'Modelo C 1.6' },
  { id: 'm-4', brandId: 'b-mot-1', name: 'Modelo D 150' },
  { id: 'm-5', brandId: 'b-trk-1', name: 'Modelo E 3.0 Diesel' },
  // long name to test wrapping (60+ characters)
  { id: 'm-6', brandId: 'b-car-2', name: 'Modelo F 1.0 Turbo Edição Especial Comemorativa Cinquenta Anos Flex' },
];
const years: ModelYear[] = [
  { id: 'y-1', modelId: 'm-1', modelYear: 2020, fuel: 'Flex', fipeCode: '900001-1' },
  { id: 'y-2', modelId: 'm-1', modelYear: 2022, fuel: 'Flex', fipeCode: '900001-1' },
  { id: 'y-3', modelId: 'm-2', modelYear: 2021, fuel: 'Gasolina', fipeCode: '900002-9' },
  { id: 'y-4', modelId: 'm-2', modelYear: 32000, fuel: 'Gasolina', fipeCode: '900002-9' },
  { id: 'y-5', modelId: 'm-3', modelYear: 2019, fuel: 'Flex', fipeCode: '900003-7' },
  { id: 'y-6', modelId: 'm-4', modelYear: 2023, fuel: 'Gasolina', fipeCode: '900004-5' },
  { id: 'y-7', modelId: 'm-5', modelYear: 2018, fuel: 'Diesel', fipeCode: '900005-3' },
  // a vehicle with one month of data only, to exercise the "sparse chart" state
  { id: 'y-8', modelId: 'm-3', modelYear: 2024, fuel: 'Flex', fipeCode: '900003-7' },
  { id: 'y-9', modelId: 'm-6', modelYear: 2025, fuel: 'Flex', fipeCode: '900006-1' },
];

const SAMPLE_MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const basePrice: Record<string, number> = {
  'y-1': 4_567_800, 'y-2': 5_890_000, 'y-3': 9_120_050, 'y-4': 14_999_900,
  'y-5': 6_430_000, 'y-6': 1_850_000, 'y-7': 21_000_000, 'y-8': 8_100_000, 'y-9': 123_456_789,
};

function historyFor(yearId: string): PricePoint[] {
  const base = basePrice[yearId];
  if (base === undefined) return [];
  const months = yearId === 'y-8' ? SAMPLE_MONTHS.slice(-1) : SAMPLE_MONTHS;
  // deterministic small drift per month so charts have shape and tests are stable
  return months.map((referenceMonth, i) => ({
    modelYearId: yearId,
    referenceMonth,
    priceCents: Math.round(base * (1 - 0.004 * (months.length - 1 - i)) / 100) * 100 + (i % 3) * 5_000,
    currency: 'BRL' as const,
  }));
}

export interface FakeOptions { latencyMs?: number; failWith?: Error }

export function createFakeRepository(opts: FakeOptions = {}): FipeRepository {
  const wait = async () => {
    if (opts.latencyMs) await new Promise(r => setTimeout(r, opts.latencyMs));
    if (opts.failWith) throw opts.failWith;
  };
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'pt-BR');

  return {
    async listBrands(type: VehicleType) {
      await wait();
      return brands.filter(b => b.vehicleType === type).sort(byName);
    },
    async listModels(brandId) {
      await wait();
      return models.filter(m => m.brandId === brandId).sort(byName);
    },
    async listYears(modelId) {
      await wait();
      // newest first, zero km on top
      return years.filter(y => y.modelId === modelId).sort((a, b) => b.modelYear - a.modelYear);
    },
    async getVehicle(modelYearId): Promise<VehicleResult | null> {
      await wait();
      const year = years.find(y => y.id === modelYearId);
      if (!year) return null;
      const model = models.find(m => m.id === year.modelId)!;
      const brand = brands.find(b => b.id === model.brandId)!;
      return buildVehicleResult(brand, model, year, historyFor(year.id));
    },
  };
}
