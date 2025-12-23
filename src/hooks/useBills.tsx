import { useState, useEffect, useCallback } from "react";
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
  }[];
}

export function useBills() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("bills")
        .select(`
          *,
          participants:bill_participants(*)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error: any) {
      console.error("Error fetching bills:", error);
      toast.error("Failed to load bills");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const createBill = async (bill: BillInsert): Promise<Bill | null> => {
    if (!user) return null;

    try {
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
        amount_paid: 0,
        status: "pending",
      }));

      const { data: participantsData, error: participantsError } = await supabase
        .from("bill_participants")
        .insert(participantsToInsert)
        .select();

      if (participantsError) throw participantsError;

      const newBill = { ...billData, participants: participantsData };

      // Update local cache
      setBills(prev => [newBill, ...prev]);
      toast.success("Bill created successfully");
      return newBill;
    } catch (error: any) {
      console.error("Error creating bill:", error);
      toast.error("Failed to create bill");
      return null;
    }
  };

  const updateBill = async (id: string, updates: Partial<Omit<BillInsert, 'participants'>>): Promise<boolean> => {
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

      // Update local cache - preserve participants
      setBills(prev =>
        prev.map(b =>
          b.id === id
            ? { ...b, ...data }
            : b
        )
      );
      toast.success("Bill updated");
      return true;
    } catch (error: any) {
      console.error("Error updating bill:", error);
      toast.error("Failed to update bill");
      return false;
    }
  };

  const deleteBill = async (id: string): Promise<boolean> => {
    try {
      // Soft delete
      const { error } = await supabase
        .from("bills")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      // Update local cache
      setBills(prev => prev.filter(b => b.id !== id));
      toast.success("Bill deleted");
      return true;
    } catch (error: any) {
      console.error("Error deleting bill:", error);
      toast.error("Failed to delete bill");
      return false;
    }
  };

  const getBillById = useCallback((id: string): Bill | undefined => {
    return bills.find(b => b.id === id);
  }, [bills]);

  return {
    bills,
    loading,
    createBill,
    updateBill,
    deleteBill,
    getBillById,
    refetch: fetchBills,
  };
}
