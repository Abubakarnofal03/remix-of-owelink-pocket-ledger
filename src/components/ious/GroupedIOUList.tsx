import { useMemo } from "react";
import { IOU } from "@/hooks/useIOUs";
import { IOUCard } from "./IOUCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { formatPhoneForWhatsApp } from "@/lib/phoneUtils";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface GroupedIOUListProps {
  ious: IOU[];
  loading?: boolean;
  isCreditor?: boolean; // true = "owed to me", false = "I owe"
}

interface DebtorGroup {
  phone: string;
  name: string;
  ious: IOU[];
  totalOwed: number;
  totalPaid: number;
  currency: string;
  pendingIOUs: IOU[];
}

export function GroupedIOUList({ ious, loading, isCreditor = true }: GroupedIOUListProps) {
  const { contacts } = useContacts();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Get contact name from phone number
  const getContactName = (phone: string): string => {
    const contact = contacts.find(c => 
      c.phone_number === phone || 
      c.phone_suffix === phone.replace(/[^0-9]/g, '').slice(-10)
    );
    return contact?.nickname || phone;
  };

  // Group IOUs by debtor phone
  const groups = useMemo((): DebtorGroup[] => {
    const groupMap = new Map<string, DebtorGroup>();

    ious.forEach(iou => {
      const phone = iou.debtor_phone_number;
      const suffix = phone.replace(/[^0-9]/g, '').slice(-10);
      
      if (!groupMap.has(suffix)) {
        groupMap.set(suffix, {
          phone,
          name: getContactName(phone),
          ious: [],
          totalOwed: 0,
          totalPaid: 0,
          currency: iou.currency,
          pendingIOUs: [],
        });
      }

      const group = groupMap.get(suffix)!;
      group.ious.push(iou);
      group.totalOwed += iou.amount;
      group.totalPaid += iou.amount_paid;
      
      // Track pending (unpaid) IOUs
      if (iou.status !== 'paid' && iou.amount_paid < iou.amount) {
        group.pendingIOUs.push(iou);
      }
    });

    // Sort groups by total remaining amount (highest first)
    return Array.from(groupMap.values()).sort((a, b) => 
      (b.totalOwed - b.totalPaid) - (a.totalOwed - a.totalPaid)
    );
  }, [ious, contacts]);

  // Toggle group expansion
  const toggleGroup = (phone: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(phone)) {
        next.delete(phone);
      } else {
        next.add(phone);
      }
      return next;
    });
  };

  // Generate WhatsApp message for a debtor's pending IOUs
  const generateWhatsAppMessage = (group: DebtorGroup): string => {
    const totalRemaining = group.pendingIOUs.reduce(
      (sum, iou) => sum + (iou.amount - iou.amount_paid), 0
    );

    let message = `Hi ${group.name}! 👋\n\n`;
    message += `This is a friendly reminder about your pending payments:\n\n`;

    group.pendingIOUs.forEach((iou, index) => {
      const remaining = iou.amount - iou.amount_paid;
      message += `${index + 1}. ${iou.description || 'IOU'}\n`;
      message += `   Amount: ${group.currency} ${iou.amount.toLocaleString()}\n`;
      if (iou.amount_paid > 0) {
        message += `   Paid: ${group.currency} ${iou.amount_paid.toLocaleString()}\n`;
        message += `   Remaining: ${group.currency} ${remaining.toLocaleString()}\n`;
      }
      if (iou.due_date) {
        message += `   Due: ${new Date(iou.due_date).toLocaleDateString()}\n`;
      }
      message += `\n`;
    });

    message += `📊 *Total Pending: ${group.currency} ${totalRemaining.toLocaleString()}*\n\n`;
    message += `Please settle at your earliest convenience. Thank you! 🙏\n\n`;
    message += `— Sent via Hisaab Kitaab (https://play.google.com/store/apps/details?id=app.lovable.c4b29d3de8d347a9bddd8699314dcb44)`;

    return message;
  };

  // Open WhatsApp with pre-filled message
  const openWhatsApp = (group: DebtorGroup) => {
    const message = generateWhatsAppMessage(group);
    const phone = formatPhoneForWhatsApp(group.phone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card-elevated p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.phone) || group.ious.length <= 2;
        const remaining = group.totalOwed - group.totalPaid;
        const hasPending = group.pendingIOUs.length > 0;

        return (
          <div key={group.phone} className="rounded-2xl overflow-hidden border-2 border-primary/20 bg-card shadow-lg">
            {/* Group Header - More prominent */}
            <div className="p-4 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 border-b-2 border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="ring-2 ring-primary/30 rounded-full">
                    <AvatarCustom name={group.name} size="lg" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{group.name}</h3>
                    <p className="text-sm text-muted-foreground font-medium">
                      {group.ious.length} IOU{group.ious.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* WhatsApp button - only show for creditor with pending IOUs */}
                {isCreditor && hasPending && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      openWhatsApp(group);
                    }}
                    className="h-10 w-10 rounded-full text-green-600 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-950"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {/* Totals - More prominent */}
              <div className="grid grid-cols-3 gap-3 mt-4 p-3 rounded-xl bg-background/80 border border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {isCreditor ? "Total Owed" : "You Owe"}
                  </p>
                  <MoneyDisplay 
                    amount={remaining} 
                    currency={group.currency} 
                    size="xl"
                    className={isCreditor ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Paid</p>
                  <MoneyDisplay 
                    amount={group.totalPaid} 
                    currency={group.currency} 
                    size="sm"
                    className="text-muted-foreground"
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total</p>
                  <MoneyDisplay 
                    amount={group.totalOwed} 
                    currency={group.currency} 
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* IOUs List - Subtle nested cards */}
            <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(group.phone)}>
              <div className="p-3 space-y-2 bg-muted/20">
                {/* Show first 2 IOUs always */}
                {group.ious.slice(0, 2).map((iou) => (
                  <div key={iou.id} className="ml-2 border-l-2 border-primary/20 pl-2">
                    <IOUCard iou={iou} />
                  </div>
                ))}

                {/* Collapsible content for remaining IOUs */}
                {group.ious.length > 2 && (
                  <>
                    <CollapsibleContent className="space-y-2">
                      {group.ious.slice(2).map((iou) => (
                        <div key={iou.id} className="ml-2 border-l-2 border-primary/20 pl-2">
                          <IOUCard iou={iou} />
                        </div>
                      ))}
                    </CollapsibleContent>

                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full mt-2 text-primary">
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Show {group.ious.length - 2} more
                          </>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </>
                )}
              </div>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
