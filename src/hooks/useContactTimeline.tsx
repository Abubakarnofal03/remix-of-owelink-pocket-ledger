import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { extractPhoneSuffix } from "@/lib/phoneUtils";
import { useContacts, Contact } from "./useContacts";

export interface TimelineItem {
  id: string;
  type: "bill_created" | "bill_owed" | "iou_created" | "iou_owed";
  title: string;
  description: string;
  amount: number;
  amountPaid: number;
  currency: string;
  date: string;
  status: string;
  isCredit: boolean;
}

interface ContactTimelineData {
  timeline: TimelineItem[];
  totalOwedToYou: number;
  totalYouOwe: number;
  netBalance: number;
}

async function fetchContactTimeline(
  contact: Contact,
  userId: string,
  profilePhoneNumber: string,
  profilePhoneSuffix: string | null
): Promise<ContactTimelineData> {
  // Use phone_suffix for matching
  const contactSuffix = contact.phone_suffix || extractPhoneSuffix(contact.phone_number);
  const mySuffix = profilePhoneSuffix || extractPhoneSuffix(profilePhoneNumber);
  
  const timelineItems: TimelineItem[] = [];
  let owedToYou = 0;
  let youOwe = 0;

  // Find contact's user_id if they have a linked profile
  const { data: linkedProfile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("phone_suffix", contactSuffix)
    .maybeSingle();
  
  const contactUserId = linkedProfile?.user_id;
  const contactName = contact.nickname || "They";

  // 1. Bills I created where contact is a participant (they owe me)
  const { data: myBills } = await supabase
    .from("bills")
    .select(`*, participants:bill_participants(*)`)
    .eq("creator_id", userId)
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
        description: `${contactName} owe${remaining > 0 ? "s" : "d"} you`,
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
    .or(`user_id.eq.${userId},phone_suffix.eq.${mySuffix}`);

  allBillsWithParticipants?.forEach((participation: any) => {
    if (!participation.bill || participation.bill.deleted_at) return;
    if (participation.bill.creator_id === userId) return; // Skip my own bills

    // Check if the bill creator matches contact's user_id
    const isContactCreator = contactUserId && participation.bill.creator_id === contactUserId;
    
    if (isContactCreator) {
      const remaining = participation.amount_owed - participation.amount_paid;
      youOwe += remaining;

      timelineItems.push({
        id: `bill-owe-${participation.bill.id}`,
        type: "bill_owed",
        title: participation.bill.title,
        description: `You owe ${contactName}`,
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
    .eq("creditor_id", userId)
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
      description: `${contactName} owe${remaining > 0 ? "s" : "d"} you`,
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
    .or(`debtor_user_id.eq.${userId},debtor_phone_suffix.eq.${mySuffix}`)
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
      description: `You owe ${contactName}`,
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

  return {
    timeline: timelineItems,
    totalOwedToYou: owedToYou,
    totalYouOwe: youOwe,
    netBalance: owedToYou - youOwe,
  };
}

export function useContactTimeline(contactId: string | undefined) {
  const { user, profile } = useAuth();
  const { contacts } = useContacts();
  const queryClient = useQueryClient();
  
  // Find contact from local contacts
  const contact = contacts.find(c => c.id === contactId);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["contact-timeline", contactId, contact?.phone_suffix],
    queryFn: () => fetchContactTimeline(
      contact!,
      user!.id,
      profile!.phone_number,
      profile!.phone_suffix
    ),
    enabled: !!user && !!profile && !!contact,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    contact,
    timeline: data?.timeline ?? [],
    totalOwedToYou: data?.totalOwedToYou ?? 0,
    totalYouOwe: data?.totalYouOwe ?? 0,
    netBalance: data?.netBalance ?? 0,
    loading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["contact-timeline", contactId] }),
  };
}
