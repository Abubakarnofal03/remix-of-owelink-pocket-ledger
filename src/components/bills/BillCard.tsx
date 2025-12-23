import { memo, useMemo } from "react";
import { Bill } from "@/hooks/useBills";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { format } from "date-fns";
import { Calendar, Users, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface BillCardProps {
  bill: Bill;
}

export const BillCard = memo(function BillCard({ bill }: BillCardProps) {
  const { participantCount, paidCount, progress } = useMemo(() => {
    const count = bill.participants?.length || 0;
    const paid = bill.participants?.filter(p => p.status === "paid").length || 0;
    const totalPaid = bill.participants?.reduce((sum, p) => sum + p.amount_paid, 0) || 0;
    const prog = bill.total_amount > 0 ? (totalPaid / bill.total_amount) * 100 : 0;
    return { participantCount: count, paidCount: paid, progress: prog };
  }, [bill.participants, bill.total_amount]);

  const formattedDueDate = useMemo(() => 
    bill.due_date ? format(new Date(bill.due_date), "MMM d") : null,
    [bill.due_date]
  );

  const displayedParticipants = useMemo(() => 
    bill.participants?.slice(0, 4) || [],
    [bill.participants]
  );

  return (
    <Link to={`/bills/${bill.id}`} className="block">
      <div className="card-elevated p-4 hover:ring-2 hover:ring-primary/20 transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{bill.title}</h3>
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
            {displayedParticipants.map((p) => (
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
          {formattedDueDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Due {formattedDueDate}</span>
            </div>
          )}

          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
});
