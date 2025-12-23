import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

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
  const { data, error } = await supabase
    .from("bills")
    .select(`
      *,
      participants:bill_participants(*)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchBillById(billId: string): Promise<Bill | null> {
  const { data, error } = await supabase
    .from("bills")
    .select(`
      *,
      participants:bill_participants(*)
    `)
    .eq("id", billId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function useBills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: bills = [], isLoading: loading } = useQuery({
    queryKey: BILLS_QUERY_KEY,
    queryFn: () => fetchBills(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (previously cacheTime)
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
      queryClient.setQueryData<Bill[]>(BILLS_QUERY_KEY, (old = []) => [newBill, ...old]);
      toast.success("Bill created successfully");
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
      queryClient.setQueryData<Bill[]>(BILLS_QUERY_KEY, (old = []) =>
        old.map(b => b.id === data.id ? { ...b, ...data } : b)
      );
      toast.success("Bill updated");
    },
    onError: (error: any) => {
      console.error("Error updating bill:", error);
      toast.error("Failed to update bill");
    },
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bills")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Bill[]>(BILLS_QUERY_KEY, (old = []) =>
        old.filter(b => b.id !== id)
      );
      toast.success("Bill deleted");
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
    queryClient.setQueryData<Bill[]>(BILLS_QUERY_KEY, (old = []) =>
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
    refetch: () => queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY }),
  };
}

// Hook for single bill detail (uses cache first, then fetches if needed)
export function useBillDetail(billId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Try to get from cache first
  const cachedBills = queryClient.getQueryData<Bill[]>(BILLS_QUERY_KEY);
  const cachedBill = cachedBills?.find(b => b.id === billId);

  const { data: bill, isLoading } = useQuery({
    queryKey: ["bill", billId],
    queryFn: () => fetchBillById(billId!),
    enabled: !!user && !!billId && !cachedBill,
    initialData: cachedBill,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const updateBillLocally = (updater: (bill: Bill) => Bill) => {
    if (bill) {
      queryClient.setQueryData(["bill", billId], updater(bill));
      // Also update in the bills list cache
      queryClient.setQueryData<Bill[]>(BILLS_QUERY_KEY, (old = []) =>
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
