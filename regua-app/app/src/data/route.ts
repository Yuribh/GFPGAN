// With Supabase, vehicles found through the FIPE API (plate lookups) keep live ids: those go to the live repository.
import { isLiveId } from './live.ts';
import type { FipeRepository } from './types.ts';

export function withLiveIds(base: FipeRepository, live: FipeRepository): FipeRepository {
  return {
    listBrands: type => base.listBrands(type),
    listModels: id => (isLiveId(id) ? live : base).listModels(id),
    listYears: id => (isLiveId(id) ? live : base).listYears(id),
    getVehicle: id => (isLiveId(id) ? live : base).getVehicle(id),
  };
}
