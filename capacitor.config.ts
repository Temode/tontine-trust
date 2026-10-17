import type { CapacitorConfig } from '@capacitor/cli';

// Mode développement (rechargement en direct) : CAP_LIVE_RELOAD=1 npx cap sync
const liveReload = process.env.CAP_LIVE_RELOAD === '1';

const config: CapacitorConfig = {
  appId: 'com.tontinedigitale.app',
  appName: 'Tontine Digitale',
  webDir: 'dist',
  backgroundColor: '#0B5559',
  ...(liveReload
    ? {
        server: {
          url: 'https://f51a5fe7-3210-4b4e-97ff-b6c5213b2913.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }
    : {}),
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0B5559',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: { style: 'DARK', backgroundColor: '#0B5559', overlaysWebView: false },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
  },
};

export default config;
