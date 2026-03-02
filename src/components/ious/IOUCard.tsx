import { IOU } from "@/hooks/useIOUs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { format } from "date-fns";
import { Calendar, ChevronRight, ArrowDownLeft, ArrowUpRight, Archive, Receipt, Star, Pin, PinOff, Edit, Trash2, CheckCircle, MessageCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/hooks/useAuth";
import { LongPressMenu, LongPressAction } from "@/components/ui/LongPressMenu";
import { useIOUs } from "@/hooks/useIOUs";
import { formatPhoneForWhatsApp } from "@/lib/phoneUtils";
import { updateIOUOfflineFirst } from "@/lib/offline/offlineDataLayer";
import { useOffline } from "@/hooks/useOffline";
import { toast } from "sonner";

interface IOUCardProps {
  iou: IOU & { source?: 'iou' | 'bill'; sourceBillTitle?: string; sourceBillId?: string };
}

export function IOUCard({ iou }: IOUCardProps) {
  const { contacts } = useContacts();
  const { user, profile } = useAuth();
  const { togglePin, deleteIOU, updateIOUInCache } = useIOUs();
  const { sync } = useOffline();
  const navigate = useNavigate();
  
  const direction = iou.direction || 'owed_to_me';
  const isCreator = iou.creditor_id === user?.id;
  const isArchived = iou.deleted_at !== null;
  const isPinned = iou.is_pinned || false;
  const progress = iou.amount > 0 ? (iou.amount_paid / iou.amount) * 100 : 0;
  const remaining = iou.amount - iou.amount_paid;

  const getContactName = (phone: string) => {
    const contact = contacts.find(c => c.phone_number === phone);
    return contact?.nickname || phone;
  };

  const isOwedToMe = isCreator
    ? direction === 'owed_to_me'
    : direction === 'i_owe';

  const otherPersonName = isCreator
    ? getContactName(iou.debtor_phone_number)
    : (iou.creditor_username || getContactName(iou.creditor_phone_number || '') || 'Unknown');
  
  const displayName = otherPersonName;

  const isBillSourced = (iou as any).source === 'bill';
  const linkTo = isBillSourced ? `/bills/${(iou as any).sourceBillId}` : `/ious/${iou.id}`;

  const handleMarkAsPaid = async () => {
    try {
      await updateIOUOfflineFirst(iou.id, {
        status: "paid",
        amount_paid: iou.amount,
      });
      updateIOUInCache(iou.id, (prev) => ({
        ...prev,
        status: "paid",
        amount_paid: iou.amount,
      }));
      sync();
      toast.success("Marked as paid");
    } catch {
      toast.error("Failed to mark as paid");
    }
  };

  const longPressActions: LongPressAction[] = isBillSourced ? [] : [
    {
      label: isPinned ? "Unpin" : "Pin to top",
      icon: isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />,
      onClick: () => togglePin(iou.id, isPinned),
    },
    {
      label: "View Details",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => navigate(`/ious/${iou.id}`),
    },
    ...((isCreator || (direction === 'i_owe' && !isCreator)) && iou.status !== "paid" ? [{
      label: "Mark as Paid",
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: handleMarkAsPaid,
    }] : []),
    ...(isCreator && direction === 'owed_to_me' && iou.status !== "paid" ? [{
      label: "Send Reminder (WhatsApp)",
      icon: <MessageCircle className="h-4 w-4" />,
      onClick: () => {
        const phone = formatPhoneForWhatsApp(iou.debtor_phone_number);
        const msg = `Reminder: You owe ${iou.currency} ${remaining.toFixed(2)}${iou.description ? ` for "${iou.description}"` : ''}`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      },
    }] : []),
    ...(isCreator ? [{
      label: "Archive",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => deleteIOU(iou.id),
      variant: "destructive" as const,
    }] : []),
  ];

  const card = (
    <Link to={linkTo} className="block">
      <div className={`bg-card rounded-lg p-3 hover:bg-accent/30 transition-all border shadow-sm ${isBillSourced ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/20' : 'border-border/50'}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AvatarCustom name={displayName} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isPinned && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                <h4 className="font-medium text-sm text-foreground truncate">{displayName}</h4>
                {isBillSourced && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 px-1.5 py-0.5 rounded-full shrink-0">
                    <Receipt className="h-2.5 w-2.5" />
                    From Bill
                  </span>
                )}
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

  if (isBillSourced || longPressActions.length === 0) return card;

  return (
    <LongPressMenu actions={longPressActions} title={displayName}>
      {card}
    </LongPressMenu>
  );
}
