import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { c } from '../src/theme.ts';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </>
  );
}
