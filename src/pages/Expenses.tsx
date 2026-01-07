import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, ExpenseInsert } from "@/hooks/useExpenses";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrencySymbol } from "@/lib/currencies";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Trash2,
  TrendingUp,
  Calendar,
  Receipt,
  Wallet,
} from "lucide-react";
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

type FilterPeriod = 'day' | 'week' | 'month' | 'all';

export default function Expenses() {
  const { user, currency, loading: authLoading } = useAuth();
  const { expenses, loading, createExpense, deleteExpense, getTotals } = useExpenses();
  const currencySymbol = getCurrencySymbol(currency);

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<FilterPeriod>('month');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { total, count, expenses: filteredExpenses } = getTotals(filter);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      await createExpense({
        amount: amountNum,
        description: description.trim() || undefined,
        currency,
      });
      
      setAmount("");
      setDescription("");
      setShowForm(false);
      toast.success("Expense added");
    } catch (error) {
      toast.error("Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteExpense(deleteId);
    setDeleteId(null);
  };

  const filterLabels: Record<FilterPeriod, string> = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    all: 'All Time',
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <EmptyState
          icon={Wallet}
          title="Sign in to track expenses"
          description="Create an account to start tracking your daily spending"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Expenses</h1>
        </div>

        {/* Total Summary Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">
                    <MoneyDisplay amount={total} currency={currency} />
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{filterLabels[filter]}</p>
                <p className="text-sm font-medium">{count} expense{count !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
              {(['day', 'week', 'month', 'all'] as FilterPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setFilter(period)}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    filter === period
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {period === 'day' ? 'Day' : period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'All'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Add Form */}
        {showForm ? (
          <Card>
            <CardContent className="p-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                      {currencySymbol}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-8"
                      autoFocus
                    />
                  </div>
                </div>
                <Textarea
                  placeholder="What did you spend on? (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowForm(false);
                      setAmount("");
                      setDescription("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Expense
          </Button>
        )}

        {/* Expense List */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={filter === 'all' ? "No expenses yet" : `No expenses ${filterLabels[filter].toLowerCase()}`}
            description="Tap the button above to add your first expense"
          />
        ) : (
          <div className="space-y-2">
            {filteredExpenses.map((expense) => (
              <Card key={expense.id} className="group">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {expense.description || "Expense"}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(expense.created_at), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-destructive">
                        -<MoneyDisplay amount={expense.amount} currency={expense.currency} />
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}