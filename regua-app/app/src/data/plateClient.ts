// The app's plate client: Supabase function when configured, sample answers otherwise.
import { createPlateClient } from './plate.ts';

export const plateClient = createPlateClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
