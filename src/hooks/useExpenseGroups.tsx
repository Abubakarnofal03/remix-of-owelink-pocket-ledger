import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { offlineDb, generateLocalId, safeDbOperation, LocalExpenseGroup, LocalExpenseGroupMember, LocalGroupExpense } from "@/lib/offline/db";
import { addToSyncQueue } from "@/lib/offline/syncQueue";
import { syncExpenseGroupsFromServer } from "@/lib/offline/dataSync";
import { sendPushNotification, getPhoneSuffix } from "@/lib/notifications";

export interface ExpenseGroup {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_local?: boolean;
}

export interface ExpenseGroupMember {
  id: string;
  group_id: string;
  phone_number: string;
  phone_suffix: string | null;
  user_id: string | null;
  nickname: string | null;
  created_at: string;
  is_local?: boolean;
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
  is_local?: boolean;
}

export interface GroupWithStats extends ExpenseGroup {
  memberCount: number;
  totalExpenses: number;
}

export function useExpenseGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    // Load from local DB first (instant)
    const localData = await safeDbOperation(async () => {
      const localGroups = await offlineDb.expenseGroups.filter(g => !g.deleted_at).toArray();
      const allMembers = await offlineDb.expenseGroupMembers.toArray();
      const allExpenses = await offlineDb.groupExpenses.filter(e => !e.deleted_at).toArray();

      return localGroups.map(g => ({
        ...g,
        memberCount: allMembers.filter(m => m.group_id === g.id).length,
        totalExpenses: allExpenses.filter(e => e.group_id === g.id).reduce((sum, e) => sum + e.amount, 0),
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, []);

    if (localData.length > 0) {
      setGroups(localData as GroupWithStats[]);
      setLoading(false);
    }

    // Background sync from server
    try {
      await syncExpenseGroupsFromServer(user.id);
      // Re-read from local DB after sync
      const refreshed = await safeDbOperation(async () => {
        const localGroups = await offlineDb.expenseGroups.filter(g => !g.deleted_at).toArray();
        const allMembers = await offlineDb.expenseGroupMembers.toArray();
        const allExpenses = await offlineDb.groupExpenses.filter(e => !e.deleted_at).toArray();

        return localGroups.map(g => ({
          ...g,
          memberCount: allMembers.filter(m => m.group_id === g.id).length,
          totalExpenses: allExpenses.filter(e => e.group_id === g.id).reduce((sum, e) => sum + e.amount, 0),
        })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }, []);
      setGroups(refreshed as GroupWithStats[]);
    } catch (e) {
      console.error('[Groups] Background sync failed:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async (data: { name: string; description?: string; currency: string }) => {
    if (!user) return null;
    const now = new Date().toISOString();
    const localId = generateLocalId();

    const localGroup: LocalExpenseGroup = {
      id: localId,
      creator_id: user.id,
      name: data.name,
      description: data.description || null,
      currency: data.currency,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      is_local: true,
    };

    try {
      await offlineDb.expenseGroups.put(localGroup);
      await addToSyncQueue("expense_group", "create", localId, {
        creator_id: user.id,
        name: data.name,
        description: data.description || null,
        currency: data.currency,
      });

      const newGroup: GroupWithStats = { ...localGroup, memberCount: 0, totalExpenses: 0 };
      setGroups(prev => [newGroup, ...prev]);
      toast.success("Group created");
      return localGroup as ExpenseGroup;
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast.error(error.message || "Failed to create group");
      return null;
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      const existing = await offlineDb.expenseGroups.get(id);
      if (!existing) return false;

      const isUnsyncedLocal = existing.is_local && !existing.synced_at;
      if (isUnsyncedLocal) {
        await offlineDb.expenseGroups.delete(id);
        await offlineDb.expenseGroupMembers.where('group_id').equals(id).delete();
        await offlineDb.groupExpenses.where('group_id').equals(id).delete();
        await offlineDb.syncQueue.where('entity_id').equals(id).delete();
      } else {
        await offlineDb.expenseGroups.update(id, { deleted_at: new Date().toISOString(), is_local: true });
        await addToSyncQueue("expense_group", "delete", id, { deleted_at: new Date().toISOString() });
      }

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

    // Load from local DB first
    const localData = await safeDbOperation(async () => {
      const g = await offlineDb.expenseGroups.get(groupId);
      const m = await offlineDb.expenseGroupMembers.where('group_id').equals(groupId).toArray();
      const e = await offlineDb.groupExpenses.where('group_id').equals(groupId).filter(x => !x.deleted_at).toArray();
      return { group: g, members: m, expenses: e };
    }, { group: null, members: [], expenses: [] });

    if (localData.group) {
      setGroup(localData.group as ExpenseGroup);
      setMembers((localData.members || []) as ExpenseGroupMember[]);
      setExpenses(((localData.expenses || []) as GroupExpense[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setLoading(false);
    }

    // Background sync
    try {
      const [groupRes, membersRes, expensesRes] = await Promise.all([
        supabase.from("expense_groups").select("*").eq("id", groupId).single(),
        supabase.from("expense_group_members").select("*").eq("group_id", groupId).order("created_at"),
        supabase.from("group_expenses").select("*").eq("group_id", groupId).is("deleted_at", null).order("created_at", { ascending: false }),
      ]);

      if (groupRes.error) throw groupRes.error;

      const now = Date.now();
      // Cache to local DB
      if (groupRes.data) {
        await offlineDb.expenseGroups.put({ ...groupRes.data, synced_at: now, is_local: false } as any);
        setGroup(groupRes.data as ExpenseGroup);
      }
      if (membersRes.data) {
        // Replace members for this group
        await offlineDb.expenseGroupMembers.where('group_id').equals(groupId).filter(m => !m.is_local).delete();
        const localM = await offlineDb.expenseGroupMembers.where('group_id').equals(groupId).toArray();
        const serverMembers = membersRes.data.map((m: any) => ({ ...m, synced_at: now, is_local: false }));
        const localOnlyM = localM.filter(lm => !serverMembers.some((sm: any) => sm.id === lm.id));
        await offlineDb.expenseGroupMembers.bulkPut([...serverMembers, ...localOnlyM]);
        setMembers([...serverMembers, ...localOnlyM] as ExpenseGroupMember[]);
      }
      if (expensesRes.data) {
        await offlineDb.groupExpenses.where('group_id').equals(groupId).filter(e => !e.is_local).delete();
        const localE = await offlineDb.groupExpenses.where('group_id').equals(groupId).filter(e => e.is_local === true).toArray();
        const serverExpenses = expensesRes.data.map((e: any) => ({ ...e, synced_at: now, is_local: false }));
        const localOnlyE = localE.filter(le => !serverExpenses.some((se: any) => se.id === le.id));
        await offlineDb.groupExpenses.bulkPut([...serverExpenses, ...localOnlyE]);
        setExpenses(([...serverExpenses, ...localOnlyE] as GroupExpense[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
    } catch (error) {
      console.error("Error syncing group detail:", error);
    } finally {
      setLoading(false);
    }
  }, [user, groupId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addMember = async (data: { phone_number: string; nickname?: string }) => {
    if (!groupId) return null;
    const now = new Date().toISOString();
    const localId = generateLocalId();

    const localMember: LocalExpenseGroupMember = {
      id: localId,
      group_id: groupId,
      phone_number: data.phone_number,
      phone_suffix: null,
      user_id: null,
      nickname: data.nickname || null,
      created_at: now,
      is_local: true,
    };

    try {
      await offlineDb.expenseGroupMembers.put(localMember);
      await addToSyncQueue("expense_group_member", "create", localId, {
        group_id: groupId,
        phone_number: data.phone_number,
        nickname: data.nickname || null,
      });

      setMembers(prev => [...prev, localMember as ExpenseGroupMember]);
      toast.success("Member added");

      // Notify existing group members about the new member
      const existingSuffixes = members
        .map(m => m.phone_suffix || getPhoneSuffix(m.phone_number))
        .filter(Boolean) as string[];
      const userSuffix = user ? await supabase.from('profiles').select('phone_suffix').eq('user_id', user.id).single().then(r => r.data?.phone_suffix) : null;
      const recipientSuffixes = existingSuffixes.filter(s => s !== userSuffix);
      if (recipientSuffixes.length > 0 && group) {
        sendPushNotification({
          phoneSuffixes: recipientSuffixes,
          title: `👥 ${group.name}`,
          body: `${data.nickname || data.phone_number} was added to the group`,
          data: { type: 'group', id: groupId },
        });
      }

      return localMember as ExpenseGroupMember;
    } catch (error: any) {
      console.error("Error adding member:", error);
      toast.error(error.message || "Failed to add member");
      return null;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const existing = await offlineDb.expenseGroupMembers.get(memberId);
      if (existing?.is_local && !existing.synced_at) {
        await offlineDb.expenseGroupMembers.delete(memberId);
        await offlineDb.syncQueue.where('entity_id').equals(memberId).delete();
      } else {
        await offlineDb.expenseGroupMembers.delete(memberId);
        await addToSyncQueue("expense_group_member", "delete", memberId, {});
      }

      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success("Member removed");

      // Notify the removed member
      const removedMember = members.find(m => m.id === memberId);
      if (removedMember && group) {
        const removedSuffix = removedMember.phone_suffix || getPhoneSuffix(removedMember.phone_number);
        if (removedSuffix) {
          sendPushNotification({
            phoneSuffixes: [removedSuffix],
            title: `👥 ${group.name}`,
            body: `You were removed from the group`,
            data: { type: 'group', id: groupId },
          });
        }
      }

      return true;
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
      return false;
    }
  };

  const addExpense = async (data: { paid_by_member_id: string; amount: number; description?: string; split_type?: string; split_details?: any }) => {
    if (!groupId) return null;
    const now = new Date().toISOString();
    const localId = generateLocalId();

    const localExpense: LocalGroupExpense = {
      id: localId,
      group_id: groupId,
      paid_by_member_id: data.paid_by_member_id,
      amount: data.amount,
      description: data.description || null,
      split_type: data.split_type || 'equal',
      split_details: data.split_details || {},
      created_at: now,
      deleted_at: null,
      is_local: true,
    };

    try {
      await offlineDb.groupExpenses.put(localExpense);
      await addToSyncQueue("group_expense", "create", localId, {
        group_id: groupId,
        paid_by_member_id: data.paid_by_member_id,
        amount: data.amount,
        description: data.description || null,
        split_type: data.split_type || 'equal',
        split_details: data.split_details || {},
      });

      setExpenses(prev => [localExpense as GroupExpense, ...prev]);
      toast.success("Expense added");

      // Notify all group members except the one who added
      const userSuffix = user ? await supabase.from('profiles').select('phone_suffix').eq('user_id', user.id).single().then(r => r.data?.phone_suffix) : null;
      const recipientSuffixes = members
        .map(m => m.phone_suffix || getPhoneSuffix(m.phone_number))
        .filter(s => s && s !== userSuffix) as string[];
      if (recipientSuffixes.length > 0 && group) {
        sendPushNotification({
          phoneSuffixes: recipientSuffixes,
          title: `💰 ${group.name}`,
          body: `New expense: ${data.description || `${group.currency} ${data.amount}`}`,
          data: { type: 'group', id: groupId },
        });
      }

      return localExpense as GroupExpense;
    } catch (error: any) {
      console.error("Error adding expense:", error);
      toast.error(error.message || "Failed to add expense");
      return null;
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      const existing = await offlineDb.groupExpenses.get(expenseId);
      if (existing?.is_local && !existing.synced_at) {
        await offlineDb.groupExpenses.delete(expenseId);
        await offlineDb.syncQueue.where('entity_id').equals(expenseId).delete();
      } else {
        await offlineDb.groupExpenses.update(expenseId, { deleted_at: new Date().toISOString(), is_local: true });
        await addToSyncQueue("group_expense", "delete", expenseId, { deleted_at: new Date().toISOString() });
      }

      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      toast.success("Expense deleted");

      // Notify group members about deletion
      const userSuffix = user ? await supabase.from('profiles').select('phone_suffix').eq('user_id', user.id).single().then(r => r.data?.phone_suffix) : null;
      const recipientSuffixes = members
        .map(m => m.phone_suffix || getPhoneSuffix(m.phone_number))
        .filter(s => s && s !== userSuffix) as string[];
      if (recipientSuffixes.length > 0 && group) {
        sendPushNotification({
          phoneSuffixes: recipientSuffixes,
          title: `💰 ${group.name}`,
          body: `An expense was deleted from the group`,
          data: { type: 'group', id: groupId },
        });
      }

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
