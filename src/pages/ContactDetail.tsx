import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Contact } from "@/hooks/useContacts";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileText,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractPhoneSuffix } from "@/lib/phoneUtils";

interface TimelineItem {
  id: string;
  type: "bill_created" | "bill_owed" | "iou_created" | "iou_owed";
  title: string;
  description: string;
  amount: number;
  amountPaid: number;
  currency: string;
  date: string;
  status: string;
  isCredit: boolean; // Money coming to you
}

export default function ContactDetail() {
  const { user, profile, loading: authLoading } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOwedToYou, setTotalOwedToYou] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);

  useEffect(() => {
    const fetchContactData = async () => {
      if (!id || !user || !profile) return;

      try {
        // Fetch contact with linked profile info
        const { data: contactData, error: contactError } = await supabase
          .from("contacts")
          .select("*, linked_profile:profiles!contacts_linked_profile_id_fkey(user_id, phone_suffix)")
          .eq("id", id)
          .single();

        if (contactError) throw contactError;
        setContact(contactData);

        // Use phone_suffix for matching
        const contactSuffix = contactData.phone_suffix || extractPhoneSuffix(contactData.phone_number);
        const mySuffix = profile.phone_suffix || extractPhoneSuffix(profile.phone_number);
        
        // Get the contact's user_id from linked profile (if they have an account)
        const contactUserId = (contactData as any).linked_profile?.user_id;
        
        const timelineItems: TimelineItem[] = [];
        let owedToYou = 0;
        let youOwe = 0;

        // 1. Bills I created where contact is a participant (they owe me)
        const { data: myBills } = await supabase
          .from("bills")
          .select(`*, participants:bill_participants(*)`)
          .eq("creator_id", user.id)
          .is("deleted_at", null);

        myBills?.forEach((bill) => {
          const participant = bill.participants?.find(
            (p: any) => (p.phone_suffix || extractPhoneSuffix(p.phone_number)) === contactSuffix
          );
          if (participant) {
            const remaining = participant.amount_owed - participant.amount_paid;
            owedToYou += remaining;

            timelineItems.push({
              id: `bill-${bill.id}`,
              type: "bill_created",
              title: bill.title,
              description: `${contactData.nickname || "They"} owe${remaining > 0 ? "s" : "d"} you`,
              amount: participant.amount_owed,
              amountPaid: participant.amount_paid,
              currency: bill.currency,
              date: bill.created_at,
              status: participant.status,
              isCredit: true,
            });
          }
        });

        // 2. Bills where I'm a participant and contact created it (I owe them)
        const { data: allBillsWithParticipants } = await supabase
          .from("bill_participants")
          .select(`*, bill:bills(*)`)
          .or(`user_id.eq.${user.id},phone_suffix.eq.${mySuffix}`);

        allBillsWithParticipants?.forEach((participation: any) => {
          if (!participation.bill || participation.bill.deleted_at) return;
          if (participation.bill.creator_id === user.id) return; // Skip my own bills

          // Check if the bill creator matches contact's user_id (from linked_profile)
          const isContactCreator = contactUserId && participation.bill.creator_id === contactUserId;
          
          if (isContactCreator) {
            const remaining = participation.amount_owed - participation.amount_paid;
            youOwe += remaining;

            timelineItems.push({
              id: `bill-owe-${participation.bill.id}`,
              type: "bill_owed",
              title: participation.bill.title,
              description: `You owe ${contactData.nickname || "them"}`,
              amount: participation.amount_owed,
              amountPaid: participation.amount_paid,
              currency: participation.bill.currency,
              date: participation.bill.created_at,
              status: participation.status,
              isCredit: false,
            });
          }
        });

        // 3. IOUs I created where contact is debtor (they owe me)
        const { data: myIOUs } = await supabase
          .from("ious")
          .select("*")
          .eq("creditor_id", user.id)
          .is("deleted_at", null);

        const filteredMyIOUs = myIOUs?.filter(iou => 
          (iou.debtor_phone_suffix || extractPhoneSuffix(iou.debtor_phone_number)) === contactSuffix
        ) || [];

        filteredMyIOUs.forEach((iou) => {
          const remaining = iou.amount - iou.amount_paid;
          owedToYou += remaining;

          timelineItems.push({
            id: `iou-${iou.id}`,
            type: "iou_created",
            title: iou.description || "IOU",
            description: `${contactData.nickname || "They"} owe${remaining > 0 ? "s" : "d"} you`,
            amount: iou.amount,
            amountPaid: iou.amount_paid,
            currency: iou.currency,
            date: iou.created_at,
            status: iou.status,
            isCredit: true,
          });
        });

        // 4. IOUs where I'm the debtor and contact is creditor (I owe them)
        const { data: iOweThem } = await supabase
          .from("ious")
          .select("*")
          .or(`debtor_user_id.eq.${user.id},debtor_phone_suffix.eq.${mySuffix}`)
          .is("deleted_at", null);

        // Match by contact's user_id (creditor_id is a user_id, not profile_id)
        const filteredIOwe = iOweThem?.filter(iou => 
          contactUserId && iou.creditor_id === contactUserId
        ) || [];

        filteredIOwe.forEach((iou) => {
          const remaining = iou.amount - iou.amount_paid;
          youOwe += remaining;

          timelineItems.push({
            id: `iou-owe-${iou.id}`,
            type: "iou_owed",
            title: iou.description || "IOU",
            description: `You owe ${contactData.nickname || "them"}`,
            amount: iou.amount,
            amountPaid: iou.amount_paid,
            currency: iou.currency,
            date: iou.created_at,
            status: iou.status,
            isCredit: false,
          });
        });

        // Sort by date descending
        timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setTotalOwedToYou(owedToYou);
        setTotalYouOwe(youOwe);
        setTimeline(timelineItems);
      } catch (error) {
        console.error("Error fetching contact data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContactData();
  }, [id, user, profile]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="space-y-4 animate-fade-in">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!contact) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Contact not found</p>
          <Button variant="link" onClick={() => navigate("/contacts")}>
            Go back to contacts
          </Button>
        </div>
      </AppLayout>
    );
  }

  const netBalance = totalOwedToYou - totalYouOwe;

  const getTimelineIcon = (item: TimelineItem) => {
    switch (item.type) {
      case "bill_created":
      case "bill_owed":
        return <Receipt className="h-4 w-4" />;
      case "iou_created":
      case "iou_owed":
        return <FileText className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <AppLayout hideNav>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <AvatarCustom
            name={contact.nickname || contact.phone_number}
            size="lg"
          />
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-foreground">
              {contact.nickname || contact.phone_number}
            </h1>
            <p className="text-sm text-muted-foreground">{contact.phone_number}</p>
          </div>
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Owes you</span>
            </div>
            <MoneyDisplay amount={totalOwedToYou} size="lg" className="text-foreground" />
          </div>

          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">You owe</span>
            </div>
            <MoneyDisplay amount={totalYouOwe} size="lg" className="text-foreground" />
          </div>
        </div>

        {/* Net Balance */}
        <div className="card-elevated p-4">
          <p className="text-sm text-muted-foreground mb-1">Net Balance</p>
          <MoneyDisplay amount={netBalance} size="xl" showSign />
          <p className="text-xs text-muted-foreground mt-1">
            {netBalance > 0
              ? `${contact.nickname || "They"} owes you`
              : netBalance < 0
              ? `You owe ${contact.nickname || "them"}`
              : "All settled up!"}
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground">Transaction History</h2>

          {timeline.length === 0 ? (
            <div className="card-elevated p-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">No transactions yet</p>
              <p className="text-muted-foreground text-xs mt-1">
                Create a bill or IOU with this contact to see history
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((item) => {
                const remaining = item.amount - item.amountPaid;
                const isPaid = item.status === "paid" || remaining <= 0;
                
                return (
                  <div
                    key={item.id}
                    className={`card-elevated p-4 border-l-4 ${
                      item.isCredit ? "border-l-emerald-500" : "border-l-rose-500"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item.isCredit
                            ? "bg-emerald-100 dark:bg-emerald-900/30"
                            : "bg-rose-100 dark:bg-rose-900/30"
                        }`}
                      >
                        {item.isCredit ? (
                          <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <StatusBadge status={item.status as any} />
                        </div>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getTimelineIcon(item)}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.date), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <MoneyDisplay
                          amount={item.amount}
                          currency={item.currency}
                          size="sm"
                          className={item.isCredit ? "text-emerald-600" : "text-rose-600"}
                        />
                        {item.amountPaid > 0 && !isPaid && (
                          <p className="text-xs text-muted-foreground">
                            Paid: <MoneyDisplay amount={item.amountPaid} currency={item.currency} size="sm" />
                          </p>
                        )}
                        {!isPaid && (
                          <p className="text-xs font-medium text-foreground">
                            Due: <MoneyDisplay amount={remaining} currency={item.currency} size="sm" />
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
