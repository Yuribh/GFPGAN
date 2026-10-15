// Crash and error reports (Sentry). Off unless EXPO_PUBLIC_SENTRY_DSN is set.
// No personal data: sendDefaultPii stays false and screenshots/replays are not enabled.
import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const monitoringEnabled = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export function withMonitoring(C: ComponentType): ComponentType {
  return dsn ? Sentry.wrap(C as ComponentType<Record<string, unknown>>) as ComponentType : C;
}

export function reportError(err: unknown): void {
  if (dsn) Sentry.captureException(err);
}
