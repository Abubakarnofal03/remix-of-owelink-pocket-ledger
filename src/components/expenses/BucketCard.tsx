import { ExpenseBucket } from "@/hooks/useExpenseBuckets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Progress } from "@/components/ui/progress";
import { Folder, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BucketCardProps {
  bucket: ExpenseBucket;
  expenseCount: number;
  total: number;
  currency: string;
  onDelete: (id: string) => void;
  onClick: (bucket: ExpenseBucket) => void;
  isDropTarget?: boolean;
  onDrop?: (bucketId: string) => void;
}

export function BucketCard({
  bucket,
  expenseCount,
  total,
  currency,
  onDelete,
  onClick,
  isDropTarget,
  onDrop,
}: BucketCardProps) {
  const budget = bucket.budget_amount || 0;
  const hasBudget = budget > 0;
  const remaining = budget - total;
  const overspent = remaining < 0;
  const progress = hasBudget ? Math.min(100, (total / budget) * 100) : 0;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isDropTarget && "ring-2 ring-primary scale-105 shadow-lg"
      )}
      onClick={() => onClick(bucket)}
      onPointerUp={() => {
        if (isDropTarget && onDrop) {
          onDrop(bucket.id);
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${bucket.color}20` }}
            >
              <Folder className="h-5 w-5" style={{ color: bucket.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm truncate">{bucket.name}</h3>
              <p className="text-xs text-muted-foreground">
                {expenseCount} expense{expenseCount !== 1 ? "s" : ""}
                {hasBudget && (
                  <>
                    {" • Budget "}
                    <MoneyDisplay amount={budget} currency={currency} />
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-right">
              <p className="font-semibold text-destructive text-sm">
                <MoneyDisplay amount={total} currency={currency} />
              </p>
              {hasBudget && (
                <p className={cn("text-[11px] font-medium", overspent ? "text-destructive" : "text-emerald-600 dark:text-emerald-500")}>
                  {overspent ? "Over by " : "Left "}
                  <MoneyDisplay amount={Math.abs(remaining)} currency={currency} />
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(bucket.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {hasBudget && (
          <div className="mt-3">
            <Progress
              value={progress}
              className={cn("h-1.5", overspent && "[&>div]:bg-destructive")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
