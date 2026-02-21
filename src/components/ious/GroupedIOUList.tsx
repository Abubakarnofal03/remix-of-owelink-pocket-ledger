import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IOU } from "@/hooks/useIOUs";
import { IOUCard } from "./IOUCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronDown, ChevronUp, Plus, Phone, User } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { formatPhoneForWhatsApp } from "@/lib/phoneUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface GroupedIOUListProps {
  ious: IOU[];
  loading?: boolean;
  isCreditor?: boolean; // true = "owed to me", false = "I owe"
  contactsLoading?: boolean;
}

interface PersonGroup {
  phone: string;
  name: string;
  ious: IOU[];
  totalOwed: number;
  totalPaid: number;
  currency: string;
  pendingIOUs: IOU[];
}

export function GroupedIOUList({ ious, loading, isCreditor = true, contactsLoading = false }: GroupedIOUListProps) {
  const { contacts } = useContacts();
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Get contact name from phone number
  const getContactName = (phone: string): string => {
    const contact = contacts.find(c => 
      c.phone_number === phone || 
      c.phone_suffix === phone.replace(/[^0-9]/g, '').slice(-10)
    );
    return contact?.nickname || phone;
  };

  // Group IOUs by the other party (debtor for creditors, creditor for debtors)
  const groups = useMemo((): PersonGroup[] => {
    const groupMap = new Map<string, PersonGroup>();

    ious.forEach(iou => {
      // For creditor view, group by debtor. For debtor view, group by creditor.
      const phone = isCreditor 
        ? iou.debtor_phone_number 
        : (iou.creditor_phone_number || '');
      const suffix = phone.replace(/[^0-9]/g, '').slice(-10);
      
      // Get the appropriate name
      const name = isCreditor 
        ? getContactName(iou.debtor_phone_number)
        : (iou.creditor_username || getContactName(phone) || 'Unknown');
      
      if (!groupMap.has(suffix)) {
        groupMap.set(suffix, {
          phone,
          name,
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
  }, [ious, contacts, isCreditor]);

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

  // Generate WhatsApp message for a debtor's pending IOUs (only for creditors)
  const generateWhatsAppMessage = (group: PersonGroup): string => {
    const totalRemaining = group.pendingIOUs.reduce(
      (sum, iou) => sum + (iou.amount - iou.amount_paid), 0
    );

    let message = `Hi ${group.name}! 👋\n\n`;
    message += `This is a friendly reminder about your pending payments:\n\n`;

    group.pendingIOUs.forEach((iou, index) => {
      const remaining = iou.amount - iou.amount_paid;
      message += `${index + 1}. ${iou.description || 'Owe'}\n`;
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
    message += `---\n📱 *Tired of tracking who owes you?*\nDownload OweLink - your smart money tracker!\nNever lose track of debts again.\n🔗 Get OweLink now!`;

    return message;
  };

  // Open WhatsApp with pre-filled message
  const openWhatsApp = (group: PersonGroup) => {
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
            {/* Group Header - More prominent with person details */}
            <div className="p-4 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 border-b-2 border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="ring-2 ring-primary/30 rounded-full">
                    <AvatarCustom name={group.name} size="lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-foreground truncate">
                      {contactsLoading ? <Skeleton className="h-5 w-28 inline-block" /> : group.name}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {contactsLoading ? <Skeleton className="h-3 w-20 inline-block" /> : group.phone}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {group.ious.length} record{group.ious.length !== 1 ? 's' : ''} • {group.pendingIOUs.length} pending
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Contact button */}
                  {(() => {
                    const contact = contacts.find(c =>
                      c.phone_number === group.phone ||
                      c.phone_suffix === group.phone.replace(/[^0-9]/g, '').slice(-10)
                    );
                    return contact ? (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/contacts/${contact.id}`);
                        }}
                        className="h-10 w-10 rounded-full border-border hover:bg-accent"
                        title={`View ${group.name}'s contact`}
                      >
                        <User className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    ) : null;
                  })()}

                  {/* Add IOU button - only show for creditor */}
                  {isCreditor && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/ious/new?phone=${encodeURIComponent(group.phone)}&name=${encodeURIComponent(group.name)}`);
                      }}
                      className="h-10 w-10 rounded-full border-primary/30 hover:bg-primary/10"
                      title={`Add another IOU for ${group.name}`}
                    >
                      <Plus className="h-5 w-5 text-primary" />
                    </Button>
                  )}
                  
                  {/* WhatsApp button - only show for creditor with pending IOUs */}
                  {isCreditor && hasPending && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        openWhatsApp(group);
                      }}
                      className="h-10 w-10 rounded-full text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700 dark:hover:bg-emerald-950"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Totals - Responsive layout */}
              <div className="mt-4 p-3 rounded-xl bg-background/80 border border-border/50">
                {/* Main amount - full width on small screens */}
                <div className="mb-3">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    {isCreditor ? "Total Owed" : "You Owe"}
                  </p>
                  <MoneyDisplay 
                    amount={remaining} 
                    currency={group.currency} 
                    size="lg"
                    className={cn(
                      "block truncate",
                      isCreditor ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"
                    )}
                  />
                </div>
                {/* Secondary amounts - side by side */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Paid</p>
                    <MoneyDisplay 
                      amount={group.totalPaid} 
                      currency={group.currency} 
                      size="sm"
                      className="text-muted-foreground block truncate"
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total</p>
                    <MoneyDisplay 
                      amount={group.totalOwed} 
                      currency={group.currency} 
                      size="sm"
                      className="block truncate"
                    />
                  </div>
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
