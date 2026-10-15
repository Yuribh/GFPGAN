// What the running binary can do. Expo Go has no native code of its own, so store purchases and ads
// (which need native SDKs) are switched off there and the app still opens.
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
export const appVersion = Constants.expoConfig?.version ?? '0.0.0';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/** Public links shown in the app (privacy policy, support). Set in app.config.js. */
export const links = {
  privacy: str(extra.privacyUrl) ?? 'https://yuribh.github.io/GFPGAN/privacidade.html',
  terms: str(extra.termsUrl) ?? 'https://yuribh.github.io/GFPGAN/termos.html',
  support: str(extra.supportUrl) ?? 'https://yuribh.github.io/GFPGAN/suporte.html',
  supportEmail: str(extra.supportEmail),
};

/** Partner insurance quote (opens the partner's page). Hidden until EXPO_PUBLIC_INSURANCE_URL is set. */
const insuranceUrl = process.env.EXPO_PUBLIC_INSURANCE_URL;
export const insurance = insuranceUrl && /^https:\/\//.test(insuranceUrl)
  ? { url: insuranceUrl, label: process.env.EXPO_PUBLIC_INSURANCE_LABEL || 'Cotar seguro' }
  : null;
