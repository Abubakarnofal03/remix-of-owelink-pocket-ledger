import { Bill } from "@/hooks/useBills";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { format } from "date-fns";
import { Calendar, Users, ChevronRight, Crown, UserCheck, Archive } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface BillCardProps {
  bill: Bill;
}

export function BillCard({ bill }: BillCardProps) {
  const { user } = useAuth();
  const participantCount = bill.participants?.length || 0;
  const paidCount = bill.participants?.filter(p => p.status === "paid").length || 0;
  const totalPaid = bill.participants?.reduce((sum, p) => sum + p.amount_paid, 0) || 0;
  const progress = bill.total_amount > 0 ? (totalPaid / bill.total_amount) * 100 : 0;
  
  const isCreator = user?.id === bill.creator_id;
  const isArchived = bill.deleted_at !== null;

  return (
    <Link to={`/bills/${bill.id}`} className="block">
      <div className={cn(
        "card-elevated p-4 hover:ring-2 hover:ring-primary/20 transition-all",
        isCreator ? "border-l-4 border-l-primary" : "border-l-4 border-l-secondary"
      )}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">{bill.title}</h3>
              {isArchived && (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 px-2 py-0.5 rounded-full shrink-0">
                  <Archive className="h-3 w-3" />
                  Archived
                </span>
              )}
              {isCreator ? (
                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                  <Crown className="h-3 w-3" />
                  Creator
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded-full shrink-0">
                  <UserCheck className="h-3 w-3" />
                  Shared
                </span>
              )}
            </div>
            {bill.description && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {bill.description}
              </p>
            )}
          </div>
          <StatusBadge status={bill.status as any} />
        </div>

        <div className="flex items-center justify-between mb-3">
          <MoneyDisplay amount={bill.total_amount} currency={bill.currency} size="lg" />
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{paidCount}/{participantCount} paid</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Participant avatars */}
          <div className="flex -space-x-2">
            {bill.participants?.slice(0, 4).map((p, i) => (
              <AvatarCustom
                key={p.id}
                name={p.phone_number}
                size="xs"
                className="ring-2 ring-background"
              />
            ))}
            {participantCount > 4 && (
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium ring-2 ring-background">
                +{participantCount - 4}
              </div>
            )}
          </div>

          {/* Due date */}
          {bill.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Due {format(new Date(bill.due_date), "MMM d")}</span>
            </div>
          )}

          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}
