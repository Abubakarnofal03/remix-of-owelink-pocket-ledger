import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App, URLOpenListenerEvent } from '@capacitor/app';

export const useCapacitor = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const initializeCapacitor = async () => {
      if (Capacitor.isNativePlatform()) {
        // Configure status bar
        try {
          // Ensure the WebView is laid out *below* the native status bar (prevents overlap on Android)
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#000000' });
        } catch (error) {
          console.log('StatusBar not available:', error);
        }

        // Hide splash screen after app is ready
        try {
          await SplashScreen.hide();
        } catch (error) {
          console.log('SplashScreen not available:', error);
        }

        // Handle deep links from app shortcuts
        App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
          console.log('[Capacitor] App opened with URL:', event.url);
          
          // Parse the URL - format: owelink://path
          const url = event.url;
          if (url.startsWith('owelink://')) {
            const path = url.replace('owelink:/', '');
            console.log('[Capacitor] Navigating to:', path);
            navigate(path);
          }
        });
      }
    };

    initializeCapacitor();

    return () => {
      if (Capacitor.isNativePlatform()) {
        App.removeAllListeners();
      }
    };
  }, [navigate]);

  return {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform()
  };
};
