import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { sendPushNotification, getPhoneSuffix } from "@/lib/notifications";
import { offlineDb, LocalBill, LocalBillParticipant } from "@/lib/offline/db";
import {
  fetchBillsOfflineFirst,
  createBillOfflineFirst,
  updateBillOfflineFirst,
  deleteBillOfflineFirst,
  BillInsertOffline,
} from "@/lib/offline/offlineDataLayer";
import { syncBillsFromServer } from "@/lib/offline/dataSync";
import { quickConnectivityCheck, isLikelyOffline } from "@/lib/offline/requestWithTimeout";

export interface BillParticipant {
  id: string;
  bill_id: string;
  phone_number: string;
  phone_suffix?: string | null;
  user_id: string | null;
  amount_owed: number;
  amount_paid: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  total_amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  reminder_enabled?: boolean;
  reminder_interval_days?: number | null;
  last_reminder_sent_at?: string | null;
  participants?: BillParticipant[];
  is_local?: boolean;
  creator?: {
    username: string;
    phone_number: string;
  };
}

export interface BillInsert {
  title: string;
  description?: string;
  total_amount: number;
  currency?: string;
  due_date?: string;
  reminder_enabled?: boolean;
  reminder_interval_days?: number;
  participants: {
    phone_number: string;
    amount_owed: number;
    status?: string;
    amount_paid?: number;
  }[];
}

// Convert LocalBill to Bill interface
function localBillToBill(local: LocalBill & { participants?: LocalBillParticipant[] }): Bill {
  return {
    id: local.id,
    creator_id: local.creator_id,
    title: local.title,
    description: local.description,
    total_amount: local.total_amount,
    currency: local.currency,
    status: local.status,
    due_date: local.due_date,
    created_at: local.created_at,
    updated_at: local.updated_at,
    deleted_at: local.deleted_at,
    reminder_enabled: local.reminder_enabled,
    reminder_interval_days: local.reminder_interval_days,
    last_reminder_sent_at: local.last_reminder_sent_at,
    is_local: local.is_local,
    participants: local.participants?.map((p) => ({
      id: p.id,
      bill_id: p.bill_id,
      phone_number: p.phone_number,
      phone_suffix: p.phone_suffix,
      user_id: p.user_id,
      amount_owed: p.amount_owed,
      amount_paid: p.amount_paid,
      status: p.status,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
  };
}

export function useBills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const billsQueryKey = ["bills", user?.id];

  const { data: bills = [], isLoading: loading } = useQuery({
    queryKey: billsQueryKey,
    queryFn: async () => {
      if (!user) return [];

      // 1. Try to get local data first (instant)
      try {
        const localBills = await fetchBillsOfflineFirst(user.id);
        const mappedBills = localBills.map(localBillToBill);

        // 2. If online, sync from server in background
        if (navigator.onLine) {
          try {
            await syncBillsFromServer(user.id);
            // Get updated local data after sync
            const updatedLocal = await fetchBillsOfflineFirst(user.id);
            if (updatedLocal.length > 0) {
              return updatedLocal.map(localBillToBill);
            }
          } catch (e) {
            console.warn("Failed to sync bills from server:", e);
          }
        }

        // Return local data if we have it
        if (mappedBills.length > 0) {
          return mappedBills;
        }
      } catch (localError) {
        console.warn("Local DB not available, falling back to server:", localError);
      }

      // 3. Fallback: fetch directly from server (for when IndexedDB fails)
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("bills")
          .select(`*, participants:bill_participants(*)`)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data || []) as Bill[];
      }

      return [];
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds - shorter since we use local first
    gcTime: 30 * 60 * 1000,
  });

  const createBillMutation = useMutation({
    mutationFn: async (bill: BillInsert) => {
      if (!user) throw new Error("Not authenticated");

      let localBill: LocalBill | null = null;
      let localDbAvailable = false;

      // Always create locally first for immediate feedback
      try {
        localBill = await createBillOfflineFirst(user.id, bill as BillInsertOffline);
        localDbAvailable = !!localBill;
      } catch (localError) {
        console.warn("Local DB not available for create:", localError);
      }

      // Quick connectivity check (2 seconds max) - don't trust navigator.onLine alone
      const isConnected = await quickConnectivityCheck();
      
      if (!isConnected || isLikelyOffline()) {
        // Definitely offline - return local data immediately with toast
        if (localBill) {
          toast.info("Saved offline, will sync when back online");
          return localBillToBill(localBill as LocalBill & { participants?: LocalBillParticipant[] });
        }
        throw new Error("Cannot create bill: offline and local storage unavailable");
      }

      // We're online - try to sync to server with timeout
      try {
        // Create the bill on server with timeout
        const createBillPromise = (async () => {
          const { data: billData, error: billError } = await supabase
            .from("bills")
            .insert({
              creator_id: user.id,
              title: bill.title,
              description: bill.description || null,
              total_amount: bill.total_amount,
              currency: bill.currency || "USD",
              due_date: bill.due_date || null,
              reminder_enabled: bill.reminder_enabled || false,
              reminder_interval_days: bill.reminder_interval_days || null,
            })
            .select()
            .single();

          if (billError) throw billError;

          // Add participants
          const participantsToInsert = bill.participants.map((p) => ({
            bill_id: billData.id,
            phone_number: p.phone_number,
            phone_suffix: getPhoneSuffix(p.phone_number) || null,
            amount_owed: p.amount_owed,
            amount_paid: p.amount_paid || 0,
            status: p.status || "pending",
          }));

          const { data: participantsData, error: participantsError } = await supabase
            .from("bill_participants")
            .insert(participantsToInsert)
            .select();

          if (participantsError) throw participantsError;

          return { ...billData, participants: participantsData };
        })();

        // Race against a 5 second timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), 5000);
        });

        const serverResult = await Promise.race([createBillPromise, timeoutPromise]);

        // Success! Update local DB with server data
        if (localDbAvailable && localBill) {
          try {
            await offlineDb.bills.delete(localBill.id);
            await offlineDb.billParticipants.where("bill_id").equals(localBill.id).delete();
            
            await offlineDb.bills.put({
              ...serverResult,
              is_local: false,
            });
            
            for (const p of serverResult.participants) {
              await offlineDb.billParticipants.put({
                ...p,
                is_local: false,
              });
            }

            // Clear sync queue for this item
            await offlineDb.syncQueue.where("entity_id").equals(localBill.id).delete();
          } catch (dbError) {
            console.warn("Failed to update local DB:", dbError);
          }
        }

        return { ...serverResult, is_local: false };
      } catch (e: any) {
        console.warn("Failed to sync bill to server:", e.message);
        
        // Network failed or timed out - return local data
        if (localBill) {
          if (e.message === 'Request timed out') {
            toast.info("Connection slow - saved offline, will sync later");
          } else {
            toast.info("Connection issue - saved offline");
          }
          return localBillToBill(localBill as LocalBill & { participants?: LocalBillParticipant[] });
        }
        throw e; // No local fallback, rethrow
      }
    },
    onSuccess: (newBill) => {
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) => [newBill, ...old]);
      
      if (newBill.is_local) {
        toast.success("Bill saved locally, will sync when online");
      } else {
        toast.success("Bill created successfully");
        
        // Send push notifications to participants
        const phoneSuffixes = newBill.participants
          ?.map((p) => getPhoneSuffix(p.phone_number))
          .filter(Boolean) || [];
        if (phoneSuffixes.length > 0) {
          sendPushNotification({
            phoneSuffixes: phoneSuffixes as string[],
            title: "New Bill Added",
            body: `You've been added to "${newBill.title}" - ${newBill.currency} ${newBill.total_amount}`,
            data: { type: "bill", id: newBill.id },
          });
        }
      }
    },
    onError: (error: Error) => {
      console.error("Error creating bill:", error);
      toast.error("Failed to create bill");
    },
  });

  const updateBillMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<BillInsert, "participants">> }) => {
      // Update locally first
      const localBill = await updateBillOfflineFirst(id, updates);
      if (!localBill) throw new Error("Bill not found");

      // If online, sync to server
      if (navigator.onLine && !id.startsWith("local-")) {
        try {
          const { data, error } = await supabase
            .from("bills")
            .update({
              title: updates.title,
              description: updates.description,
              total_amount: updates.total_amount,
              due_date: updates.due_date,
            })
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;

          // Update local with server data
          await offlineDb.bills.update(id, { ...data, is_local: false });

          // Clear sync queue
          await offlineDb.syncQueue
            .where("entity_id")
            .equals(id)
            .and((item) => item.operation === "update")
            .delete();

          return data;
        } catch (e) {
          console.warn("Failed to sync update to server:", e);
        }
      }

      return localBillToBill(localBill as LocalBill & { participants?: LocalBillParticipant[] });
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) =>
        old.map((b) => (b.id === data.id ? { ...b, ...data } : b))
      );
      const isLocal = 'is_local' in data && data.is_local;
      toast.success(isLocal ? "Bill updated locally" : "Bill updated");
    },
    onError: (error: Error) => {
      console.error("Error updating bill:", error);
      toast.error("Failed to update bill");
    },
  });

  const deleteBillMutation = useMutation({
    mutationFn: async ({ id, bill }: { id: string; bill: Bill }) => {
      // Check if all participants have paid
      const unpaidParticipants = bill.participants?.filter((p) => p.status !== "paid") || [];
      if (unpaidParticipants.length > 0) {
        throw new Error(`Cannot archive: ${unpaidParticipants.length} participant(s) haven't paid yet`);
      }

      // Delete locally first
      await deleteBillOfflineFirst(id);

      // If online and not a local-only item, sync to server
      if (navigator.onLine && !id.startsWith("local-")) {
        try {
          const { error } = await supabase
            .from("bills")
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
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) => old.filter((b) => b.id !== id));
      toast.success("Bill archived");
    },
    onError: (error: Error) => {
      console.error("Error deleting bill:", error);
      toast.error(error.message || "Failed to delete bill");
    },
  });

  const createBill = async (bill: BillInsert): Promise<Bill | null> => {
    try {
      return await createBillMutation.mutateAsync(bill);
    } catch {
      return null;
    }
  };

  const updateBill = async (id: string, updates: Partial<Omit<BillInsert, "participants">>): Promise<boolean> => {
    try {
      await updateBillMutation.mutateAsync({ id, updates });
      return true;
    } catch {
      return false;
    }
  };

  const deleteBill = async (id: string, bill: Bill): Promise<boolean> => {
    try {
      await deleteBillMutation.mutateAsync({ id, bill });
      return true;
    } catch {
      return false;
    }
  };

  const getBillById = (id: string): Bill | undefined => {
    return bills.find((b) => b.id === id);
  };

  const updateBillInCache = (id: string, updater: (bill: Bill) => Bill) => {
    queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) =>
      old.map((b) => (b.id === id ? updater(b) : b))
    );
  };

  return {
    bills,
    loading,
    createBill,
    updateBill,
    deleteBill,
    getBillById,
    updateBillInCache,
    refetch: () => queryClient.invalidateQueries({ queryKey: billsQueryKey }),
  };
}

// Hook for single bill detail
export function useBillDetail(billId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const billsQueryKey = ["bills", user?.id];
  const cachedBills = queryClient.getQueryData<Bill[]>(billsQueryKey);
  const cachedBill = cachedBills?.find((b) => b.id === billId);

  const { data: bill, isLoading } = useQuery({
    queryKey: ["bill", user?.id, billId],
    queryFn: async () => {
      if (!billId || !user) return null;

      // Try local first
      const localBill = await offlineDb.bills.get(billId);
      if (localBill) {
        const participants = await offlineDb.billParticipants.where("bill_id").equals(billId).toArray();
        return localBillToBill({ ...localBill, participants });
      }

      // If online, fetch from server
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("bills")
          .select(`*, participants:bill_participants(*)`)
          .eq("id", billId)
          .maybeSingle();

        if (error) throw error;
        return data;
      }

      return null;
    },
    enabled: !!user && !!billId && !cachedBill,
    initialData: cachedBill,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Ensure the result conforms to Bill type
  const resultBill = bill as Bill | undefined;

  const updateBillLocally = (updater: (bill: Bill) => Bill) => {
    if (resultBill) {
      queryClient.setQueryData(["bill", user?.id, billId], updater(resultBill));
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) =>
        old.map((b) => (b.id === billId ? updater(b) : b))
      );
    }
  };

  return {
    bill: resultBill || cachedBill,
    loading: isLoading && !cachedBill,
    updateBillLocally,
  };
}
