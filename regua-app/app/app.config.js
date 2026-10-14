// Dynamic part of the app config: store ids and keys come from environment variables
// (.env.local on your machine, EAS secrets or GitHub secrets in the cloud). Static settings live in app.json.

// Google's public sample AdMob app ids: the app builds and shows test ads until you set your own.
const ADMOB_SAMPLE_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_SAMPLE_IOS = 'ca-app-pub-3940256099942544~1458002511';
const env = process.env;

module.exports = ({ config }) => {
  const plugins = [
    ...(config.plugins ?? []),
    ['expo-splash-screen', {
      image: './assets/splash-icon.png',
      imageWidth: 200,
      resizeMode: 'contain',
      backgroundColor: '#b5420c',
    }],
    ['react-native-google-mobile-ads', {
      androidAppId: env.ADMOB_ANDROID_APP_ID || ADMOB_SAMPLE_ANDROID,
      iosAppId: env.ADMOB_IOS_APP_ID || ADMOB_SAMPLE_IOS,
      // the app does not track users across apps, so no App Tracking Transparency prompt
      delayAppMeasurementInit: true,
    }],
  ];
  // Sentry's build plugin uploads source maps; only add it when the upload credentials exist
  if (env.SENTRY_ORG && env.SENTRY_PROJECT) {
    plugins.push(['@sentry/react-native/expo', { organization: env.SENTRY_ORG, project: env.SENTRY_PROJECT }]);
  }

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      privacyUrl: env.EXPO_PUBLIC_PRIVACY_URL || 'https://yuribh.github.io/GFPGAN/privacidade.html',
      termsUrl: env.EXPO_PUBLIC_TERMS_URL || 'https://yuribh.github.io/GFPGAN/termos.html',
      supportUrl: env.EXPO_PUBLIC_SUPPORT_URL || 'https://yuribh.github.io/GFPGAN/suporte.html',
      supportEmail: env.EXPO_PUBLIC_SUPPORT_EMAIL || undefined,
      ...(env.EAS_PROJECT_ID ? { eas: { projectId: env.EAS_PROJECT_ID } } : {}),
    },
  };
};
