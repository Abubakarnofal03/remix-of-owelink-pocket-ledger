import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useExpenseGroupDetail } from "@/hooks/useExpenseGroups";
import { useContacts } from "@/hooks/useContacts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Skeleton } from "@/components/ui/skeleton";
import { AddGroupExpenseDialog } from "@/components/groups/AddGroupExpenseDialog";
import { SettlementSummary } from "@/components/groups/SettlementSummary";
import { calculateBalances, simplifyDebts, calculatePairwiseDebts } from "@/lib/debtSimplification";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { processAllPendingSync } from "@/lib/offline/syncQueue";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, Users, Receipt, Trash2, UserPlus, ArrowRight } from "lucide-react";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function GroupExpenseDetail() {
  const { user, loading: authLoading } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { group, members, expenses, loading, isCreator, addMember, removeMember, addExpense, deleteExpense, refetch } = useExpenseGroupDetail(id);
  const { contacts } = useContacts();

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  // Calculate settlements
  const settlements = useMemo(() => {
    if (members.length === 0 || expenses.length === 0) return [];
    const memberIds = members.map(m => m.id);
    const balances = calculateBalances(
      expenses.map(e => ({
        paid_by_member_id: e.paid_by_member_id,
        amount: e.amount,
        split_type: e.split_type,
        split_details: e.split_details,
      })),
      memberIds
    );
    return simplifyDebts(balances);
  }, [members, expenses]);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Calculate per-member balances
  const memberBalances = useMemo(() => {
    if (members.length === 0) return new Map<string, number>();
    const memberIds = members.map(m => m.id);
    return calculateBalances(
      expenses.map(e => ({
        paid_by_member_id: e.paid_by_member_id,
        amount: e.amount,
        split_type: e.split_type,
        split_details: e.split_details,
      })),
      memberIds
    );
  }, [members, expenses]);

  // Pairwise: who owes whom (after netting reciprocal flows)
  const pairwiseDebts = useMemo(() => {
    if (members.length === 0 || expenses.length === 0) return [];
    return calculatePairwiseDebts(
      expenses.map(e => ({
        paid_by_member_id: e.paid_by_member_id,
        amount: e.amount,
        split_type: e.split_type,
        split_details: e.split_details,
      })),
      members.map(m => m.id)
    );
  }, [members, expenses]);

  const currentUserMember = useMemo(
    () => members.find(m => m.user_id === user?.id) || null,
    [members, user?.id]
  );

  const handleRefresh = async () => {
    try {
      await processAllPendingSync();
    } catch (e) {
      console.error('[Groups] sync failed', e);
    }
    await refetch();
  };


  // Per-member expense breakdown
  const getMemberExpenses = (memberId: string) => {
    return expenses.filter(e => e.paid_by_member_id === memberId);
  };

  const getMemberOwedShare = (memberId: string) => {
    let totalOwed = 0;
    for (const expense of expenses) {
      if (expense.split_type === 'equal') {
        totalOwed += expense.amount / members.length;
      } else if (expense.split_type === 'exact' && expense.split_details) {
        const details = expense.split_details as Record<string, number>;
        totalOwed += details[memberId] || 0;
      } else if (expense.split_type === 'percentage' && expense.split_details) {
        const details = expense.split_details as Record<string, number>;
        totalOwed += (expense.amount * (details[memberId] || 0)) / 100;
      }
    }
    return totalOwed;
  };

  const getMemberName = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    return member?.nickname || member?.phone_number || 'Unknown';
  };

  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const filteredContacts = contacts.filter(c => {
    if (members.some(m => m.phone_number === c.phone_number)) return false;
    if (!memberSearch.trim()) return false;
    const q = memberSearch.toLowerCase();
    return c.nickname?.toLowerCase().includes(q) || c.phone_number.includes(q);
  });

  if (authLoading || loading) {
    return (
      <AppLayout hideNav>
        <div className="space-y-4 animate-fade-in">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!group) {
    return (
      <AppLayout hideNav>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Group not found</p>
          <Button variant="link" onClick={() => navigate("/groups")}>Go back</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideNav>
      <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6 pb-20 animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/groups")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{group.name}</h1>
            {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
          </div>
        </div>

        {/* Summary */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <MoneyDisplay amount={totalExpenses} currency={group.currency} size="xl" />
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{members.length} members</p>
                <p className="text-xs text-muted-foreground">{expenses.length} expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settlement Summary (minimum transactions) */}
        <SettlementSummary settlements={settlements} members={members} currency={group.currency} hasExpenses={expenses.length > 0} />

        {/* Pairwise debts: who owes whom */}
        {pairwiseDebts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Who owes whom</h3>
            <div className="space-y-1.5">
              {pairwiseDebts.map((d, i) => (
                <Card key={i} className="border-border/60">
                  <CardContent className="p-3 flex items-center gap-2">
                    <span className="font-medium text-sm truncate flex-1 text-right text-destructive">
                      {getMemberName(d.from)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <MoneyDisplay amount={d.amount} currency={group.currency} className="text-sm font-semibold text-primary shrink-0" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate flex-1 text-emerald-600">
                      {getMemberName(d.to)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}


        {/* Members */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </h2>
            {isCreator && (
              <Button size="sm" variant="outline" onClick={() => setShowAddMember(!showAddMember)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>

          {showAddMember && (
            <div className="relative">
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search contacts..."
                icon={<Search className="h-4 w-4" />}
                autoFocus
              />
              {memberSearch && filteredContacts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredContacts.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left"
                      onClick={async () => {
                        await addMember({ phone_number: c.phone_number, nickname: c.nickname || undefined });
                        setMemberSearch("");
                        setShowAddMember(false);
                      }}
                    >
                      <AvatarCustom name={c.nickname || c.phone_number} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.nickname || c.phone_number}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {members.map((m) => {
              const balance = memberBalances.get(m.id) || 0;
              const totalPaid = getMemberExpenses(m.id).reduce((s, e) => s + e.amount, 0);
              const totalOwed = getMemberOwedShare(m.id);
              const isExpanded = expandedMember === m.id;

              return (
                <Card key={m.id} className="overflow-hidden">
                  <CardContent
                    className="p-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                  >
                    <AvatarCustom name={m.nickname || m.phone_number} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.nickname || m.phone_number}</p>
                      <p className="text-xs text-muted-foreground">{m.phone_number}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <MoneyDisplay
                        amount={Math.abs(balance)}
                        currency={group.currency}
                        size="sm"
                        className={cn(
                          "font-semibold",
                          balance > 0.01 ? "text-emerald-600" : balance < -0.01 ? "text-destructive" : "text-muted-foreground"
                        )}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {balance > 0.01 ? "gets back" : balance < -0.01 ? "owes" : "settled"}
                      </p>
                    </div>
                    {isCreator && m.user_id !== user.id && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => { e.stopPropagation(); removeMember(m.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </CardContent>

                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-muted/30 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total paid</span>
                        <MoneyDisplay amount={totalPaid} currency={group.currency} size="sm" className="font-medium" />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Fair share owed</span>
                        <MoneyDisplay amount={totalOwed} currency={group.currency} size="sm" className="font-medium" />
                      </div>
                      <div className="border-t pt-2 flex justify-between text-xs font-semibold">
                        <span>Net balance</span>
                        <MoneyDisplay
                          amount={Math.abs(balance)}
                          currency={group.currency}
                          size="sm"
                          className={balance > 0.01 ? "text-emerald-600" : balance < -0.01 ? "text-destructive" : "text-muted-foreground"}
                        />
                      </div>
                      {getMemberExpenses(m.id).length > 0 && (
                        <div className="border-t pt-2 space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Expenses paid</p>
                          {getMemberExpenses(m.id).map(exp => (
                            <div key={exp.id} className="flex justify-between text-xs">
                              <span className="truncate mr-2">{exp.description || 'Expense'}</span>
                              <MoneyDisplay amount={exp.amount} currency={group.currency} size="sm" />
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Who this member owes / is owed */}
                      {settlements.filter(s => s.from === m.id || s.to === m.id).length > 0 && (
                        <div className="border-t pt-2 space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Settlements</p>
                          {settlements.filter(s => s.from === m.id).map((s, i) => (
                            <div key={`owe-${i}`} className="flex justify-between text-xs">
                              <span className="text-destructive">Owes {getMemberName(s.to)}</span>
                              <MoneyDisplay amount={s.amount} currency={group.currency} size="sm" className="text-destructive" />
                            </div>
                          ))}
                          {settlements.filter(s => s.to === m.id).map((s, i) => (
                            <div key={`get-${i}`} className="flex justify-between text-xs">
                              <span className="text-emerald-600">Gets from {getMemberName(s.from)}</span>
                              <MoneyDisplay amount={s.amount} currency={group.currency} size="sm" className="text-emerald-600" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Expenses */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Expenses ({expenses.length})
            </h2>
            <Button size="sm" onClick={() => setShowAddExpense(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {expenses.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No expenses yet. Add your first expense!
              </CardContent>
            </Card>
          ) : (
            expenses.map((expense) => (
              <Card key={expense.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{expense.description || 'Expense'}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid by {getMemberName(expense.paid_by_member_id)} • {format(new Date(expense.created_at), "MMM d")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MoneyDisplay amount={expense.amount} currency={group.currency} size="sm" className="font-semibold" />
                      {isCreator && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteExpenseId(expense.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <AddGroupExpenseDialog
        open={showAddExpense}
        onOpenChange={setShowAddExpense}
        members={members}
        onSubmit={addExpense}
      />

      <AlertDialog open={!!deleteExpenseId} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteExpenseId) await deleteExpense(deleteExpenseId);
                setDeleteExpenseId(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
