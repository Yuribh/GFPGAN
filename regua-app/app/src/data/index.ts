// Picks the data source: Supabase when the project keys are set, otherwise the official FIPE API directly.
// EXPO_PUBLIC_DATA_SOURCE=sample forces the invented sample data (screenshots, offline demos).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeRepository } from './fake.ts';
import { createLiveRepository } from './live.ts';
import { withLiveIds } from './route.ts';
import { createSupabaseRepository } from './supabase.ts';
import type { FipeRepository } from './types.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const usingSampleData = process.env.EXPO_PUBLIC_DATA_SOURCE === 'sample';
// FIPE answers are kept on the phone: fewer requests, faster screens, vehicles already seen open offline
export const live = createLiveRepository({ persist: { get: k => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) } });

export const repo: FipeRepository = usingSampleData
  ? createFakeRepository({ latencyMs: 300 })
  : url && anonKey
    ? withLiveIds(createSupabaseRepository({ url, anonKey }), live)
    : live;
