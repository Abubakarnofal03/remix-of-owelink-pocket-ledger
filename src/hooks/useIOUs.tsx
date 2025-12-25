import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { sendPushNotification, getPhoneSuffix } from "@/lib/notifications";
import { offlineDb } from "@/lib/offline/db";
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
}

export interface IOUInsert {
  debtor_phone_number: string;
  amount: number;
  currency?: string;
  description?: string;
  due_date?: string;
}

const IOUS_QUERY_KEY = ["ious"];

async function fetchIOUs(): Promise<IOU[]> {
  const { data, error } = await supabase
    .from("ious")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchIOUById(iouId: string): Promise<IOU | null> {
  const { data, error } = await supabase
    .from("ious")
    .select("*")
    .eq("id", iouId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function useIOUs() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const iousQueryKey = ["ious", user?.id];

  const { data: ious = [], isLoading: loading } = useQuery({
    queryKey: iousQueryKey,
    queryFn: () => fetchIOUs(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: "always",
  });

  // Filter IOUs by perspective
  const owedToMe = ious.filter(iou => iou.creditor_id === user?.id);
  const iOwe = ious.filter(iou => {
    if (iou.debtor_user_id === user?.id) return true;
    if (profile?.phone_suffix && iou.debtor_phone_suffix === profile.phone_suffix) return true;
    return false;
  });

  const createIOUMutation = useMutation({
    mutationFn: async (iou: IOUInsert) => {
      if (!user) throw new Error("Not authenticated");

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
    },
    onSuccess: (newIOU) => {
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) => [newIOU, ...old]);
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
    },
    onError: (error: any) => {
      console.error("Error creating IOU:", error);
      toast.error("Failed to create IOU");
    },
  });

  const updateIOUMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<IOUInsert> }) => {
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
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) =>
        old.map(i => i.id === data.id ? { ...i, ...data } : i)
      );
      toast.success("IOU updated");
      
      // Send push notification to debtor
      const phoneSuffix = getPhoneSuffix(data.debtor_phone_number);
      if (phoneSuffix) {
        sendPushNotification({
          phoneSuffixes: [phoneSuffix],
          title: "IOU Updated",
          body: `Your IOU${data.description ? ` for "${data.description}"` : ""} has been updated`,
          data: { type: "iou", id: data.id },
        });
      }
    },
    onError: (error: any) => {
      console.error("Error updating IOU:", error);
      toast.error("Failed to update IOU");
    },
  });

  const deleteIOUMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete only - ledger entries should never be hard deleted
      const { error } = await supabase
        .from("ious")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      // Mark as deleted in offline storage (don't remove - preserve ledger)
      try {
        await offlineDb.ious.update(id, { deleted_at: new Date().toISOString() });
      } catch (e) {
        console.warn("Failed to update IOU in offline storage:", e);
      }

      return id;
    },
    onSuccess: (id) => {
      const deletedIOU = queryClient.getQueryData<IOU[]>(iousQueryKey)?.find(i => i.id === id);
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) =>
        old.filter(i => i.id !== id)
      );
      toast.success("IOU deleted");
      
      // Send push notification to debtor
      if (deletedIOU) {
        const phoneSuffix = getPhoneSuffix(deletedIOU.debtor_phone_number);
        if (phoneSuffix) {
          sendPushNotification({
            phoneSuffixes: [phoneSuffix],
            title: "IOU Removed",
            body: `An IOU${deletedIOU.description ? ` for "${deletedIOU.description}"` : ""} has been removed`,
            data: { type: "iou", id },
          });
        }
      }
    },
    onError: (error: any) => {
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
    return ious.find(i => i.id === id);
  };

  const updateIOUInCache = (id: string, updater: (iou: IOU) => IOU) => {
    queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) =>
      old.map(i => i.id === id ? updater(i) : i)
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
  const cachedIOU = cachedIOUs?.find(i => i.id === iouId);

  const { data: iou, isLoading } = useQuery({
    queryKey: ["iou", user?.id, iouId],
    queryFn: () => fetchIOUById(iouId!),
    enabled: !!user && !!iouId && !cachedIOU,
    initialData: cachedIOU,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const updateIOULocally = (updater: (iou: IOU) => IOU) => {
    if (iou) {
      queryClient.setQueryData(["iou", user?.id, iouId], updater(iou));
      queryClient.setQueryData<IOU[]>(iousQueryKey, (old = []) =>
        old.map(i => i.id === iouId ? updater(i) : i)
      );
    }
  };

  return {
    iou: iou || cachedIOU,
    loading: isLoading && !cachedIOU,
    updateIOULocally,
  };
}
