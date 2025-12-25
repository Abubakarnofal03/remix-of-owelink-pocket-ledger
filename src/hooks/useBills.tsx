import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { sendPushNotification, getPhoneSuffix } from "@/lib/notifications";
import { offlineDb } from "@/lib/offline/db";

export interface BillParticipant {
  id: string;
  bill_id: string;
  phone_number: string;
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
  participants?: BillParticipant[];
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
  participants: {
    phone_number: string;
    amount_owed: number;
    status?: string;
    amount_paid?: number;
  }[];
}

const BILLS_QUERY_KEY = ["bills"];

async function fetchBills(userId: string): Promise<Bill[]> {
  // Fetch all bills the user can see (RLS handles visibility)
  // Then filter: hide archived bills only if user is the creator
  const { data, error } = await supabase
    .from("bills")
    .select(`
      *,
      participants:bill_participants(*)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  
  // Filter out archived bills only for the creator - participants should still see them
  return (data || []).filter(bill => 
    bill.deleted_at === null || bill.creator_id !== userId
  );
}

async function fetchBillById(billId: string, userId: string): Promise<Bill | null> {
  const { data, error } = await supabase
    .from("bills")
    .select(`
      *,
      participants:bill_participants(*)
    `)
    .eq("id", billId)
    .maybeSingle();

  if (error) throw error;
  
  // Hide archived bills only for the creator - participants should still see them
  if (data && data.deleted_at !== null && data.creator_id === userId) {
    return null;
  }
  
  return data || null;
}

export function useBills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const billsQueryKey = ["bills", user?.id];

  const { data: bills = [], isLoading: loading } = useQuery({
    queryKey: billsQueryKey,
    queryFn: () => fetchBills(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: "always", // Always refetch on mount to ensure fresh data
  });

  const createBillMutation = useMutation({
    mutationFn: async (bill: BillInsert) => {
      if (!user) throw new Error("Not authenticated");

      // Create the bill
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .insert({
          creator_id: user.id,
          title: bill.title,
          description: bill.description || null,
          total_amount: bill.total_amount,
          currency: bill.currency || "USD",
          due_date: bill.due_date || null,
        })
        .select()
        .single();

      if (billError) throw billError;

      // Add participants
      const participantsToInsert = bill.participants.map(p => ({
        bill_id: billData.id,
        phone_number: p.phone_number,
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
    },
    onSuccess: (newBill) => {
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) => [newBill, ...old]);
      toast.success("Bill created successfully");
      
      // Send push notifications to participants
      const phoneSuffixes = newBill.participants
        ?.map(p => getPhoneSuffix(p.phone_number))
        .filter(Boolean) || [];
      if (phoneSuffixes.length > 0) {
        sendPushNotification({
          phoneSuffixes,
          title: "New Bill Added",
          body: `You've been added to "${newBill.title}" - ${newBill.currency} ${newBill.total_amount}`,
          data: { type: "bill", id: newBill.id },
        });
      }
    },
    onError: (error: any) => {
      console.error("Error creating bill:", error);
      toast.error("Failed to create bill");
    },
  });

  const updateBillMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<BillInsert, 'participants'>> }) => {
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
      return data;
    },
    onSuccess: (data) => {
      const existingBill = queryClient.getQueryData<Bill[]>(billsQueryKey)?.find(b => b.id === data.id);
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) =>
        old.map(b => b.id === data.id ? { ...b, ...data } : b)
      );
      toast.success("Bill updated");
      
      // Send push notifications to participants
      const phoneSuffixes = existingBill?.participants
        ?.map(p => getPhoneSuffix(p.phone_number))
        .filter(Boolean) || [];
      if (phoneSuffixes.length > 0) {
        sendPushNotification({
          phoneSuffixes,
          title: "Bill Updated",
          body: `"${data.title}" has been updated`,
          data: { type: "bill", id: data.id },
        });
      }
    },
    onError: (error: any) => {
      console.error("Error updating bill:", error);
      toast.error("Failed to update bill");
    },
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete only - ledger entries should never be hard deleted
      const { error } = await supabase
        .from("bills")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      // Mark as deleted in offline storage (don't remove - preserve ledger)
      try {
        await offlineDb.bills.update(id, { deleted_at: new Date().toISOString() });
      } catch (e) {
        console.warn("Failed to update bill in offline storage:", e);
      }

      return id;
    },
    onSuccess: (id) => {
      const deletedBill = queryClient.getQueryData<Bill[]>(billsQueryKey)?.find(b => b.id === id);
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) =>
        old.filter(b => b.id !== id)
      );
      toast.success("Bill archived");
      
      // Send push notifications to participants
      const phoneSuffixes = deletedBill?.participants
        ?.map(p => getPhoneSuffix(p.phone_number))
        .filter(Boolean) || [];
      if (phoneSuffixes.length > 0 && deletedBill) {
        sendPushNotification({
          phoneSuffixes,
          title: "Bill Archived",
          body: `"${deletedBill.title}" has been archived by creator`,
          data: { type: "bill", id },
        });
      }
    },
    onError: (error: any) => {
      console.error("Error deleting bill:", error);
      toast.error("Failed to delete bill");
    },
  });

  const createBill = async (bill: BillInsert): Promise<Bill | null> => {
    try {
      return await createBillMutation.mutateAsync(bill);
    } catch {
      return null;
    }
  };

  const updateBill = async (id: string, updates: Partial<Omit<BillInsert, 'participants'>>): Promise<boolean> => {
    try {
      await updateBillMutation.mutateAsync({ id, updates });
      return true;
    } catch {
      return false;
    }
  };

  const deleteBill = async (id: string): Promise<boolean> => {
    try {
      await deleteBillMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  const getBillById = (id: string): Bill | undefined => {
    return bills.find(b => b.id === id);
  };

  // Update bill in cache locally (for optimistic updates from detail page)
  const updateBillInCache = (id: string, updater: (bill: Bill) => Bill) => {
    queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) =>
      old.map(b => b.id === id ? updater(b) : b)
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

// Hook for single bill detail (uses cache first, then fetches if needed)
export function useBillDetail(billId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const billsQueryKey = ["bills", user?.id];

  // Try to get from cache first
  const cachedBills = queryClient.getQueryData<Bill[]>(billsQueryKey);
  const cachedBill = cachedBills?.find(b => b.id === billId);

  const { data: bill, isLoading } = useQuery({
    queryKey: ["bill", user?.id, billId],
    queryFn: () => fetchBillById(billId!, user!.id),
    enabled: !!user && !!billId && !cachedBill,
    initialData: cachedBill,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const updateBillLocally = (updater: (bill: Bill) => Bill) => {
    if (bill) {
      queryClient.setQueryData(["bill", user?.id, billId], updater(bill));
      // Also update in the bills list cache
      queryClient.setQueryData<Bill[]>(billsQueryKey, (old = []) =>
        old.map(b => b.id === billId ? updater(b) : b)
      );
    }
  };

  return {
    bill: bill || cachedBill,
    loading: isLoading && !cachedBill,
    updateBillLocally,
  };
}
