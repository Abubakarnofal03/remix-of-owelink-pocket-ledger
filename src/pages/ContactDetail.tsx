import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Contact } from "@/hooks/useContacts";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileText,
  Calendar,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractPhoneSuffix } from "@/lib/phoneUtils";

interface TimelineItem {
  id: string;
  type: "bill_created" | "bill_payment" | "iou_created" | "iou_payment";
  title: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
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
        // Fetch contact
        const { data: contactData, error: contactError } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", id)
          .single();

        if (contactError) throw contactError;
        setContact(contactData);

        // Use phone_suffix for matching
        const contactSuffix = contactData.phone_suffix || extractPhoneSuffix(contactData.phone_number);
        const mySuffix = profile.phone_suffix || extractPhoneSuffix(profile.phone_number);
        const timelineItems: TimelineItem[] = [];

        // Fetch bills where I'm creator and contact is participant
        const { data: myBills } = await supabase
          .from("bills")
          .select(`*, participants:bill_participants(*)`)
          .eq("creator_id", user.id)
          .is("deleted_at", null);

        myBills?.forEach((bill) => {
          // Match participant by phone_suffix
          const participant = bill.participants?.find(
            (p: any) => (p.phone_suffix || extractPhoneSuffix(p.phone_number)) === contactSuffix
          );
          if (participant) {
            // Bill created - they owe me
            timelineItems.push({
              id: `bill-${bill.id}`,
              type: "bill_created",
              title: bill.title,
              description: `Bill split with ${contactData.nickname || contactData.phone_number}`,
              amount: participant.amount_owed,
              currency: bill.currency,
              date: bill.created_at,
              isCredit: true,
            });

            // If they paid
            if (participant.amount_paid > 0) {
              timelineItems.push({
                id: `bill-payment-${bill.id}`,
                type: "bill_payment",
                title: `Payment for ${bill.title}`,
                description: `${contactData.nickname || contactData.phone_number} paid`,
                amount: participant.amount_paid,
                currency: bill.currency,
                date: participant.updated_at,
                isCredit: true,
              });
            }
          }
        });

        // Fetch bills where contact is creator and I'm participant (by phone_suffix)
        const { data: theirBills } = await supabase
          .from("bills")
          .select(`*, participants:bill_participants(*)`)
          .is("deleted_at", null);

        theirBills?.forEach((bill) => {
          // Check if I'm a participant using phone_suffix
          const imParticipant = bill.participants?.find(
            (p: any) => (p.phone_suffix || extractPhoneSuffix(p.phone_number)) === mySuffix || p.user_id === user.id
          );
          // Check if the creator is the contact (linked via profile)
          if (imParticipant && bill.creator_id !== user.id) {
            // Check if contact's linked_profile_id matches bill creator
            const creatorIsContact = contactData.linked_profile_id && 
              bill.creator_id === contactData.linked_profile_id;
            
            if (creatorIsContact) {
              timelineItems.push({
                id: `bill-owe-${bill.id}`,
                type: "bill_created",
                title: bill.title,
                description: `${contactData.nickname || contactData.phone_number} created a bill`,
                amount: imParticipant.amount_owed,
                currency: bill.currency,
                date: bill.created_at,
                isCredit: false,
              });
            }
          }
        });

        // Fetch IOUs where I'm creditor and contact is debtor (use debtor_phone_suffix)
        const { data: myIOUs } = await supabase
          .from("ious")
          .select("*")
          .eq("creditor_id", user.id)
          .is("deleted_at", null);

        // Filter IOUs by debtor phone_suffix
        const filteredMyIOUs = myIOUs?.filter(iou => 
          (iou.debtor_phone_suffix || extractPhoneSuffix(iou.debtor_phone_number)) === contactSuffix
        ) || [];

        filteredMyIOUs.forEach((iou) => {
          timelineItems.push({
            id: `iou-${iou.id}`,
            type: "iou_created",
            title: iou.description || "IOU",
            description: `${contactData.nickname || contactData.phone_number} owes you`,
            amount: iou.amount,
            currency: iou.currency,
            date: iou.created_at,
            isCredit: true,
          });

          if (iou.amount_paid > 0) {
            timelineItems.push({
              id: `iou-payment-${iou.id}`,
              type: "iou_payment",
              title: `Payment for IOU`,
              description: `${contactData.nickname || contactData.phone_number} paid`,
              amount: iou.amount_paid,
              currency: iou.currency,
              date: iou.updated_at,
              isCredit: true,
            });
          }
        });

        // Fetch IOUs where contact is creditor and I'm debtor (use debtor_phone_suffix)
        const { data: theirIOUs } = await supabase
          .from("ious")
          .select("*")
          .is("deleted_at", null);

        // Filter IOUs where I'm the debtor
        const filteredTheirIOUs = theirIOUs?.filter(iou => 
          (iou.debtor_phone_suffix || extractPhoneSuffix(iou.debtor_phone_number)) === mySuffix
        ) || [];

        filteredTheirIOUs.forEach((iou) => {
          // Check if creditor is linked to contact
          if (iou.creditor_id === contactData.linked_profile_id) {
            timelineItems.push({
              id: `iou-owe-${iou.id}`,
              type: "iou_created",
              title: iou.description || "IOU",
              description: `You owe ${contactData.nickname || contactData.phone_number}`,
              amount: iou.amount,
              currency: iou.currency,
              date: iou.created_at,
              isCredit: false,
            });
          }
        });

        // Fetch payments (not filtering here since we use payments in aggregate)
        // Sort by date descending
        timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Calculate totals
        let owedToYou = 0;
        let youOwe = 0;

        // From my bills
        myBills?.forEach((bill) => {
          const participant = bill.participants?.find(
            (p: any) => (p.phone_suffix || extractPhoneSuffix(p.phone_number)) === contactSuffix
          );
          if (participant) {
            owedToYou += participant.amount_owed - participant.amount_paid;
          }
        });

        // From my IOUs
        filteredMyIOUs.forEach((iou) => {
          owedToYou += iou.amount - iou.amount_paid;
        });

        // Calculate what I owe to contact
        theirBills?.forEach((bill) => {
          const imParticipant = bill.participants?.find(
            (p: any) => (p.phone_suffix || extractPhoneSuffix(p.phone_number)) === mySuffix || p.user_id === user.id
          );
          if (imParticipant && bill.creator_id === contactData.linked_profile_id) {
            youOwe += imParticipant.amount_owed - imParticipant.amount_paid;
          }
        });

        filteredTheirIOUs.forEach((iou) => {
          if (iou.creditor_id === contactData.linked_profile_id) {
            youOwe += iou.amount - iou.amount_paid;
          }
        });

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
        return <Receipt className="h-4 w-4" />;
      case "bill_payment":
      case "iou_payment":
        return <DollarSign className="h-4 w-4" />;
      case "iou_created":
        return <FileText className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  // Split timeline into credits and debits
  const credits = timeline.filter((t) => t.isCredit);
  const debits = timeline.filter((t) => !t.isCredit);

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
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Credits (Owed to you) - Left side */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-600">Credits</span>
                </div>
                {credits.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No credits</p>
                ) : (
                  credits.map((item) => (
                    <div key={item.id} className="card-elevated p-3 border-l-2 border-emerald-500">
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                          {getTimelineIcon(item)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(item.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <MoneyDisplay
                        amount={item.amount}
                        currency={item.currency}
                        size="sm"
                        className="text-emerald-600 mt-2"
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Debits (You owe) - Right side */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="h-4 w-4 text-rose-600" />
                  <span className="text-sm font-medium text-rose-600">Debits</span>
                </div>
                {debits.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No debits</p>
                ) : (
                  debits.map((item) => (
                    <div key={item.id} className="card-elevated p-3 border-l-2 border-rose-500">
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                          {getTimelineIcon(item)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(item.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <MoneyDisplay
                        amount={item.amount}
                        currency={item.currency}
                        size="sm"
                        className="text-rose-600 mt-2"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
