import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { processAllPendingSync, getFailedSyncCount } from './syncQueue';
import { offlineDb } from './db';

export type NetworkStatus = 'online' | 'offline' | 'syncing';

interface NetworkState {
  status: NetworkStatus;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
}

// Get connection info if available
function getConnectionInfo(): { type: string; effectiveType: string } | null {
  try {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    if (connection) {
      return {
        type: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown'
      };
    }
  } catch (e) {
    console.warn('Failed to get connection info:', e);
  }
  return null;
}

// Check actual network connectivity - with Android-specific handling
async function checkConnectivity(): Promise<boolean> {
  // First check navigator.onLine
  if (!navigator.onLine) {
    console.log('Network: navigator.onLine is false');
    return false;
  }
  
  // On native platforms, trust navigator.onLine more (WebView keeps it accurate)
  if (Capacitor.isNativePlatform()) {
    const connInfo = getConnectionInfo();
    console.log('Network: Native platform, connection info:', connInfo);
    
    // If we have connection info and type is 'none', we're offline
    if (connInfo?.type === 'none') {
      return false;
    }
    
    return true;
  }
  
  // On web, do a connectivity check
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (e) {
    console.warn('Connectivity check failed:', e);
    return navigator.onLine; // Fallback to navigator.onLine
  }
}

export function useNetworkStatus() {
  const [state, setState] = useState<NetworkState>({
    status: navigator.onLine ? 'online' : 'offline',
    pendingCount: 0,
    failedCount: 0,
    lastSyncAt: null,
  });

  const isSyncing = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update pending counts
  const updateCounts = useCallback(async () => {
    const pendingCount = await offlineDb.getPendingSyncCount();
    const failedCount = await getFailedSyncCount();
    setState(prev => ({ ...prev, pendingCount, failedCount }));
  }, []);

  // Sync function with debounce
  const sync = useCallback(async () => {
    if (isSyncing.current) return;
    
    const isOnline = await checkConnectivity();
    if (!isOnline) {
      setState(prev => ({ ...prev, status: 'offline' }));
      return;
    }

    const pendingCount = await offlineDb.getPendingSyncCount();
    if (pendingCount === 0) {
      setState(prev => ({ ...prev, status: 'online' }));
      return;
    }

    isSyncing.current = true;
    setState(prev => ({ ...prev, status: 'syncing' }));

    try {
      const { processed, failed } = await processAllPendingSync();
      const newPendingCount = await offlineDb.getPendingSyncCount();
      const newFailedCount = await getFailedSyncCount();

      setState({
        status: newPendingCount > 0 ? 'syncing' : 'online',
        pendingCount: newPendingCount,
        failedCount: newFailedCount,
        lastSyncAt: Date.now(),
      });

      console.log(`Sync complete: ${processed} processed, ${failed} failed`);
    } catch (error) {
      console.error('Sync error:', error);
      setState(prev => ({ ...prev, status: 'online' }));
    } finally {
      isSyncing.current = false;
    }
  }, []);

  // Debounced sync trigger
  const triggerSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(sync, 500);
  }, [sync]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network event: online');
      setState(prev => ({ ...prev, status: 'online' }));
      triggerSync();
    };

    const handleOffline = () => {
      console.log('Network event: offline');
      setState(prev => ({ ...prev, status: 'offline' }));
    };

    // Add standard event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Add connection change listener for Android
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    const handleConnectionChange = () => {
      console.log('Connection change detected:', {
        type: connection?.type,
        effectiveType: connection?.effectiveType,
        onLine: navigator.onLine
      });
      
      if (navigator.onLine) {
        handleOnline();
      } else {
        handleOffline();
      }
    };

    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Initial sync and count update
    updateCounts();
    if (navigator.onLine) {
      triggerSync();
    }

    // Periodic sync every 30 seconds when online
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        triggerSync();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      clearInterval(intervalId);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [triggerSync, updateCounts]);

  return {
    ...state,
    sync: triggerSync,
    updateCounts,
    isOnline: state.status !== 'offline',
    isSyncing: state.status === 'syncing',
  };
}

// Hook for triggering sync after mutations
export function useSyncTrigger() {
  const { sync, updateCounts } = useNetworkStatus();

  const triggerAfterMutation = useCallback(async () => {
    await updateCounts();
    sync();
  }, [sync, updateCounts]);

  return triggerAfterMutation;
}
