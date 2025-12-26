import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
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
import { withTimeout, isLikelyOffline } from "@/lib/offline/requestWithTimeout";

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

  const iousQueryKey = ["ious", user?.id];

  const { data: ious = [], isLoading: loading } = useQuery({
    queryKey: iousQueryKey,
    queryFn: async () => {
      if (!user) return [];

      // 1. Try to get local data first (instant)
      try {
        const localIOUs = await fetchIOUsOfflineFirst(user.id, profile?.phone_suffix || null);
        const mappedIOUs = localIOUs.map(localIOUToIOU);

        // 2. If online, sync from server in background
        if (navigator.onLine) {
          try {
            await syncIOUsFromServer(user.id, profile?.phone_suffix || null);
            // Get updated local data after sync
            const updatedLocal = await fetchIOUsOfflineFirst(user.id, profile?.phone_suffix || null);
            if (updatedLocal.length > 0) {
              return updatedLocal.map(localIOUToIOU);
            }
          } catch (e) {
            console.warn("Failed to sync IOUs from server:", e);
          }
        }

        // Return local data if we have it
        if (mappedIOUs.length > 0) {
          return mappedIOUs;
        }
      } catch (localError) {
        console.warn("Local DB not available, falling back to server:", localError);
      }

      // 3. Fallback: fetch directly from server (for when IndexedDB fails)
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("ious")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data || []).map((iou: LocalIOU) => localIOUToIOU(iou));
      }

      return [];
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 30 * 60 * 1000,
  });

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

      let localIOU: LocalIOU | null = null;
      let localDbAvailable = false;

      // Always create locally first for immediate feedback
      try {
        localIOU = await createIOUOfflineFirst(user.id, iou as IOUInsertOffline);
        localDbAvailable = !!localIOU;
      } catch (localError) {
        console.warn("Local DB not available for IOU create:", localError);
      }

      // Check if we should attempt network request
      const shouldTryNetwork = navigator.onLine && !isLikelyOffline();
      
      if (!shouldTryNetwork) {
        // Definitely offline - return local data
        if (localIOU) {
          return localIOUToIOU(localIOU);
        }
        throw new Error("Cannot create IOU: offline and local storage unavailable");
      }

      // Try to sync to server with timeout
      try {
        const data = await withTimeout(
          (async () => {
            const { data, error } = await supabase
              .from("ious")
              .insert({
                creditor_id: user.id,
                debtor_phone_number: iou.debtor_phone_number,
                amount: iou.amount,
                amount_paid: 0,
                currency: iou.currency || "USD",
                description: iou.description || null,
                due_date: iou.due_date || null,
                status: "pending",
              })
              .select()
              .single();

            if (error) throw error;
            return data;
          })(),
          5000 // 5 second timeout
        );

        // Success! Update local DB with server data
        if (localDbAvailable && localIOU) {
          try {
            await offlineDb.ious.delete(localIOU.id);
            await offlineDb.ious.put({
              ...data,
              is_local: false,
            });

            // Clear sync queue for this item
            await offlineDb.syncQueue.where("entity_id").equals(localIOU.id).delete();
          } catch (dbError) {
            console.warn("Failed to update local DB:", dbError);
          }
        }

        return localIOUToIOU({ ...data, is_local: false });
      } catch (e: any) {
        console.warn("Failed to sync IOU to server:", e.message);
        
        // Network failed or timed out - return local data
        if (localIOU) {
          if (e.message === 'Request timed out') {
            toast.info("Connection slow - IOU saved offline, will sync when connection improves");
          }
          return localIOUToIOU(localIOU);
        }
        throw e; // No local fallback, rethrow
      }
    },
    onSuccess: (newIOU) => {
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) => [newIOU, ...old]);

      if (newIOU.is_local) {
        toast.success("IOU saved locally, will sync when online");
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
      if (navigator.onLine && !id.startsWith("local-")) {
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
      if (navigator.onLine && !id.startsWith("local-")) {
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

      // Try local first
      const localIOU = await offlineDb.ious.get(iouId);
      if (localIOU) {
        return localIOUToIOU(localIOU);
      }

      // If online, fetch from server
      if (navigator.onLine) {
        const { data, error } = await supabase.from("ious").select("*").eq("id", iouId).maybeSingle();

        if (error) throw error;
        return data ? localIOUToIOU(data as LocalIOU) : null;
      }

      return null;
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
