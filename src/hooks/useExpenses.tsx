import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineDb, LocalExpense, generateLocalId } from "@/lib/offline/db";
import { addToSyncQueue } from "@/lib/offline/syncQueue";
import { toast } from "sonner";

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  reference_type: string | null;
  reference_id: string | null;
  is_local?: boolean;
  synced_at?: number;
}

export interface ExpenseInsert {
  amount: number;
  description?: string;
  currency?: string;
  reference_type?: string;
  reference_id?: string;
}

export function useExpenses() {
  const { user, currency } = useAuth();
  const queryClient = useQueryClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch expenses from local DB first, then sync
  const fetchExpenses = useCallback(async () => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    try {
      // Load from local DB first
      const ready = await offlineDb.ensureReady();
      if (ready) {
        const localExpenses = await offlineDb.expenses
          .where('user_id')
          .equals(user.id)
          .filter(e => !e.deleted_at)
          .toArray();
        
        setExpenses(localExpenses.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      setLoading(false);

      // Background sync from server
      syncFromServer();
    } catch (error) {
      console.error('[useExpenses] Error fetching:', error);
      setLoading(false);
    }
  }, [user]);

  // Sync from server in background
  const syncFromServer = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[useExpenses] Server sync failed:', error.message);
        return;
      }

      if (data) {
        const ready = await offlineDb.ensureReady();
        if (ready) {
          // Update local DB
          for (const expense of data) {
            await offlineDb.expenses.put({
              ...expense,
              synced_at: Date.now(),
              is_local: false,
            });
          }

          // Refresh from local DB
          const localExpenses = await offlineDb.expenses
            .where('user_id')
            .equals(user.id)
            .filter(e => !e.deleted_at)
            .toArray();

          setExpenses(localExpenses.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ));
        }
      }
    } catch (error) {
      console.warn('[useExpenses] Sync error:', error);
    }
  };

  // Create expense
  const createExpense = async (expenseData: ExpenseInsert): Promise<Expense | null> => {
    if (!user) {
      toast.error("Please sign in to add expenses");
      return null;
    }

    const now = new Date().toISOString();
    const id = generateLocalId();
    
    const newExpense: LocalExpense = {
      id,
      user_id: user.id,
      amount: expenseData.amount,
      description: expenseData.description || null,
      currency: expenseData.currency || currency,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      reference_type: expenseData.reference_type || null,
      reference_id: expenseData.reference_id || null,
      is_local: true,
      synced_at: undefined,
    };

    try {
      const ready = await offlineDb.ensureReady();
      if (ready) {
        await offlineDb.expenses.put(newExpense);
        await addToSyncQueue(
          'expense',
          'create',
          id,
          newExpense as unknown as Record<string, unknown>
        );
      }

      setExpenses(prev => [newExpense, ...prev]);
      return newExpense;
    } catch (error) {
      console.error('[useExpenses] Create error:', error);
      toast.error("Failed to create expense");
      return null;
    }
  };

  // Delete expense
  const deleteExpense = async (expenseId: string) => {
    try {
      const ready = await offlineDb.ensureReady();
      if (ready) {
        const expense = await offlineDb.expenses.get(expenseId);
        
        if (expense?.is_local && !expense.synced_at) {
          // Never synced, permanently delete
          await offlineDb.expenses.delete(expenseId);
          await offlineDb.syncQueue
            .where('entity_id')
            .equals(expenseId)
            .delete();
        } else {
          // Soft delete and queue for sync
          const now = new Date().toISOString();
          await offlineDb.expenses.update(expenseId, { 
            deleted_at: now,
            updated_at: now,
          });
          await addToSyncQueue(
            'expense',
            'delete',
            expenseId,
            { deleted_at: now }
          );
        }
      }

      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      toast.success("Expense deleted");
    } catch (error) {
      console.error('[useExpenses] Delete error:', error);
      toast.error("Failed to delete expense");
    }
  };

  // Calculate totals
  const getTotals = useCallback((filter: 'day' | 'week' | 'month' | 'all' = 'all') => {
    const now = new Date();
    let startDate: Date;

    switch (filter) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(0); // All time
    }

    const filtered = expenses.filter(e => new Date(e.created_at) >= startDate);
    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    
    return { total, count: filtered.length, expenses: filtered };
  }, [expenses]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return {
    expenses,
    loading,
    createExpense,
    deleteExpense,
    getTotals,
    refetch: fetchExpenses,
  };
}