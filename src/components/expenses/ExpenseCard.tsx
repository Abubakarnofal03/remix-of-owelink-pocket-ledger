import { useState, useRef } from "react";
import { Expense } from "@/hooks/useExpenses";
import { ExpenseBucket } from "@/hooks/useExpenseBuckets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { format } from "date-fns";
import { Wallet, Calendar, Trash2, FolderOpen, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticMedium } from "@/lib/haptics";

interface ExpenseCardProps {
  expense: Expense;
  bucket?: ExpenseBucket | null;
  onDelete: (id: string) => void;
  onDragStart?: (expense: Expense) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  hasBuckets?: boolean;
}

export function ExpenseCard({
  expense,
  bucket,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging,
  hasBuckets = false,
}: ExpenseCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignore if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    
    if (!hasBuckets) return;
    
    pressTimerRef.current = setTimeout(() => {
      setIsPressed(true);
      hapticMedium();
      onDragStart?.(expense);
    }, 400); // Long press threshold
  };

  const handlePointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setIsPressed(false);
  };

  const handlePointerCancel = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setIsPressed(false);
  };

  return (
    <Card
      className={cn(
        "group transition-all duration-200 touch-manipulation select-none",
        isDragging && "opacity-50 scale-95",
        bucket && "border-l-4",
        isPressed && "scale-[0.98] bg-muted/50",
      )}
      style={bucket ? { borderLeftColor: bucket.color } : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Drag handle indicator */}
          {hasBuckets && (
            <div className="flex items-center text-muted-foreground/40 pt-2">
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          
          {/* Icon */}
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: bucket ? `${bucket.color}20` : undefined }}
          >
            {bucket ? (
              <FolderOpen
                className="h-4 w-4"
                style={{ color: bucket.color }}
              />
            ) : (
              <Wallet className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Top row: description + amount */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm truncate flex-1 min-w-0">
                {expense.description || "Expense"}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <p className="font-semibold text-destructive whitespace-nowrap">
                  -<MoneyDisplay amount={expense.amount} currency={expense.currency} />
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(expense.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            
            {/* Bottom row: date + bucket badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(expense.created_at), "MMM d, h:mm a")}</span>
              </div>
              {bucket && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                  style={{
                    backgroundColor: `${bucket.color}20`,
                    color: bucket.color,
                  }}
                >
                  {bucket.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
