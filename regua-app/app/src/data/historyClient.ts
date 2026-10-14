import { createHistoryClient } from './history.ts';

export const historyClient = createHistoryClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
