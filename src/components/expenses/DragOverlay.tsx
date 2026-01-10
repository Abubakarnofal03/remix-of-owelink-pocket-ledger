import { ExpenseBucket } from "@/hooks/useExpenseBuckets";
import { Expense } from "@/hooks/useExpenses";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Folder, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col h-full p-4 safe-area-all">
        {/* Dragging expense indicator */}
        <div className="text-center mb-6 pt-4">
          <p className="text-sm text-muted-foreground mb-1">Moving expense</p>
          <p className="font-semibold text-lg">
            {draggingExpense.description || "Expense"} •{" "}
            <MoneyDisplay
              amount={draggingExpense.amount}
              currency={draggingExpense.currency}
            />
          </p>
        </div>

        {/* Bucket grid */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-sm text-muted-foreground mb-3">
            Drop on a bucket:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {buckets.map((bucket) => (
              <div
                key={bucket.id}
                className={cn(
                  "p-4 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[100px]",
                  hoveredBucketId === bucket.id
                    ? "border-primary bg-primary/10 scale-105"
                    : "border-muted-foreground/30 bg-card"
                )}
                onPointerEnter={() => onBucketHover(bucket.id)}
                onPointerLeave={() => onBucketHover(null)}
                onPointerUp={() => onDrop(bucket.id)}
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${bucket.color}30` }}
                >
                  <Folder
                    className="h-6 w-6"
                    style={{ color: bucket.color }}
                  />
                </div>
                <span className="font-medium text-sm text-center">
                  {bucket.name}
                </span>
              </div>
            ))}

            {/* Remove from bucket option */}
            {draggingExpense.bucket_id && (
              <div
                className={cn(
                  "p-4 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[100px]",
                  hoveredBucketId === "remove"
                    ? "border-destructive bg-destructive/10 scale-105"
                    : "border-muted-foreground/30 bg-card"
                )}
                onPointerEnter={() => onBucketHover("remove")}
                onPointerLeave={() => onBucketHover(null)}
                onPointerUp={() => onDrop(null)}
              >
                <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-muted">
                  <X className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="font-medium text-sm text-center text-muted-foreground">
                  Remove from bucket
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Cancel button */}
        <div className="pt-4 pb-2">
          <button
            className="w-full py-4 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground font-medium transition-colors hover:border-muted-foreground hover:text-foreground"
            onPointerUp={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
