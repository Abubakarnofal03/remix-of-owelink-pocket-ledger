import { useState } from "react";
import { ExpenseBucket } from "@/hooks/useExpenseBuckets";
import { Expense, ExpenseInsert } from "@/hooks/useExpenses";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { ExpenseCard } from "./ExpenseCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Progress } from "@/components/ui/progress";
import { Folder, Receipt, Plus, Loader2, X, Pencil, Check } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currencies";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BucketDetailSheetProps {
  bucket: ExpenseBucket | null;
  expenses: Expense[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteExpense: (id: string) => void;
  onCreateExpense?: (data: ExpenseInsert) => Promise<Expense | null>;
  onUpdateBudget?: (bucketId: string, budget: number) => Promise<void> | void;
}


export function BucketDetailSheet({
  bucket,
  expenses,
  currency,
  open,
  onOpenChange,
  onDeleteExpense,
  onCreateExpense,
  onUpdateBudget,
}: BucketDetailSheetProps) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  const currencySymbol = getCurrencySymbol(currency);

  if (!bucket) return null;

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const budget = bucket.budget_amount || 0;
  const hasBudget = budget > 0;
  const remaining = budget - total;
  const overspent = remaining < 0;
  const progress = hasBudget ? Math.min(100, (total / budget) * 100) : 0;

  const handleSaveBudget = async () => {
    const v = parseFloat(budgetInput);
    if (isNaN(v) || v < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (onUpdateBudget) {
      await onUpdateBudget(bucket.id, v);
      toast.success("Budget updated");
    }
    setEditingBudget(false);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateExpense) return;

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      await onCreateExpense({
        amount: amountNum,
        description: description.trim() || undefined,
        currency,
        bucket_id: bucket.id,
      });
      setAmount("");
      setDescription("");
      setShowForm(false);
      toast.success("Expense added to bucket");
    } catch {
      toast.error("Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setAmount("");
    setDescription("");
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${bucket.color}20` }}
            >
              <Folder className="h-6 w-6" style={{ color: bucket.color }} />
            </div>
            <div className="flex-1">
              <SheetTitle>{bucket.name}</SheetTitle>
              <SheetDescription>
                {expenses.length} expense{expenses.length !== 1 ? "s" : ""} •{" "}
                <span className="text-destructive font-medium">
                  <MoneyDisplay amount={total} currency={currency} />
                </span>
              </SheetDescription>
            </div>
            {onCreateExpense && !showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Quick Add Form */}
        {showForm && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Add to {bucket.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
                <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(85vh-200px)] pb-4">
          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses in this bucket"
              description={onCreateExpense ? "Tap 'Add' above or long press expenses to drag here" : "Long press on any expense and drag it here"}
            />
          ) : (
            expenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                bucket={bucket}
                onDelete={onDeleteExpense}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
