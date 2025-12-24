import { IOU } from "@/hooks/useIOUs";
import { IOUCard } from "./IOUCard";
import { Skeleton } from "@/components/ui/skeleton";

interface IOUListProps {
  ious: IOU[];
  loading?: boolean;
}

export function IOUList({ ious, loading }: IOUListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card-elevated p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (ious.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {ious.map((iou) => (
        <IOUCard key={iou.id} iou={iou} />
      ))}
    </div>
  );
}
