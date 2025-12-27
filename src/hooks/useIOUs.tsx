import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOffline } from "./useOffline";
import { toast } from "sonner";
import { sendPushNotification, getPhoneSuffix } from "@/lib/notifications";
import { offlineDb, LocalIOU } from "@/lib/offline/db";
import {
  fetchIOUsOfflineFirst,
  createIOUOfflineFirst,
  updateIOUOfflineFirst,
  deleteIOUOfflineFirst,
  IOUInsertOffline,
} from "@/lib/offline/offlineDataLayer";
import { syncIOUsFromServer } from "@/lib/offline/dataSync";

export interface IOU {
  id: string;
  creditor_id: string;
  debtor_phone_number: string;
  debtor_phone_suffix: string | null;
  debtor_user_id: string | null;
  amount: number;
  amount_paid: number;
  currency: string;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_local?: boolean;
}

export interface IOUInsert {
  debtor_phone_number: string;
  amount: number;
  currency?: string;
  description?: string;
  due_date?: string;
}

// Convert LocalIOU to IOU interface
function localIOUToIOU(local: LocalIOU): IOU {
  return {
    id: local.id,
    creditor_id: local.creditor_id,
    debtor_phone_number: local.debtor_phone_number,
    debtor_phone_suffix: local.debtor_phone_suffix,
    debtor_user_id: local.debtor_user_id,
    amount: local.amount,
    amount_paid: local.amount_paid,
    currency: local.currency,
    description: local.description,
    due_date: local.due_date,
    status: local.status,
    created_at: local.created_at,
    updated_at: local.updated_at,
    deleted_at: local.deleted_at,
    is_local: local.is_local,
  };
}

export function useIOUs() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const offline = useOffline();
  const hasSyncedRef = useRef(false);

  const iousQueryKey = ["ious", user?.id];

  // Query returns local data immediately, never blocks on server
  const { data: ious = [], isLoading: loading } = useQuery({
    queryKey: iousQueryKey,
    queryFn: async () => {
      if (!user) return [];

      // Always return local data immediately - never block on server
      try {
        const localIOUs = await fetchIOUsOfflineFirst(user.id, profile?.phone_suffix || null);
        return localIOUs.map(localIOUToIOU);
      } catch (localError) {
        console.warn("Local DB not available:", localError);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Background sync effect - runs when online, doesn't block UI
  useEffect(() => {
    if (!user || !offline.isOnline || hasSyncedRef.current) return;
    
    const syncInBackground = async () => {
      try {
        console.log('[IOUs] Background sync starting...');
        await syncIOUsFromServer(user.id, profile?.phone_suffix || null);
        hasSyncedRef.current = true;
        // Invalidate to refresh UI with synced data
        queryClient.invalidateQueries({ queryKey: iousQueryKey });
        console.log('[IOUs] Background sync complete');
      } catch (e) {
        console.warn('[IOUs] Background sync failed:', e);
      }
    };

    // Small delay to let UI render first
    const timer = setTimeout(syncInBackground, 500);
    return () => clearTimeout(timer);
  }, [user?.id, offline.isOnline, profile?.phone_suffix, queryClient]);

  // Reset sync flag when going offline then online
  useEffect(() => {
    if (!offline.isOnline) {
      hasSyncedRef.current = false;
    }
  }, [offline.isOnline]);

  // Filter IOUs by perspective
  const owedToMe = ious.filter((iou) => iou.creditor_id === user?.id);
  const iOwe = ious.filter((iou) => {
    if (iou.debtor_user_id === user?.id) return true;
    if (profile?.phone_suffix && iou.debtor_phone_suffix === profile.phone_suffix) return true;
    return false;
  });

  const createIOUMutation = useMutation({
    mutationFn: async (iou: IOUInsert) => {
      if (!user) throw new Error("Not authenticated");

      // Always create locally first and return immediately.
      // Server sync is handled by the sync queue + OfflineProvider in the background.
      const localIOU = await createIOUOfflineFirst(user.id, iou as IOUInsertOffline);

      // If we think we're online, trigger a background sync (do not await).
      if (offline.isOnline) {
        setTimeout(() => offline.sync(), 0);
      }

      return localIOUToIOU(localIOU);
    },
    onSuccess: (newIOU) => {
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) => [newIOU, ...old]);

      if (newIOU.is_local) {
        toast.success(
          offline.isOnline
            ? "Saved. Syncing in background…"
            : "Saved offline, will sync when back online"
        );
      } else {
        toast.success("IOU created successfully");

        // Send push notification to debtor
        const phoneSuffix = getPhoneSuffix(newIOU.debtor_phone_number);
        if (phoneSuffix) {
          sendPushNotification({
            phoneSuffixes: [phoneSuffix],
            title: "New IOU",
            body: `You owe ${newIOU.currency} ${newIOU.amount}${newIOU.description ? ` for "${newIOU.description}"` : ""}`,
            data: { type: "iou", id: newIOU.id },
          });
        }
      }
    },
    onError: (error: Error) => {
      console.error("Error creating IOU:", error);
      toast.error("Failed to create IOU");
    },
  });

  const updateIOUMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<IOUInsert> }) => {
      // Update locally first
      const localIOU = await updateIOUOfflineFirst(id, updates);
      if (!localIOU) throw new Error("IOU not found");

      // If online and not local-only, sync to server
      if (offline.isOnline && !id.startsWith("local-")) {
        try {
          const { data, error } = await supabase
            .from("ious")
            .update({
              debtor_phone_number: updates.debtor_phone_number,
              amount: updates.amount,
              description: updates.description,
              due_date: updates.due_date,
            })
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;

          // Update local with server data
          await offlineDb.ious.update(id, { ...data, is_local: false });

          // Clear sync queue
          await offlineDb.syncQueue
            .where("entity_id")
            .equals(id)
            .and((item) => item.operation === "update")
            .delete();

          return localIOUToIOU({ ...data, is_local: false });
        } catch (e) {
          console.warn("Failed to sync update to server:", e);
        }
      }

      return localIOUToIOU(localIOU);
    },
    onSuccess: (data) => {
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) =>
        old.map((i) => (i.id === data.id ? { ...i, ...data } : i))
      );
      toast.success(data.is_local ? "IOU updated locally" : "IOU updated");
    },
    onError: (error: Error) => {
      console.error("Error updating IOU:", error);
      toast.error("Failed to update IOU");
    },
  });

  const deleteIOUMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete locally first
      await deleteIOUOfflineFirst(id);

      // If online and not local-only, sync to server
      if (offline.isOnline && !id.startsWith("local-")) {
        try {
          const { error } = await supabase
            .from("ious")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);

          if (error) throw error;

          // Clear sync queue
          await offlineDb.syncQueue.where("entity_id").equals(id).delete();
        } catch (e) {
          console.warn("Failed to sync delete to server:", e);
        }
      }

      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) => old.filter((i) => i.id !== id));
      toast.success("IOU archived");
    },
    onError: (error: Error) => {
      console.error("Error deleting IOU:", error);
      toast.error("Failed to delete IOU");
    },
  });

  const createIOU = async (iou: IOUInsert): Promise<IOU | null> => {
    try {
      return await createIOUMutation.mutateAsync(iou);
    } catch {
      return null;
    }
  };

  const updateIOU = async (id: string, updates: Partial<IOUInsert>): Promise<boolean> => {
    try {
      await updateIOUMutation.mutateAsync({ id, updates });
      return true;
    } catch {
      return false;
    }
  };

  const deleteIOU = async (id: string): Promise<boolean> => {
    try {
      await deleteIOUMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  const getIOUById = (id: string): IOU | undefined => {
    return ious.find((i) => i.id === id);
  };

  const updateIOUInCache = (id: string, updater: (iou: IOU) => IOU) => {
    queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) =>
      old.map((i) => (i.id === id ? updater(i) : i))
    );
  };

  return {
    ious,
    owedToMe,
    iOwe,
    loading,
    createIOU,
    updateIOU,
    deleteIOU,
    getIOUById,
    updateIOUInCache,
    refetch: () => queryClient.invalidateQueries({ queryKey: iousQueryKey }),
  };
}

// Hook for single IOU detail
export function useIOUDetail(iouId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const iousQueryKey = ["ious", user?.id];
  const cachedIOUs = queryClient.getQueryData<IOU[]>(iousQueryKey);
  const cachedIOU = cachedIOUs?.find((i) => i.id === iouId);

  const { data: iou, isLoading } = useQuery({
    queryKey: ["iou", user?.id, iouId],
    queryFn: async () => {
      if (!iouId || !user) return null;

      // Always try local first - never block on server
      try {
        const localIOU = await offlineDb.ious.get(iouId);
        if (localIOU) {
          return localIOUToIOU(localIOU);
        }
      } catch (e) {
        console.warn("Local DB error:", e);
      }

      // Return cached data if available
      return cachedIOU || null;
    },
    enabled: !!user && !!iouId && !cachedIOU,
    initialData: cachedIOU,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const updateIOULocally = (updater: (iou: IOU) => IOU) => {
    if (iou) {
      queryClient.setQueryData(["iou", user?.id, iouId], updater(iou));
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) =>
        old.map((i) => (i.id === iouId ? updater(i) : i))
      );
    }
  };

  return {
    iou: iou || cachedIOU,
    loading: isLoading && !cachedIOU,
    updateIOULocally,
  };
}
