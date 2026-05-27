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
import { Badge } from "@/components/ui/badge";
import { AddGroupExpenseDialog } from "@/components/groups/AddGroupExpenseDialog";
import { SettlementSummary } from "@/components/groups/SettlementSummary";
import { calculateBalances, simplifyDebts, calculatePairwiseDebts } from "@/lib/debtSimplification";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { processAllPendingSync } from "@/lib/offline/syncQueue";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, Users, Receipt, Trash2, UserPlus, ArrowRight, ShieldCheck, ChevronDown, Crown } from "lucide-react";
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

export default function GroupExpenseDetail() {
  const { user, loading: authLoading } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { group, members, expenses, loading, isCreator, isAdmin, addMember, removeMember, addExpense, deleteExpense, setCoCreator, refetch } = useExpenseGroupDetail(id);
  const { contacts } = useContacts();

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);

  // All calculations are offline-first: derived from local Dexie state via useExpenseGroupDetail
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

  const getMemberName = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    return member?.nickname || member?.phone_number || 'Unknown';
  };

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
      <div className="space-y-5 pb-24 animate-fade-in">

        {/* Header */}
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/groups")} className="-ml-2 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0 pt-1.5">
            <h1 className="text-lg font-bold leading-tight truncate">{group.name}</h1>
            {group.description && <p className="text-xs text-muted-foreground line-clamp-2">{group.description}</p>}
          </div>
        </div>

        {/* Member avatar row */}
        {members.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
            {members.map((m) => {
              const isMeMember = m.user_id === user.id;
              const isCo = m.is_co_creator === true;
              const isOwner = group.creator_id === m.user_id;
              return (
                <div key={m.id} className="flex flex-col items-center shrink-0 w-14">
                  <div className="relative">
                    <AvatarCustom name={m.nickname || m.phone_number} size="md" />
                    {isOwner && (
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5">
                        <Crown className="h-2.5 w-2.5" />
                      </span>
                    )}
                    {!isOwner && isCo && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <ShieldCheck className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-center mt-1 truncate w-full text-muted-foreground">
                    {isMeMember ? 'You' : (m.nickname || m.phone_number).split(' ')[0]}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <MoneyDisplay amount={totalExpenses} currency={group.currency} size="xl" />
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
                <p className="text-xs text-muted-foreground">{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settlement Summary (minimum transactions) */}
        <SettlementSummary settlements={settlements} members={members} currency={group.currency} hasExpenses={expenses.length > 0} />

        {/* Pairwise debts */}
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
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </h2>
            {isAdmin && (
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

          <div className="space-y-1.5">
            {members.map((m) => {
              const balance = memberBalances.get(m.id) || 0;
              const isOwner = group.creator_id === m.user_id;
              const isCo = m.is_co_creator === true;
              const isMe = m.user_id === user.id;

              return (
                <Card key={m.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <AvatarCustom name={m.nickname || m.phone_number} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">{m.nickname || m.phone_number}</p>
                        {isOwner && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] gap-0.5">
                            <Crown className="h-2.5 w-2.5" />Creator
                          </Badge>
                        )}
                        {!isOwner && isCo && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] gap-0.5">
                            <ShieldCheck className="h-2.5 w-2.5" />Co-creator
                          </Badge>
                        )}
                        {isMe && <span className="text-[10px] text-muted-foreground">(You)</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{m.phone_number}</p>
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
                    {isCreator && !isOwner && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={isCo ? "Remove co-creator role" : "Make co-creator"}
                          onClick={() => setCoCreator(m.id, !isCo)}
                        >
                          <ShieldCheck className={cn("h-4 w-4", isCo ? "text-primary" : "text-muted-foreground")} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(m.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Expenses */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
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
            <div className="space-y-1.5">
              {expenses.map((expense) => {
                const isOpen = expandedExpense === expense.id;
                const payer = members.find(m => m.id === expense.paid_by_member_id);
                const share = members.length > 0 ? expense.amount / members.length : 0;
                return (
                  <Card key={expense.id} className="overflow-hidden">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedExpense(isOpen ? null : expense.id)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <AvatarCustom name={payer?.nickname || payer?.phone_number || '?'} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {expense.description?.trim() || 'Expense'}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {getMemberName(expense.paid_by_member_id)} paid · {format(new Date(expense.created_at), "MMM d")}
                          </p>
                        </div>
                        <MoneyDisplay amount={expense.amount} currency={group.currency} size="sm" className="font-semibold shrink-0" />
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", isOpen && "rotate-180")} />
                      </CardContent>
                    </button>

                    {isOpen && (
                      <div className="border-t px-3 py-3 bg-muted/30 space-y-2 text-xs">
                        {expense.description?.trim() && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Description</p>
                            <p className="text-foreground whitespace-pre-wrap">{expense.description}</p>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Split</span>
                          <span className="font-medium capitalize">{expense.split_type}</span>
                        </div>
                        {expense.split_type === 'equal' && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Each person's share</span>
                            <MoneyDisplay amount={share} currency={group.currency} size="sm" className="font-medium" />
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date</span>
                          <span>{format(new Date(expense.created_at), "MMM d, yyyy · h:mm a")}</span>
                        </div>
                        {isAdmin && (
                          <div className="pt-1 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteExpenseId(expense.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </PullToRefresh>

      <AddGroupExpenseDialog
        open={showAddExpense}
        onOpenChange={setShowAddExpense}
        members={members}
        isCreator={isAdmin}
        currentUserMemberId={currentUserMember?.id || null}
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
