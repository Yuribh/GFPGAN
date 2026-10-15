import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { c } from '../src/theme.ts';
import { withMonitoring } from '../src/services/monitoring.ts';
import { PlusProvider } from '../src/services/plus.tsx';
import { track } from '../src/services/track.ts';

function RootLayout() {
  useEffect(() => { track('app_open'); }, []);
  return (
    <PlusProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </PlusProvider>
  );
}

export default withMonitoring(RootLayout);
