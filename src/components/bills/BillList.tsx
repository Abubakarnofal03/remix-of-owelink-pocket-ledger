import { memo, useMemo } from "react";
import { Bill } from "@/hooks/useBills";
import { BillCard } from "./BillCard";
import { Skeleton } from "@/components/ui/skeleton";

interface BillListProps {
  bills: Bill[];
  loading?: boolean;
}

const BillListSkeleton = memo(function BillListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card-elevated p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between">
            <div className="flex -space-x-2">
              {[...Array(3)].map((_, j) => (
                <Skeleton key={j} className="h-6 w-6 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
});

export const BillList = memo(function BillList({ bills, loading }: BillListProps) {
  const renderedBills = useMemo(() => 
    bills.map((bill) => <BillCard key={bill.id} bill={bill} />),
    [bills]
  );

  if (loading) {
    return <BillListSkeleton />;
  }

  if (bills.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {renderedBills}
    </div>
  );
});
