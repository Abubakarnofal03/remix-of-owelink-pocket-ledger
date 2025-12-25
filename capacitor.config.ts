import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c4b29d3de8d347a9bddd8699314dcb44',
  appName: 'OweLink',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#000000',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      androidSplashResourceName: 'splash',
      showSpinner: false
    }
  },
  // Android-specific settings for WebView
  android: {
    // Enable DOM storage (localStorage, sessionStorage, IndexedDB)
    webContentsDebuggingEnabled: true,
    allowMixedContent: true,
  },
  // iOS-specific settings
  ios: {
    contentInset: 'automatic',
  }
};

export default config;
