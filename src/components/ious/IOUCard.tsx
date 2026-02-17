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
  
  const direction = iou.direction || 'owed_to_me';
  const isCreator = iou.creditor_id === user?.id;
  const isArchived = iou.deleted_at !== null;
  const progress = iou.amount > 0 ? (iou.amount_paid / iou.amount) * 100 : 0;
  const remaining = iou.amount - iou.amount_paid;

  const getContactName = (phone: string) => {
    const contact = contacts.find(c => c.phone_number === phone);
    return contact?.nickname || phone;
  };

  // Determine display based on direction
  // For 'owed_to_me': creator is creditor, other person is debtor -> other person "owes you"
  // For 'i_owe': creator is debtor, other person is creditor -> you "owe" the other person
  const isOwedToMe = isCreator
    ? direction === 'owed_to_me'
    : direction === 'i_owe'; // If I'm the other person in an 'i_owe', someone owes me

  // The "other person" is always stored in debtor_phone_number
  const otherPersonName = isCreator
    ? getContactName(iou.debtor_phone_number)
    : (iou.creditor_username || getContactName(iou.creditor_phone_number || '') || 'Unknown');
  
  const displayName = otherPersonName;

  return (
    <Link to={`/ious/${iou.id}`} className="block">
      <div className="bg-card rounded-lg p-3 hover:bg-accent/30 transition-all border border-border/50 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AvatarCustom name={displayName} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-sm text-foreground truncate">{displayName}</h4>
                {isArchived && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">
                    <Archive className="h-2.5 w-2.5" />
                    Archived
                  </span>
                )}
                {isOwedToMe ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-full">
                    <ArrowDownLeft className="h-2.5 w-2.5" />
                    owes you
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[10px] text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded-full">
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    you owe
                  </span>
                )}
              </div>
              {iou.description && (
                <p className="text-xs text-muted-foreground truncate">{iou.description}</p>
              )}
            </div>
          </div>
          <StatusBadge status={iou.status as any} className="text-[10px] px-1.5 py-0.5" />
        </div>

        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Remaining</p>
            <MoneyDisplay 
              amount={remaining} 
              currency={iou.currency} 
              size="md" 
              className={isOwedToMe ? "text-emerald-600" : "text-rose-600"}
            />
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
            <MoneyDisplay amount={iou.amount} currency={iou.currency} size="sm" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{progress.toFixed(0)}% paid</span>
          {iou.due_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              <span>Due {format(new Date(iou.due_date), "MMM d")}</span>
            </div>
          )}
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}
