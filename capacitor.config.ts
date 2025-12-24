import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c4b29d3de8d347a9bddd8699314dcb44',
  appName: 'SplitBills',
  webDir: 'dist',
  server: {
    url: 'https://c4b29d3d-e8d3-47a9-bddd-8699314dcb44.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#000000'
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      androidSplashResourceName: 'splash',
      showSpinner: false
    }
  }
};

export default config;
