// The app's single analytics instance. Off when Supabase is not configured (sample data).
import { Platform } from 'react-native';
import { createAnalytics, type AppEvent } from './analytics.ts';
import { appVersion } from './runtime.ts';

const analytics = createAnalytics({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  platform: Platform.OS,
  appVersion,
});

export function track(event: AppEvent): void { void analytics.track(event); }
