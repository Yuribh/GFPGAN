// Types for the FIPE catalog. Mirrors replica/schema.sql so the real data layer is a drop-in swap.
export type VehicleType = 'cars' | 'motorcycles' | 'trucks';

export interface Brand { id: string; vehicleType: VehicleType; name: string }
export interface Model { id: string; brandId: string; name: string }
export interface ModelYear {
  id: string;
  modelId: string;
  /** 32000 is how the FIPE catalog labels zero-km vehicles */
  modelYear: number;
  fuel: string;
  fipeCode: string;
}
export interface PricePoint {
  modelYearId: string;
  /** reference month as "YYYY-MM" */
  referenceMonth: string;
  priceCents: number;
  currency: 'BRL';
}
export interface VehicleResult {
  brand: Brand;
  model: Model;
  year: ModelYear;
  latest: PricePoint;
  /** change vs the previous month, null when there is only one month of data */
  change: { cents: number; percent: number } | null;
  history: PricePoint[];
}

/** The one interface screens use. fake.ts and the Supabase version both implement it. */
export interface FipeRepository {
  listBrands(type: VehicleType): Promise<Brand[]>;
  listModels(brandId: string): Promise<Model[]>;
  listYears(modelId: string): Promise<ModelYear[]>;
  getVehicle(modelYearId: string): Promise<VehicleResult | null>;
}
