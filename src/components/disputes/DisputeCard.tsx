import { Dispute } from "@/hooks/useDisputes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisputeCardProps {
  dispute: Dispute;
  currency?: string;
  disputerName?: string;
}

const statusConfig = {
  open: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", label: "Open" },
  accepted: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", label: "Accepted" },
  rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Rejected" },
  resolved: { icon: CheckCircle, color: "text-primary", bg: "bg-primary/10", label: "Resolved" },
};

export function DisputeCard({ dispute, currency, disputerName }: DisputeCardProps) {
  const config = statusConfig[dispute.status] || statusConfig.open;
  const Icon = config.icon;

  return (
    <div className={cn("rounded-lg border p-3 space-y-2", config.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
          <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(dispute.created_at), "MMM d, yyyy")}
        </span>
      </div>

      {disputerName && (
        <p className="text-xs text-muted-foreground">
          Filed by <span className="font-medium text-foreground">{disputerName}</span>
        </p>
      )}

      <p className="text-sm text-foreground">{dispute.reason}</p>

      {dispute.proposed_amount !== null && (
        <p className="text-xs text-muted-foreground">
          Proposed: <span className="font-medium text-foreground">{currency} {dispute.proposed_amount.toFixed(2)}</span>
        </p>
      )}

      {dispute.creator_response && (
        <div className="border-t pt-2 mt-2">
          <p className="text-xs text-muted-foreground">Response:</p>
          <p className="text-sm text-foreground">{dispute.creator_response}</p>
        </div>
      )}
    </div>
  );
}
