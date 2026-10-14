// Picks the data source: Supabase when the project keys are set, otherwise the official FIPE API directly.
// EXPO_PUBLIC_DATA_SOURCE=sample forces the invented sample data (screenshots, offline demos).
// Vehicles found by plate through the FIPE API keep live ids, so those always go to the live repository.
import { createFakeRepository } from './fake.ts';
import { createLiveRepository, isLiveId } from './live.ts';
import { createSupabaseRepository } from './supabase.ts';
import type { FipeRepository } from './types.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const usingSampleData = process.env.EXPO_PUBLIC_DATA_SOURCE === 'sample';
export const live = createLiveRepository();

export function withLiveIds(base: FipeRepository): FipeRepository {
  return {
    listBrands: type => base.listBrands(type),
    listModels: id => (isLiveId(id) ? live : base).listModels(id),
    listYears: id => (isLiveId(id) ? live : base).listYears(id),
    getVehicle: id => (isLiveId(id) ? live : base).getVehicle(id),
  };
}

export const repo: FipeRepository = usingSampleData
  ? createFakeRepository({ latencyMs: 300 })
  : url && anonKey
    ? withLiveIds(createSupabaseRepository({ url, anonKey }))
    : live;
