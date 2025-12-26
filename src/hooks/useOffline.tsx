import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { offlineDb, getDbDiagnostics, DbDiagnostics } from '@/lib/offline/db';
import { processAllPendingSync, getFailedSyncCount, retryFailedItems } from '@/lib/offline/syncQueue';
import { performFullSync } from '@/lib/offline/dataSync';
import { useAuth } from './useAuth';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';

export type NetworkStatus = 'online' | 'offline' | 'syncing';

interface OfflineContextType {
  status: NetworkStatus;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
  isOnline: boolean;
  isSyncing: boolean;
  dbDiagnostics: DbDiagnostics;
  sync: () => void;
  fullSync: () => Promise<void>;
  clearData: () => Promise<void>;
  retryFailed: () => Promise<void>;
  testDb: () => Promise<{ success: boolean; error?: string }>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NetworkStatus>(navigator.onLine ? 'online' : 'offline');
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [dbDiagnostics, setDbDiagnostics] = useState<DbDiagnostics>(getDbDiagnostics());
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<number | null>(null);

  // Update counts
  const updateCounts = useCallback(async () => {
    try {
      const pending = await offlineDb.getPendingSyncCount();
      const failed = await getFailedSyncCount();
      setPendingCount(pending);
      setFailedCount(failed);
      setDbDiagnostics(getDbDiagnostics());
    } catch (e) {
      console.error('[Offline] Error updating counts:', e);
    }
  }, []);

  // Invalidate React Query caches to refresh data
  const invalidateCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bills'] });
    queryClient.invalidateQueries({ queryKey: ['ious'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  // Sync pending items
  const syncPending = useCallback(async () => {
    // IMPORTANT: trust OfflineProvider status (badge), not navigator.onLine
    if (isSyncingRef.current || status === 'offline') return;

    const pending = await offlineDb.getPendingSyncCount();
    if (pending === 0) {
      await updateCounts();
      return;
    }

    isSyncingRef.current = true;
    setStatus('syncing');
    console.log('[Offline] Starting sync...');

    try {
      const result = await processAllPendingSync();
      console.log(`[Offline] Synced: ${result.processed} processed, ${result.failed} failed`);
      await updateCounts();
      setLastSyncAt(Date.now());

      // Refresh caches after syncing
      if (result.processed > 0) {
        invalidateCaches();
      }
    } catch (error) {
      console.error('[Offline] Sync error:', error);
    } finally {
      isSyncingRef.current = false;
      // If we went offline during sync, don't overwrite it back to online
      setStatus((prev) => (prev === 'offline' ? 'offline' : 'online'));
    }
  }, [status, updateCounts, invalidateCaches]);

  // Full sync from server
  const fullSync = useCallback(async () => {
    // IMPORTANT: trust OfflineProvider status (badge), not navigator.onLine
    if (!user || status === 'offline') return;

    isSyncingRef.current = true;
    setStatus('syncing');
    console.log('[Offline] Starting full sync...');

    try {
      // First process pending sync queue
      await processAllPendingSync();

      // Then fetch latest from server
      await performFullSync(user.id, profile?.phone_suffix || null);

      setLastSyncAt(Date.now());
      await updateCounts();

      // Refresh React Query caches
      invalidateCaches();
      console.log('[Offline] Full sync complete');
    } catch (error) {
      console.error('[Offline] Full sync error:', error);
    } finally {
      isSyncingRef.current = false;
      setStatus((prev) => (prev === 'offline' ? 'offline' : 'online'));
    }
  }, [user, profile, status, updateCounts, invalidateCaches]);

  // Clear all local data
  const clearData = useCallback(async () => {
    await offlineDb.clearAllData();
    await updateCounts();
    invalidateCaches();
  }, [updateCounts, invalidateCaches]);

  // Retry failed items
  const retryFailed = useCallback(async () => {
    await retryFailedItems();
    await updateCounts();
    syncPending();
  }, [updateCounts, syncPending]);

  // Test database
  const testDb = useCallback(async () => {
    return await offlineDb.testReadWrite();
  }, []);

  // Schedule sync with debounce
  const scheduleSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = window.setTimeout(() => {
      syncPending();
    }, 1000);
  }, [syncPending]);

  // Listen to network events
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Offline] Network: Back online');
      setStatus('online');
      scheduleSync();
    };

    const handleOffline = () => {
      console.log('[Offline] Network: Gone offline');
      setStatus('offline');
    };

    // Browser events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Capacitor Network plugin for native
    let networkListener: (() => void) | undefined;
    
    if (Capacitor.isNativePlatform()) {
      Network.addListener('networkStatusChange', (status) => {
        console.log('[Offline] Network status changed:', status.connected);
        if (status.connected) {
          handleOnline();
        } else {
          handleOffline();
        }
      }).then(handle => {
        networkListener = () => handle.remove();
      });
    }

    // Initial state
    updateCounts();

    // Periodic sync every 30 seconds when online
    const intervalId = setInterval(() => {
      if (status !== 'offline' && !isSyncingRef.current) {
        syncPending();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkListener) networkListener();
      clearInterval(intervalId);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [status, syncPending, updateCounts, scheduleSync]);

  // Sync on app resume (native)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let appListener: (() => void) | undefined;

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && status !== 'offline' && user) {
        console.log('[Offline] App resumed, syncing...');
        scheduleSync();
      }
    }).then(handle => {
      appListener = () => handle.remove();
    });

    return () => {
      if (appListener) appListener();
    };
  }, [user, status, scheduleSync]);

  // Initial full sync when user logs in
  useEffect(() => {
    if (user && status !== 'offline') {
      // Delay slightly to let the app render first
      const timer = setTimeout(() => {
        fullSync();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.id, status]); // Only trigger on user ID change / network status

  const value: OfflineContextType = {
    status,
    pendingCount,
    failedCount,
    lastSyncAt,
    isOnline: status !== 'offline',
    isSyncing: status === 'syncing',
    dbDiagnostics,
    sync: syncPending,
    fullSync,
    clearData,
    retryFailed,
    testDb,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
}
