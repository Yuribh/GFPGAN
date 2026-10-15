// The app's plate client: Supabase function when configured, sample answers otherwise.
// Plates whose FIPE codes are missing from the catalog are priced with the FIPE API directly.
import { live, usingSampleData } from './index.ts';
import { createPlateClient } from './plate.ts';

export const plateClient = createPlateClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  resolve: usingSampleData ? undefined : (codes, year) => live.matchFipeCodes(codes, year),
  sampleCatalog: usingSampleData,
});
