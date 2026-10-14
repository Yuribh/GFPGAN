// Picks the data source: Supabase when the project keys are set, otherwise the sample data.
import { createFakeRepository } from './fake.ts';
import { createSupabaseRepository } from './supabase.ts';
import type { FipeRepository } from './types.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const usingSampleData = !(url && anonKey);
export const repo: FipeRepository = usingSampleData
  ? createFakeRepository({ latencyMs: 300 })
  : createSupabaseRepository({ url: url!, anonKey: anonKey! });
