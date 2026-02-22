import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface ExpenseGroup {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpenseGroupMember {
  id: string;
  group_id: string;
  phone_number: string;
  phone_suffix: string | null;
  user_id: string | null;
  nickname: string | null;
  created_at: string;
}

export interface GroupExpense {
  id: string;
  group_id: string;
  paid_by_member_id: string;
  amount: number;
  description: string | null;
  split_type: string;
  split_details: any;
  created_at: string;
  deleted_at: string | null;
}

export function useExpenseGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("expense_groups")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroups((data || []) as ExpenseGroup[]);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async (data: { name: string; description?: string; currency: string }) => {
    if (!user) return null;
    try {
      const { data: group, error } = await supabase
        .from("expense_groups")
        .insert({
          creator_id: user.id,
          name: data.name,
          description: data.description || null,
          currency: data.currency,
        })
        .select()
        .single();

      if (error) throw error;
      setGroups(prev => [group as ExpenseGroup, ...prev]);
      toast.success("Group created");
      return group as ExpenseGroup;
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast.error(error.message || "Failed to create group");
      return null;
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      const { error } = await supabase
        .from("expense_groups")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      setGroups(prev => prev.filter(g => g.id !== id));
      toast.success("Group deleted");
      return true;
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
      return false;
    }
  };

  return { groups, loading, createGroup, deleteGroup, refetch: fetchGroups };
}

export function useExpenseGroupDetail(groupId: string | undefined) {
  const { user } = useAuth();
  const [group, setGroup] = useState<ExpenseGroup | null>(null);
  const [members, setMembers] = useState<ExpenseGroupMember[]>([]);
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user || !groupId) return;
    try {
      const [groupRes, membersRes, expensesRes] = await Promise.all([
        supabase.from("expense_groups").select("*").eq("id", groupId).single(),
        supabase.from("expense_group_members").select("*").eq("group_id", groupId).order("created_at"),
        supabase.from("group_expenses").select("*").eq("group_id", groupId).is("deleted_at", null).order("created_at", { ascending: false }),
      ]);

      if (groupRes.error) throw groupRes.error;
      setGroup(groupRes.data as ExpenseGroup);
      setMembers((membersRes.data || []) as ExpenseGroupMember[]);
      setExpenses((expensesRes.data || []) as GroupExpense[]);
    } catch (error) {
      console.error("Error fetching group detail:", error);
    } finally {
      setLoading(false);
    }
  }, [user, groupId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addMember = async (data: { phone_number: string; nickname?: string }) => {
    if (!groupId) return null;
    try {
      const { data: member, error } = await supabase
        .from("expense_group_members")
        .insert({
          group_id: groupId,
          phone_number: data.phone_number,
          nickname: data.nickname || null,
        })
        .select()
        .single();

      if (error) throw error;
      setMembers(prev => [...prev, member as ExpenseGroupMember]);
      toast.success("Member added");
      return member as ExpenseGroupMember;
    } catch (error: any) {
      console.error("Error adding member:", error);
      toast.error(error.message || "Failed to add member");
      return null;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("expense_group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success("Member removed");
      return true;
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
      return false;
    }
  };

  const addExpense = async (data: { paid_by_member_id: string; amount: number; description?: string; split_type?: string; split_details?: any }) => {
    if (!groupId) return null;
    try {
      const { data: expense, error } = await supabase
        .from("group_expenses")
        .insert({
          group_id: groupId,
          paid_by_member_id: data.paid_by_member_id,
          amount: data.amount,
          description: data.description || null,
          split_type: data.split_type || 'equal',
          split_details: data.split_details || {},
        })
        .select()
        .single();

      if (error) throw error;
      setExpenses(prev => [expense as GroupExpense, ...prev]);
      toast.success("Expense added");
      return expense as GroupExpense;
    } catch (error: any) {
      console.error("Error adding expense:", error);
      toast.error(error.message || "Failed to add expense");
      return null;
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from("group_expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseId);

      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      toast.success("Expense deleted");
      return true;
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
      return false;
    }
  };

  const isCreator = group?.creator_id === user?.id;

  return {
    group, members, expenses, loading, isCreator,
    addMember, removeMember, addExpense, deleteExpense,
    refetch: fetchAll,
  };
}
