import { useEffect, useState, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from '@/integrations/supabase/client';
import { APP_VERSION_CODE } from '@/lib/constants';

interface AppUpdaterPlugin {
  installApk(options: { fileName: string }): Promise<{ success: boolean }>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

interface AppVersion {
  id: string;
  version_code: number;
  version_name: string;
  release_notes: string | null;
  apk_url: string | null;
  web_bundle_url: string | null;
  update_type: string;
  is_mandatory: boolean;
  created_at: string;
}

interface UpdateState {
  available: boolean;
  version: AppVersion | null;
  downloading: boolean;
  progress: number;
  error: string | null;
}

export const useAppUpdate = () => {
  const [state, setState] = useState<UpdateState>({
    available: false,
    version: null,
    downloading: false,
    progress: 0,
    error: null,
  });

  const checkForUpdate = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('version_code', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return;

      const latest = data as unknown as AppVersion;

      let installedVersionCode = APP_VERSION_CODE;
      if (Capacitor.isNativePlatform()) {
        const appInfo = await App.getInfo();
        const parsedBuild = Number.parseInt(appInfo.build ?? '', 10);
        if (!Number.isNaN(parsedBuild) && parsedBuild > 0) {
          installedVersionCode = parsedBuild;
        }
      }

      if (latest.version_code > installedVersionCode) {
        setState(prev => ({
          ...prev,
          available: true,
          version: latest,
        }));
      }
    } catch (err) {
      console.log('[AppUpdate] Check failed:', err);
    }
  }, []);

  const downloadAndInstallApk = useCallback(async () => {
    if (!state.version?.apk_url) {
      setState(prev => ({
        ...prev,
        error: 'No download URL available for this update. Please contact the developer.',
      }));
      return;
    }

    setState(prev => ({ ...prev, downloading: true, progress: 0, error: null }));

    try {
      const apkUrl = state.version.apk_url;

      // On non-native platforms, just open the APK URL directly
      if (!Capacitor.isNativePlatform()) {
        window.open(apkUrl, '_blank');
        setState(prev => ({ ...prev, downloading: false }));
        return;
      }

      // Download APK using fetch with progress tracking
      const response = await fetch(apkUrl);
      if (!response.ok) throw new Error('Download failed');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body?.getReader();

      if (!reader) throw new Error('No response body');

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) {
          setState(prev => ({ ...prev, progress: Math.round((received / total) * 100) }));
        }
      }

      // Combine chunks into a single array
      const blob = new Blob(chunks as any);
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert to base64
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64Data = btoa(binary);

      // Save to cache directory
      const fileName = `owelink-update-${state.version.version_name}.apk`;
      
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      setState(prev => ({ ...prev, progress: 100 }));

      // Trigger native install via the AppUpdater plugin
      try {
        await AppUpdater.installApk({ fileName });
      } catch (pluginErr) {
        console.error('[AppUpdate] Plugin error:', pluginErr);
        setState(prev => ({
          ...prev,
          error: 'Could not launch installer. Please enable "Install from unknown sources" in your device settings for this app, then try again.',
        }));
      }

      setState(prev => ({ ...prev, downloading: false }));
    } catch (err: any) {
      console.error('[AppUpdate] Download failed:', err);
      setState(prev => ({
        ...prev,
        downloading: false,
        error: err.message || 'Download failed. Please try again.',
      }));
    }
  }, [state.version]);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, available: false }));
  }, []);

  // Check for updates on mount (native only)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Delay check slightly to let app initialize
      const timer = setTimeout(checkForUpdate, 3000);
      return () => clearTimeout(timer);
    }
  }, [checkForUpdate]);

  return {
    ...state,
    checkForUpdate,
    downloadAndInstallApk,
    dismissUpdate,
  };
};
