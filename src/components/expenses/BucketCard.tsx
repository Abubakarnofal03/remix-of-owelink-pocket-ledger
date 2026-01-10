import { ExpenseBucket } from "@/hooks/useExpenseBuckets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${bucket.color}20` }}
            >
              <Folder className="h-5 w-5" style={{ color: bucket.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{bucket.name}</h3>
              <p className="text-xs text-muted-foreground">
                {expenseCount} expense{expenseCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="font-semibold text-destructive">
                <MoneyDisplay amount={total} currency={currency} />
              </p>
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
      </CardContent>
    </Card>
  );
}
