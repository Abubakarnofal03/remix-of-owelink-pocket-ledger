import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { offlineDb, LocalExpenseBucket, generateLocalId } from "@/lib/offline/db";
import { addToSyncQueue } from "@/lib/offline/syncQueue";
import { toast } from "sonner";

export interface ExpenseBucket {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  is_local?: boolean;
  synced_at?: number;
}

export interface BucketInsert {
  name: string;
  description?: string;
  color?: string;
}

const BUCKET_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

export function useExpenseBuckets() {
  const { user } = useAuth();
  const [buckets, setBuckets] = useState<ExpenseBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBuckets = useCallback(async () => {
    if (!user) {
      setBuckets([]);
      setLoading(false);
      return;
    }

    try {
      const ready = await offlineDb.ensureReady();
      if (ready) {
        const localBuckets = await offlineDb.expenseBuckets
          .where('user_id')
          .equals(user.id)
          .toArray();

        setBuckets(localBuckets.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      setLoading(false);

      // Background sync from server
      syncFromServer();
    } catch (error) {
      console.error('[useExpenseBuckets] Error fetching:', error);
      setLoading(false);
    }
  }, [user]);

  const syncFromServer = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('expense_buckets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[useExpenseBuckets] Server sync failed:', error.message);
        return;
      }

      if (data) {
        const ready = await offlineDb.ensureReady();
        if (ready) {
          for (const bucket of data) {
            await offlineDb.expenseBuckets.put({
              ...bucket,
              synced_at: Date.now(),
              is_local: false,
            });
          }

          const localBuckets = await offlineDb.expenseBuckets
            .where('user_id')
            .equals(user.id)
            .toArray();

          setBuckets(localBuckets.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ));
        }
      }
    } catch (error) {
      console.warn('[useExpenseBuckets] Sync error:', error);
    }
  };

  const createBucket = async (data: BucketInsert): Promise<ExpenseBucket | null> => {
    if (!user) {
      toast.error("Please sign in to create buckets");
      return null;
    }

    const now = new Date().toISOString();
    const id = generateLocalId();
    const colorIndex = buckets.length % BUCKET_COLORS.length;

    const newBucket: LocalExpenseBucket = {
      id,
      user_id: user.id,
      name: data.name,
      description: data.description || null,
      color: data.color || BUCKET_COLORS[colorIndex],
      created_at: now,
      updated_at: now,
      is_local: true,
      synced_at: undefined,
    };

    try {
      const ready = await offlineDb.ensureReady();
      if (ready) {
        await offlineDb.expenseBuckets.put(newBucket);
        await addToSyncQueue(
          'expense_bucket',
          'create',
          id,
          newBucket as unknown as Record<string, unknown>
        );
      }

      setBuckets(prev => [newBucket, ...prev]);
      return newBucket;
    } catch (error) {
      console.error('[useExpenseBuckets] Create error:', error);
      toast.error("Failed to create bucket");
      return null;
    }
  };

  const deleteBucket = async (bucketId: string) => {
    try {
      const ready = await offlineDb.ensureReady();
      if (ready) {
        const bucket = await offlineDb.expenseBuckets.get(bucketId);

        if (bucket?.is_local && !bucket.synced_at) {
          await offlineDb.expenseBuckets.delete(bucketId);
          await offlineDb.syncQueue
            .where('entity_id')
            .equals(bucketId)
            .delete();
        } else {
          // Server delete - bucket must be synced
          const { error } = await supabase
            .from('expense_buckets')
            .delete()
            .eq('id', bucketId);

          if (error) throw error;
          await offlineDb.expenseBuckets.delete(bucketId);
        }

        // Unassign expenses from this bucket
        await offlineDb.expenses
          .where('bucket_id')
          .equals(bucketId)
          .modify({ bucket_id: null });
      }

      setBuckets(prev => prev.filter(b => b.id !== bucketId));
      toast.success("Bucket deleted");
    } catch (error) {
      console.error('[useExpenseBuckets] Delete error:', error);
      toast.error("Failed to delete bucket");
    }
  };

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  return {
    buckets,
    loading,
    createBucket,
    deleteBucket,
    refetch: fetchBuckets,
    BUCKET_COLORS,
  };
}
