// One banner on the free plan, never pop-ups or full-screen ads. Hidden for Valor do Carro Plus subscribers.
// Consent (Google UMP, LGPD/GDPR) is asked before the ads SDK starts. Off in Expo Go and on the web.
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { isExpoGo, isNative } from './runtime.ts';
import { usePlus } from './plus.tsx';
import { reportError } from './monitoring.ts';

export const adsAvailable = isNative && !isExpoGo;
type AdsModule = typeof import('react-native-google-mobile-ads');
const Ads: AdsModule | null = adsAvailable ? require('react-native-google-mobile-ads') : null;

// Without a real unit id (env var) the banner uses Google's test unit: safe to ship to testers, earns nothing.
const unitId = (Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER : process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER)
  || Ads?.TestIds.ADAPTIVE_BANNER || '';

let starting: Promise<boolean> | null = null;
function startAds(): Promise<boolean> {
  if (!Ads) return Promise.resolve(false);
  starting ??= (async () => {
    try { await Ads.AdsConsent.gatherConsent(); } catch (e) { reportError(e); }
    let canRequest = true;
    try { canRequest = (await Ads.AdsConsent.getConsentInfo()).canRequestAds; } catch { /* keep default */ }
    if (canRequest) await Ads.default().initialize();
    return canRequest;
  })().catch(e => { reportError(e); return false; });
  return starting;
}

/** Whether the user should be offered a way to change their ad consent (required in some regions). */
export async function adPrivacyOptionsRequired(): Promise<boolean> {
  if (!Ads) return false;
  try {
    const info = await Ads.AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === Ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch { return false; }
}
export async function openAdPrivacyOptions(): Promise<void> {
  if (!Ads) return;
  try { await Ads.AdsConsent.showPrivacyOptionsForm(); } catch (e) { reportError(e); }
}

export function AdBanner() {
  const { isPlus, checking } = usePlus();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const show = Boolean(Ads) && !isPlus && !checking;

  useEffect(() => { if (show) startAds().then(setReady); }, [show]);

  if (!Ads || isPlus || failed) return null;
  const { BannerAd, BannerAdSize } = Ads;
  return (
    // reserved height so the page does not jump when the ad arrives
    <View style={{ minHeight: 60, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel="Anúncio">
      {ready && show ? (
        <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          onAdFailedToLoad={() => setFailed(true)} />
      ) : null}
    </View>
  );
}
