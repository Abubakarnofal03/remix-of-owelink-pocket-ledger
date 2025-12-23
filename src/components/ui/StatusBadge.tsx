import { memo } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";

interface StatusBadgeProps {
  status: "pending" | "partial" | "paid" | "overdue";
  className?: string;
}

export const StatusBadge = memo(function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
        {
          "status-pending": status === "pending",
          "status-partial": status === "partial",
          "status-paid": status === "paid",
          "status-overdue": status === "overdue",
        },
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
});
