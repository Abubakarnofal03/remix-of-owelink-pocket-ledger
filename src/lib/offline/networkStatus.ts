import { useState, useEffect, useCallback, useRef } from 'react';
import { processAllPendingSync, getFailedSyncCount } from './syncQueue';
import { offlineDb } from './db';

export type NetworkStatus = 'online' | 'offline' | 'syncing';

interface NetworkState {
  status: NetworkStatus;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
}

// Check actual network connectivity
async function checkConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;
  
  try {
    // Try to reach a known endpoint
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
    });
    return true;
  } catch {
    return false;
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
      setState(prev => ({ ...prev, status: 'online' }));
      triggerSync();
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, status: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
