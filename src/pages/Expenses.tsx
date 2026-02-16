import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, Expense } from "@/hooks/useExpenses";
import { useExpenseBuckets } from "@/hooks/useExpenseBuckets";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExpenseCard } from "@/components/expenses/ExpenseCard";
import { BucketCard } from "@/components/expenses/BucketCard";
import { CreateBucketDialog } from "@/components/expenses/CreateBucketDialog";
import { DragOverlay } from "@/components/expenses/DragOverlay";
import { BucketDetailSheet } from "@/components/expenses/BucketDetailSheet";
import { getCurrencySymbol } from "@/lib/currencies";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  TrendingUp,
  Receipt,
  Wallet,
  FolderPlus,
  Download,
} from "lucide-react";
import { MiniCalculator } from "@/components/ui/MiniCalculator";
import { exportExpensesPDF } from "@/lib/pdfExport";
import { FirstVisitTip } from "@/components/ui/FirstVisitTip";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FilterPeriod = "day" | "week" | "month" | "all";

export default function Expenses() {
  const { user, currency, loading: authLoading } = useAuth();
  const { expenses, loading, createExpense, deleteExpense, assignToBucket, getExpensesByBucket, getTotals } = useExpenses();
  const { buckets, createBucket, deleteBucket } = useExpenseBuckets();
  const currencySymbol = getCurrencySymbol(currency);

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<FilterPeriod>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBucketId, setDeleteBucketId] = useState<string | null>(null);
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Drag and drop state
  const [draggingExpense, setDraggingExpense] = useState<Expense | null>(null);
  const [hoveredBucketId, setHoveredBucketId] = useState<string | null>(null);

  // Bucket detail sheet
  const [selectedBucket, setSelectedBucket] = useState<typeof buckets[0] | null>(null);

  const { total, count, expenses: filteredExpenses } = getTotals(filter);
  const unbucketedExpenses = filteredExpenses.filter((e) => !e.bucket_id);

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
    } catch {
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

  const handleDeleteBucket = async () => {
    if (!deleteBucketId) return;
    await deleteBucket(deleteBucketId);
    setDeleteBucketId(null);
  };

  const handleDragStart = (expense: Expense) => {
    if (buckets.length === 0) {
      toast.error("Create a bucket first to organize expenses");
      return;
    }
    setDraggingExpense(expense);
  };

  const handleDrop = async (bucketId: string | null) => {
    if (!draggingExpense) return;
    
    const targetBucketId = bucketId === "remove" ? null : bucketId;
    if (draggingExpense.bucket_id !== targetBucketId) {
      await assignToBucket(draggingExpense.id, targetBucketId);
      const bucket = buckets.find((b) => b.id === targetBucketId);
      toast.success(bucket ? `Moved to ${bucket.name}` : "Removed from bucket");
    }
    setDraggingExpense(null);
    setHoveredBucketId(null);
  };

  const filterLabels: Record<FilterPeriod, string> = {
    day: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time",
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
        <FirstVisitTip
          storageKey="expenses"
          message="Keep track of where your money goes. Add daily expenses, organize them into buckets, and see your spending trends over time."
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Expenses</h1>
          <div className="flex gap-2">
            {filteredExpenses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => { await exportExpensesPDF(filteredExpenses, buckets, currency, filterLabels[filter]); }}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowCreateBucket(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />
              Bucket
            </Button>
          </div>
        </div>

        {/* Total Summary Card */}
        <Card 
          className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20"
          data-tour="expense-summary"
        >
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
                <p className="text-sm font-medium">{count} expense{count !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
              {(["day", "week", "month", "all"] as FilterPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setFilter(period)}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    filter === period
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {period === "day" ? "Day" : period === "week" ? "Week" : period === "month" ? "Month" : "All"}
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
                  <MiniCalculator onInsert={(val) => setAmount(val.toString())} />
                </div>
                <Textarea
                  placeholder="What did you spend on? (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowForm(false); setAmount(""); setDescription(""); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setShowForm(true)} className="w-full" size="lg" data-tour="add-expense-btn">
            <Plus className="h-5 w-5 mr-2" />
            Add Expense
          </Button>
        )}

        {/* Tabs: All Expenses vs Buckets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-tour="expense-tabs">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All Expenses</TabsTrigger>
            <TabsTrigger value="buckets">Buckets ({buckets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredExpenses.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={filter === "all" ? "No expenses yet" : `No expenses ${filterLabels[filter].toLowerCase()}`}
                description={filter === "all" ? "Keep track of where your money goes. Tap the button above to get started." : "Tap the button above to add your first expense"}
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground px-1">
                  {buckets.length > 0 && "Long press to organize expenses into buckets"}
                </p>
                {filteredExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    bucket={buckets.find((b) => b.id === expense.bucket_id)}
                    onDelete={setDeleteId}
                    onDragStart={handleDragStart}
                    onDragEnd={() => setDraggingExpense(null)}
                    isDragging={draggingExpense?.id === expense.id}
                    hasBuckets={buckets.length > 0}
                  />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="buckets" className="mt-4 space-y-3">
            {buckets.length === 0 ? (
              <EmptyState
                icon={FolderPlus}
                title="No buckets yet"
                description="Create buckets to organize related expenses"
                action={{ label: "Create Bucket", onClick: () => setShowCreateBucket(true) }}
              />
            ) : (
              buckets.map((bucket) => {
                const bucketExpenses = getExpensesByBucket(bucket.id);
                const bucketTotal = bucketExpenses.reduce((sum, e) => sum + e.amount, 0);
                return (
                  <BucketCard
                    key={bucket.id}
                    bucket={bucket}
                    expenseCount={bucketExpenses.length}
                    total={bucketTotal}
                    currency={currency}
                    onDelete={setDeleteBucketId}
                    onClick={setSelectedBucket}
                  />
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Drag overlay */}
      <DragOverlay
        visible={!!draggingExpense}
        draggingExpense={draggingExpense}
        buckets={buckets}
        hoveredBucketId={hoveredBucketId}
        onBucketHover={setHoveredBucketId}
        onDrop={handleDrop}
        onCancel={() => { setDraggingExpense(null); setHoveredBucketId(null); }}
      />

      {/* Bucket detail sheet */}
      <BucketDetailSheet
        bucket={selectedBucket}
        expenses={selectedBucket ? getExpensesByBucket(selectedBucket.id) : []}
        currency={currency}
        open={!!selectedBucket}
        onOpenChange={(open) => !open && setSelectedBucket(null)}
        onDeleteExpense={setDeleteId}
        onCreateExpense={createExpense}
      />

      {/* Create bucket dialog */}
      <CreateBucketDialog open={showCreateBucket} onOpenChange={setShowCreateBucket} onCreate={createBucket} />

      {/* Delete expense confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete bucket confirmation */}
      <AlertDialog open={!!deleteBucketId} onOpenChange={() => setDeleteBucketId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bucket?</AlertDialogTitle>
            <AlertDialogDescription>Expenses in this bucket will not be deleted, just unassigned.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBucket} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
