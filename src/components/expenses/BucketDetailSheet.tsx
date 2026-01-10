import { ExpenseBucket } from "@/hooks/useExpenseBuckets";
import { Expense } from "@/hooks/useExpenses";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { ExpenseCard } from "./ExpenseCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Folder, Receipt } from "lucide-react";

interface BucketDetailSheetProps {
  bucket: ExpenseBucket | null;
  expenses: Expense[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteExpense: (id: string) => void;
}

export function BucketDetailSheet({
  bucket,
  expenses,
  currency,
  open,
  onOpenChange,
  onDeleteExpense,
}: BucketDetailSheetProps) {
  if (!bucket) return null;

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${bucket.color}20` }}
            >
              <Folder className="h-6 w-6" style={{ color: bucket.color }} />
            </div>
            <div>
              <SheetTitle>{bucket.name}</SheetTitle>
              <SheetDescription>
                {expenses.length} expense{expenses.length !== 1 ? "s" : ""} •{" "}
                <span className="text-destructive font-medium">
                  <MoneyDisplay amount={total} currency={currency} />
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-2 overflow-y-auto max-h-[calc(85vh-140px)] pb-4">
          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses in this bucket"
              description="Long press on any expense and drag it here"
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
