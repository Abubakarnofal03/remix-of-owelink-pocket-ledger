import { IOU } from "@/hooks/useIOUs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { format } from "date-fns";
import { Calendar, ChevronRight, ArrowDownLeft, ArrowUpRight, Archive } from "lucide-react";
import { Link } from "react-router-dom";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/hooks/useAuth";

interface IOUCardProps {
  iou: IOU;
}

export function IOUCard({ iou }: IOUCardProps) {
  const { contacts } = useContacts();
  const { user } = useAuth();
  
  const isCreditor = iou.creditor_id === user?.id;
  const isArchived = iou.deleted_at !== null;
  const progress = iou.amount > 0 ? (iou.amount_paid / iou.amount) * 100 : 0;
  const remaining = iou.amount - iou.amount_paid;

  const getContactName = (phone: string) => {
    const contact = contacts.find(c => c.phone_number === phone);
    return contact?.nickname || phone;
  };

  const debtorName = getContactName(iou.debtor_phone_number);

  return (
    <Link to={`/ious/${iou.id}`} className="block">
      <div className="card-elevated p-4 hover:ring-2 hover:ring-primary/20 transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <AvatarCustom name={debtorName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">{debtorName}</h3>
                {isArchived && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 px-2 py-0.5 rounded-full shrink-0">
                    <Archive className="h-3 w-3" />
                    Archived
                  </span>
                )}
                {isCreditor ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    <ArrowDownLeft className="h-3 w-3" />
                    owes you
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full">
                    <ArrowUpRight className="h-3 w-3" />
                    you owe
                  </span>
                )}
              </div>
              {iou.description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {iou.description}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={iou.status as any} />
        </div>

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {isCreditor ? "Remaining" : "You owe"}
            </p>
            <MoneyDisplay 
              amount={remaining} 
              currency={iou.currency} 
              size="lg" 
              className={isCreditor ? "text-emerald-600" : "text-rose-600"}
            />
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Total</p>
            <MoneyDisplay amount={iou.amount} currency={iou.currency} size="sm" />
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
          <p className="text-xs text-muted-foreground">
            {progress.toFixed(0)}% paid
          </p>

          {iou.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Due {format(new Date(iou.due_date), "MMM d")}</span>
            </div>
          )}

          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}
