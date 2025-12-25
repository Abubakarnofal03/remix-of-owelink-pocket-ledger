import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { offlineDb } from '@/lib/offline/db';
import { processAllPendingSync, getFailedSyncCount } from '@/lib/offline/syncQueue';
import { performFullSync } from '@/lib/offline/dataSync';
import { useAuth } from './useAuth';

export type NetworkStatus = 'online' | 'offline' | 'syncing';

interface OfflineContextType {
  status: NetworkStatus;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
  isOnline: boolean;
  isSyncing: boolean;
  sync: () => void;
  fullSync: () => Promise<void>;
  clearData: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NetworkStatus>(navigator.onLine ? 'online' : 'offline');
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [isSyncingRef, setIsSyncingRef] = useState(false);

  // Update counts
  const updateCounts = useCallback(async () => {
    const pending = await offlineDb.getPendingSyncCount();
    const failed = await getFailedSyncCount();
    setPendingCount(pending);
    setFailedCount(failed);
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
    if (isSyncingRef || !navigator.onLine) return;
    
    const pending = await offlineDb.getPendingSyncCount();
    if (pending === 0) return;

    setIsSyncingRef(true);
    setStatus('syncing');

    try {
      const result = await processAllPendingSync();
      console.log(`Synced: ${result.processed} processed, ${result.failed} failed`);
      await updateCounts();
      setLastSyncAt(Date.now());
      
      // Refresh caches after syncing
      invalidateCaches();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncingRef(false);
      setStatus(navigator.onLine ? 'online' : 'offline');
    }
  }, [isSyncingRef, updateCounts, invalidateCaches]);

  // Full sync from server
  const fullSync = useCallback(async () => {
    if (!user || !navigator.onLine) return;
    
    setIsSyncingRef(true);
    setStatus('syncing');

    try {
      // First process pending sync queue
      await syncPending();
      
      // Then fetch latest from server
      await performFullSync(user.id, profile?.phone_suffix || null);
      
      setLastSyncAt(Date.now());
      
      // Refresh React Query caches
      invalidateCaches();
    } catch (error) {
      console.error('Full sync error:', error);
    } finally {
      setIsSyncingRef(false);
      setStatus(navigator.onLine ? 'online' : 'offline');
    }
  }, [user, profile, syncPending, invalidateCaches]);

  // Clear all local data
  const clearData = useCallback(async () => {
    await offlineDb.clearAllData();
    await updateCounts();
    invalidateCaches();
  }, [updateCounts, invalidateCaches]);

  // Listen to network events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Back online, syncing...');
      setStatus('online');
      // Sync pending items when coming back online
      syncPending();
    };

    const handleOffline = () => {
      console.log('Network: Gone offline');
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    updateCounts();

    // Periodic sync every 30 seconds when online
    const intervalId = setInterval(() => {
      if (navigator.onLine && !isSyncingRef) {
        syncPending();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [syncPending, updateCounts, isSyncingRef]);

  // Initial full sync when user logs in
  useEffect(() => {
    if (user && navigator.onLine) {
      // Delay slightly to let the app render first
      const timer = setTimeout(() => {
        fullSync();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id]); // Only trigger on user ID change

  const value: OfflineContextType = {
    status,
    pendingCount,
    failedCount,
    lastSyncAt,
    isOnline: status !== 'offline',
    isSyncing: status === 'syncing',
    sync: syncPending,
    fullSync,
    clearData,
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
