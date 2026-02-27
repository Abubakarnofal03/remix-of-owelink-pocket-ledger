import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOffline } from "./useOffline";
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
  is_pinned?: boolean;
  receipt_url?: string | null;
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
  receipt_url?: string;
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
    is_pinned: (local as any).is_pinned || false,
    receipt_url: (local as any).receipt_url || null,
    is_local: local.is_local,
    creator: local.creator_username ? {
      username: local.creator_username,
      phone_number: local.creator_phone_number || '',
    } : undefined,
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
  const offline = useOffline();
  const hasSyncedRef = useRef(false);

  const billsQueryKey = ["bills", user?.id];

  // Query returns local data immediately, never blocks on server
  const { data: bills = [], isLoading: loading } = useQuery({
    queryKey: billsQueryKey,
    queryFn: async () => {
      if (!user) return [];

      // Always return local data immediately - never block on server
      try {
        const localBills = await fetchBillsOfflineFirst(user.id);
        const mappedBills = localBills.map(localBillToBill);
        // Sort by created_at descending (newest first)
        return mappedBills.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
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
        console.log('[Bills] Background sync starting...');
        await syncBillsFromServer(user.id);
        hasSyncedRef.current = true;
        // Invalidate to refresh UI with synced data
        queryClient.invalidateQueries({ queryKey: billsQueryKey });
        console.log('[Bills] Background sync complete');
      } catch (e) {
        console.warn('[Bills] Background sync failed:', e);
      }
    };

    // Small delay to let UI render first
    const timer = setTimeout(syncInBackground, 500);
    return () => clearTimeout(timer);
  }, [user?.id, offline.isOnline, queryClient]);

  // Reset sync flag when going offline then online
  useEffect(() => {
    if (!offline.isOnline) {
      hasSyncedRef.current = false;
    }
  }, [offline.isOnline]);

  const createBillMutation = useMutation({
    mutationFn: async (bill: BillInsert) => {
      if (!user) throw new Error("Not authenticated");

      // Always create locally first and return immediately.
      // Server sync is handled by the sync queue + OfflineProvider in the background.
      const localBill = await createBillOfflineFirst(user.id, bill as BillInsertOffline);

      // If we think we're online, trigger a background sync (do not await).
      if (offline.isOnline) {
        setTimeout(() => offline.sync(), 0);
      }

      return localBillToBill(localBill);
    },
    onSuccess: (newBill) => {
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) => [newBill, ...old]);

      // Show appropriate toast message
      if (newBill.is_local) {
        toast.success(
          offline.isOnline
            ? "Saved. Syncing in background…"
            : "Saved offline, will sync when back online"
        );
      } else {
        toast.success("Bill created successfully");
      }

      // Send push notifications to participants (regardless of online/offline status)
      const phoneSuffixes = newBill.participants
        ?.map((p) => getPhoneSuffix(p.phone_number))
        .filter(Boolean) || [];
      if (phoneSuffixes.length > 0 && navigator.onLine) {
        sendPushNotification({
          phoneSuffixes: phoneSuffixes as string[],
          title: "New Bill Added",
          body: `You've been added to "${newBill.title}" - ${newBill.currency} ${newBill.total_amount}`,
          data: { type: "bill", id: newBill.id },
        });
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
      if (offline.isOnline && !id.startsWith("local-")) {
        try {
          const { data, error } = await supabase
            .from("bills")
            .update({
              title: updates.title,
              description: updates.description,
              total_amount: updates.total_amount,
              due_date: updates.due_date,
              receipt_url: updates.receipt_url,
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

      let serverSyncFailed = false;

      // If online and not a local-only item, sync to server
      if (offline.isOnline && !id.startsWith("local-")) {
        try {
          const { error } = await supabase
            .from("bills")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);

          if (error) {
            console.error("Server sync error:", error);
            serverSyncFailed = true;
            throw error;
          }

          // Clear sync queue only if server update succeeded
          await offlineDb.syncQueue.where("entity_id").equals(id).delete();
        } catch (e) {
          console.error("Failed to sync delete to server:", e);
          serverSyncFailed = true;
          // Don't throw - allow local deletion to succeed
          // The sync queue will retry later
        }
      }

      return { id, serverSyncFailed };
    },
    onSuccess: ({ id, serverSyncFailed }) => {
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) => old.filter((b) => b.id !== id));
      // Force immediate refetch of dashboard to update recent activity
      // Use type: 'active' to refetch even if query is not stale
      queryClient.refetchQueries({ queryKey: ["dashboard"], type: 'active' });
      // Also invalidate bills query to refetch and exclude deleted bill
      queryClient.invalidateQueries({ queryKey: billsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["bill", user?.id, id] });

      if (serverSyncFailed) {
        toast.success("Bill archived locally. Will sync to server when online.");
      } else {
        toast.success("Bill archived");
      }
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

  // Get bill debts where other people owe the current user (for IOUs integration)
  const getBillDebtsOwedToMe = (): Array<{
    participantPhone: string;
    amount_owed: number;
    amount_paid: number;
    billId: string;
    billTitle: string;
    currency: string;
    status: string;
    created_at: string;
  }> => {
    if (!user) return [];
    const debts: Array<{
      participantPhone: string;
      amount_owed: number;
      amount_paid: number;
      billId: string;
      billTitle: string;
      currency: string;
      status: string;
      created_at: string;
    }> = [];

    bills.forEach(bill => {
      // Only bills I created
      if (bill.creator_id !== user.id) return;
      if (bill.deleted_at) return;
      
      bill.participants?.forEach(p => {
        // Skip participants that are the creator themselves
        if (p.user_id === user.id) return;
        // Only unpaid
        if (p.status === 'paid' || p.amount_paid >= p.amount_owed) return;
        
        debts.push({
          participantPhone: p.phone_number,
          amount_owed: p.amount_owed,
          amount_paid: p.amount_paid,
          billId: bill.id,
          billTitle: bill.title,
          currency: bill.currency,
          status: p.status,
          created_at: bill.created_at,
        });
      });
    });

    return debts;
  };

  const togglePin = async (id: string, currentlyPinned: boolean) => {
    const newPinned = !currentlyPinned;
    // Update cache immediately
    queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) =>
      old.map((b) => (b.id === id ? { ...b, is_pinned: newPinned } : b))
    );
    // Update local DB
    try {
      await offlineDb.bills.update(id, { is_pinned: newPinned } as any);
    } catch (e) {
      console.warn("Failed to update local pin:", e);
    }
    // Update server if online
    if (offline.isOnline && !id.startsWith("local-")) {
      supabase.from("bills").update({ is_pinned: newPinned }).eq("id", id).then();
    }
  };

  return {
    bills,
    loading,
    createBill,
    updateBill,
    deleteBill,
    getBillById,
    updateBillInCache,
    getBillDebtsOwedToMe,
    togglePin,
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

      // Always try local first - never block on server
      try {
        const localBill = await offlineDb.bills.get(billId);
        if (localBill) {
          // Filter out deleted bills
          if (localBill.deleted_at) {
            return null;
          }
          const participants = await offlineDb.billParticipants.where("bill_id").equals(billId).toArray();
          return localBillToBill({ ...localBill, participants });
        }
      } catch (e) {
        console.warn("Local DB error:", e);
      }

      // Return cached data if available, but only if not deleted
      if (cachedBill && !cachedBill.deleted_at) {
        return cachedBill;
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
