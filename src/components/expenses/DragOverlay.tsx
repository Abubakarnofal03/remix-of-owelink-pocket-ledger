import { ExpenseBucket } from "@/hooks/useExpenseBuckets";
import { Expense } from "@/hooks/useExpenses";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Folder, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

interface DragOverlayProps {
  visible: boolean;
  draggingExpense: Expense | null;
  buckets: ExpenseBucket[];
  hoveredBucketId: string | null;
  onBucketHover: (bucketId: string | null) => void;
  onDrop: (bucketId: string | null) => void;
  onCancel: () => void;
}

export function DragOverlay({
  visible,
  draggingExpense,
  buckets,
  hoveredBucketId,
  onBucketHover,
  onDrop,
  onCancel,
}: DragOverlayProps) {
  if (!visible || !draggingExpense) return null;

  const handleBucketSelect = (bucketId: string | null) => {
    hapticLight();
    onDrop(bucketId);
  };

  const handleCancel = () => {
    hapticLight();
    onCancel();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        // Cancel if clicking on backdrop
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div className="flex flex-col h-full p-4 safe-area-all">
        {/* Dragging expense indicator */}
        <div className="text-center mb-6 pt-4">
          <p className="text-sm text-muted-foreground mb-2">Moving expense</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <span className="font-semibold">
              {draggingExpense.description || "Expense"}
            </span>
            <span className="text-primary font-bold">
              <MoneyDisplay
                amount={draggingExpense.amount}
                currency={draggingExpense.currency}
              />
            </span>
          </div>
        </div>

        {/* Bucket grid - tap to select */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-sm text-muted-foreground mb-3 text-center">
            Tap a bucket to move the expense:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {buckets.map((bucket) => {
              const isCurrentBucket = draggingExpense.bucket_id === bucket.id;
              return (
                <button
                  key={bucket.id}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[100px] active:scale-95",
                    isCurrentBucket
                      ? "border-primary/50 bg-primary/5 opacity-50"
                      : "border-muted-foreground/30 bg-card hover:border-primary hover:bg-primary/10"
                  )}
                  onClick={() => !isCurrentBucket && handleBucketSelect(bucket.id)}
                  disabled={isCurrentBucket}
                >
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center relative"
                    style={{ backgroundColor: `${bucket.color}30` }}
                  >
                    <Folder
                      className="h-6 w-6"
                      style={{ color: bucket.color }}
                    />
                    {isCurrentBucket && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="font-medium text-sm text-center">
                    {bucket.name}
                  </span>
                  {isCurrentBucket && (
                    <span className="text-xs text-muted-foreground">Current</span>
                  )}
                </button>
              );
            })}

            {/* Remove from bucket option */}
            {draggingExpense.bucket_id && (
              <button
                className="p-4 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[100px] border-muted-foreground/30 bg-card hover:border-destructive hover:bg-destructive/10 active:scale-95"
                onClick={() => handleBucketSelect(null)}
              >
                <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-muted">
                  <X className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="font-medium text-sm text-center text-muted-foreground">
                  Remove from bucket
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Cancel button */}
        <div className="pt-4 pb-2">
          <button
            className="w-full py-4 rounded-xl border-2 border-muted-foreground/30 text-muted-foreground font-medium transition-colors hover:border-foreground hover:text-foreground active:bg-muted"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}