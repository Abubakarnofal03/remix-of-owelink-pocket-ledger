import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { extractPhoneSuffix } from "@/lib/phoneUtils";

interface BalanceData {
  owedToYou: number;
  youOwe: number;
  netBalance: number;
}

interface RecentActivity {
  id: string;
  type: "bill" | "iou" | "payment";
  title: string;
  amount: number;
  currency: string;
  date: string;
  isCredit: boolean;
}

interface DashboardData {
  balances: BalanceData;
  recentActivity: RecentActivity[];
}

const DASHBOARD_QUERY_KEY = ["dashboard"];

async function fetchDashboardData(userId: string, profilePhoneNumber: string, profilePhoneSuffix: string | null): Promise<DashboardData> {
  let owedToYou = 0;
  let youOwe = 0;
  const activities: RecentActivity[] = [];
  
  // Use phone_suffix for matching
  const mySuffix = profilePhoneSuffix || extractPhoneSuffix(profilePhoneNumber);

  // Bills I created - calculate what others owe me
  const { data: myBills } = await supabase
    .from("bills")
    .select(`*, participants:bill_participants(*)`)
    .eq("creator_id", userId)
    .is("deleted_at", null);

  myBills?.forEach((bill) => {
    bill.participants?.forEach((p: any) => {
      // Skip myself as participant using phone_suffix
      const participantSuffix = p.phone_suffix || extractPhoneSuffix(p.phone_number);
      if (participantSuffix !== mySuffix && p.user_id !== userId) {
        owedToYou += p.amount_owed - p.amount_paid;
      }
    });

    // Add to recent activity
    activities.push({
      id: `bill-${bill.id}`,
      type: "bill",
      title: bill.title,
      amount: bill.total_amount,
      currency: bill.currency,
      date: bill.created_at,
      isCredit: true,
    });
  });

  // Bills where I'm a participant - calculate what I owe
  const { data: allBillParticipants } = await supabase
    .from("bill_participants")
    .select(`*, bill:bills(*)`)
    .or(`user_id.eq.${userId},phone_suffix.eq.${mySuffix}`);

  allBillParticipants?.forEach((p: any) => {
    if (p.bill && p.bill.creator_id !== userId && !p.bill.deleted_at) {
      youOwe += p.amount_owed - p.amount_paid;
      
      activities.push({
        id: `owe-bill-${p.bill_id}`,
        type: "bill",
        title: p.bill.title,
        amount: p.amount_owed,
        currency: p.bill.currency,
        date: p.bill.created_at,
        isCredit: false,
      });
    }
  });

  // IOUs I created (I'm the creditor) - what others owe me
  const { data: myIOUs } = await supabase
    .from("ious")
    .select("*")
    .eq("creditor_id", userId)
    .is("deleted_at", null);

  myIOUs?.forEach((iou) => {
    owedToYou += iou.amount - iou.amount_paid;
    
    activities.push({
      id: `iou-${iou.id}`,
      type: "iou",
      title: iou.description || "IOU",
      amount: iou.amount,
      currency: iou.currency,
      date: iou.created_at,
      isCredit: true,
    });
  });

  // IOUs where I'm the debtor - what I owe
  const { data: iOwe } = await supabase
    .from("ious")
    .select("*")
    .or(`debtor_user_id.eq.${userId},debtor_phone_suffix.eq.${mySuffix}`)
    .is("deleted_at", null);

  iOwe?.forEach((iou) => {
    // Don't count if I'm the creditor
    if (iou.creditor_id !== userId) {
      youOwe += iou.amount - iou.amount_paid;
      
      activities.push({
        id: `owe-iou-${iou.id}`,
        type: "iou",
        title: iou.description || "IOU",
        amount: iou.amount,
        currency: iou.currency,
        date: iou.created_at,
        isCredit: false,
      });
    }
  });

  // Sort activities by date
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    balances: {
      owedToYou,
      youOwe,
      netBalance: owedToYou - youOwe,
    },
    recentActivity: activities.slice(0, 10),
  };
}

export function useBalances() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => fetchDashboardData(
      user!.id,
      profile!.phone_number,
      profile!.phone_suffix
    ),
    enabled: !!user && !!profile,
    staleTime: 2 * 60 * 1000, // 2 minutes (dashboard data changes more frequently)
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  return {
    owedToYou: data?.balances.owedToYou ?? 0,
    youOwe: data?.balances.youOwe ?? 0,
    netBalance: data?.balances.netBalance ?? 0,
    loading,
    recentActivity: data?.recentActivity ?? [],
    refetch: () => queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY }),
  };
}
