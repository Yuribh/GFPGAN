// Picks the data source: Supabase when the project keys are set, otherwise the official FIPE API directly.
// EXPO_PUBLIC_DATA_SOURCE=sample forces the invented sample data (screenshots, offline demos).
import { createFakeRepository } from './fake.ts';
import { createLiveRepository } from './live.ts';
import { createSupabaseRepository } from './supabase.ts';
import type { FipeRepository } from './types.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const usingSampleData = process.env.EXPO_PUBLIC_DATA_SOURCE === 'sample';
export const repo: FipeRepository = usingSampleData
  ? createFakeRepository({ latencyMs: 300 })
  : url && anonKey
    ? createSupabaseRepository({ url, anonKey })
    : createLiveRepository();
