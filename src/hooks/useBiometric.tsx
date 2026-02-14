import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

// Dynamic import to avoid issues on web
let NativeBiometric: any = null;
if (Capacitor.isNativePlatform()) {
  import('capacitor-native-biometric').then(mod => {
    NativeBiometric = mod.NativeBiometric;
  });
}

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_SERVER = 'owelink_auth';

interface BiometricState {
  isAvailable: boolean;
  isEnabled: boolean;
  biometryType: string | null;
}

export function useBiometric() {
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    isEnabled: localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true',
    biometryType: null,
  });

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    if (!Capacitor.isNativePlatform() || !NativeBiometric) {
      // Try loading again
      try {
        const mod = await import('capacitor-native-biometric');
        NativeBiometric = mod.NativeBiometric;
      } catch {
        return;
      }
    }

    try {
      const result = await NativeBiometric.isAvailable();
      setState(prev => ({
        ...prev,
        isAvailable: result.isAvailable,
        biometryType: result.biometryType ? String(result.biometryType) : null,
      }));
    } catch (e) {
      console.log('[Biometric] Not available:', e);
    }
  };

  const authenticate = useCallback(async (reason?: string): Promise<boolean> => {
    if (!NativeBiometric) return false;
    try {
      await NativeBiometric.verifyIdentity({
        reason: reason || 'Unlock OweLink',
        title: 'Biometric Login',
        subtitle: 'Verify your identity',
        description: 'Use your fingerprint or face to sign in',
      });
      return true;
    } catch (e) {
      console.log('[Biometric] Auth failed:', e);
      return false;
    }
  }, []);

  const storeCredentials = useCallback(async (phone: string, password: string): Promise<boolean> => {
    if (!NativeBiometric) return false;
    try {
      await NativeBiometric.setCredentials({
        username: phone,
        password: password,
        server: BIOMETRIC_SERVER,
      });
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      setState(prev => ({ ...prev, isEnabled: true }));
      console.log('[Biometric] Credentials stored');
      return true;
    } catch (e) {
      console.warn('[Biometric] Failed to store credentials:', e);
      return false;
    }
  }, []);

  const getCredentials = useCallback(async (): Promise<{ phone: string; password: string } | null> => {
    if (!NativeBiometric) return null;
    try {
      const creds = await NativeBiometric.getCredentials({
        server: BIOMETRIC_SERVER,
      });
      return { phone: creds.username, password: creds.password };
    } catch (e) {
      console.warn('[Biometric] Failed to get credentials:', e);
      return null;
    }
  }, []);

  const clearCredentials = useCallback(async () => {
    if (!NativeBiometric) return;
    try {
      await NativeBiometric.deleteCredentials({
        server: BIOMETRIC_SERVER,
      });
    } catch (e) {
      console.warn('[Biometric] Failed to clear credentials:', e);
    }
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    setState(prev => ({ ...prev, isEnabled: false }));
    console.log('[Biometric] Credentials cleared');
  }, []);

  const enableBiometric = useCallback(async (phone: string, password: string): Promise<boolean> => {
    const verified = await authenticate('Enable biometric login');
    if (!verified) return false;
    return storeCredentials(phone, password);
  }, [authenticate, storeCredentials]);

  const disableBiometric = useCallback(async () => {
    await clearCredentials();
  }, [clearCredentials]);

  return {
    ...state,
    authenticate,
    storeCredentials,
    getCredentials,
    clearCredentials,
    enableBiometric,
    disableBiometric,
  };
}
