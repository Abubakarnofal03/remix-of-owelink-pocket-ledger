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
import { calculateBalances, simplifyDebts } from "@/lib/debtSimplification";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Users, Receipt, Trash2, UserPlus } from "lucide-react";
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

        {/* Settlement Summary */}
        <SettlementSummary settlements={settlements} members={members} currency={group.currency} />

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
            {members.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <AvatarCustom name={m.nickname || m.phone_number} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.nickname || m.phone_number}</p>
                    <p className="text-xs text-muted-foreground">{m.phone_number}</p>
                  </div>
                  {isCreator && m.user_id !== user.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeMember(m.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
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
