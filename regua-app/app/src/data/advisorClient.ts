import { createAdvisorClient } from './advisor.ts';

export const advisorClient = createAdvisorClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
