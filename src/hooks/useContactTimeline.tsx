import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { extractPhoneSuffix } from "@/lib/phoneUtils";
import { Contact } from "./useContacts";

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
  contact: Contact | null;
  timeline: TimelineItem[];
  totalOwedToYou: number;
  totalYouOwe: number;
  netBalance: number;
}

async function fetchContactTimeline(
  contactId: string,
  userId: string,
  profilePhoneNumber: string,
  profilePhoneSuffix: string | null
): Promise<ContactTimelineData> {
  // Fetch contact with linked profile info
  const { data: contactData, error: contactError } = await supabase
    .from("contacts")
    .select("*, linked_profile:profiles!contacts_linked_profile_id_fkey(user_id, phone_suffix)")
    .eq("id", contactId)
    .single();

  if (contactError) throw contactError;
  if (!contactData) return { contact: null, timeline: [], totalOwedToYou: 0, totalYouOwe: 0, netBalance: 0 };

  // Use phone_suffix for matching
  const contactSuffix = contactData.phone_suffix || extractPhoneSuffix(contactData.phone_number);
  const mySuffix = profilePhoneSuffix || extractPhoneSuffix(profilePhoneNumber);
  
  // Get the contact's user_id from linked profile (if they have an account)
  const contactUserId = (contactData as any).linked_profile?.user_id;
  
  const timelineItems: TimelineItem[] = [];
  let owedToYou = 0;
  let youOwe = 0;

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
    .or(`user_id.eq.${userId},phone_suffix.eq.${mySuffix}`);

  allBillsWithParticipants?.forEach((participation: any) => {
    if (!participation.bill || participation.bill.deleted_at) return;
    if (participation.bill.creator_id === userId) return; // Skip my own bills

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

  return {
    contact: contactData,
    timeline: timelineItems,
    totalOwedToYou: owedToYou,
    totalYouOwe: youOwe,
    netBalance: owedToYou - youOwe,
  };
}

export function useContactTimeline(contactId: string | undefined) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["contact-timeline", contactId],
    queryFn: () => fetchContactTimeline(
      contactId!,
      user!.id,
      profile!.phone_number,
      profile!.phone_suffix
    ),
    enabled: !!user && !!profile && !!contactId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    contact: data?.contact ?? null,
    timeline: data?.timeline ?? [],
    totalOwedToYou: data?.totalOwedToYou ?? 0,
    totalYouOwe: data?.totalYouOwe ?? 0,
    netBalance: data?.netBalance ?? 0,
    loading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["contact-timeline", contactId] }),
  };
}
