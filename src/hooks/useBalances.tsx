import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { extractPhoneSuffix } from "@/lib/phoneUtils";
import { offlineDb, safeDbOperation } from "@/lib/offline/db";
import { useNetworkStatus } from "@/lib/offline/networkStatus";

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

// Fetch from local IndexedDB when offline
async function fetchDashboardDataOffline(userId: string, profilePhoneNumber: string, profilePhoneSuffix: string | null): Promise<DashboardData> {
  let owedToYou = 0;
  let youOwe = 0;
  const activities: RecentActivity[] = [];
  
  const mySuffix = profilePhoneSuffix || extractPhoneSuffix(profilePhoneNumber);

  // Get all bills from local DB
  const localBills = await safeDbOperation(
    () => offlineDb.bills.filter(b => !b.deleted_at).toArray(),
    []
  );

  // Get all bill participants from local DB
  const localParticipants = await safeDbOperation(
    () => offlineDb.billParticipants.toArray(),
    []
  );

  // Get all IOUs from local DB
  const localIOUs = await safeDbOperation(
    () => offlineDb.ious.filter(i => !i.deleted_at).toArray(),
    []
  );

  // Bills I created - calculate what others owe me
  const myBills = localBills.filter(b => b.creator_id === userId);
  
  myBills.forEach((bill) => {
    const billParticipants = localParticipants.filter(p => p.bill_id === bill.id);
    
    billParticipants.forEach((p) => {
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
  const myParticipations = localParticipants.filter(
    p => p.user_id === userId || p.phone_suffix === mySuffix
  );

  myParticipations.forEach((p) => {
    const bill = localBills.find(b => b.id === p.bill_id);
    if (bill && bill.creator_id !== userId && !bill.deleted_at) {
      youOwe += p.amount_owed - p.amount_paid;
      
      activities.push({
        id: `owe-bill-${bill.id}`,
        type: "bill",
        title: bill.title,
        amount: p.amount_owed,
        currency: bill.currency,
        date: bill.created_at,
        isCredit: false,
      });
    }
  });

  // IOUs I created (I'm the creditor) - what others owe me
  const myIOUs = localIOUs.filter(iou => iou.creditor_id === userId);
  
  myIOUs.forEach((iou) => {
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
  const iOwe = localIOUs.filter(
    iou => iou.debtor_user_id === userId || iou.debtor_phone_suffix === mySuffix
  );

  iOwe.forEach((iou) => {
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

// Original function fetching from Supabase
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
  const { isOnline } = useNetworkStatus();

  const { data, isLoading: loading } = useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user || !profile) {
        return {
          balances: { owedToYou: 0, youOwe: 0, netBalance: 0 },
          recentActivity: [],
        };
      }

      // Server-first when online, local fallback
      if (isOnline) {
        console.log('[useBalances] Online: fetching from server...');
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          );
          
          const serverData = await Promise.race([
            fetchDashboardData(user.id, profile.phone_number, profile.phone_suffix),
            timeoutPromise
          ]);
          
          return serverData;
        } catch (e) {
          console.warn('[useBalances] Server fetch failed/timeout, falling back to local:', e);
        }
      }

      // Offline or server failed: use local DB
      console.log('[useBalances] Using local DB fallback...');
      try {
        const localData = await fetchDashboardDataOffline(
          user.id,
          profile.phone_number,
          profile.phone_suffix
        );
        return localData;
      } catch (e) {
        console.warn('[useBalances] Local DB error:', e);
      }

      // Final fallback
      return {
        balances: { owedToYou: 0, youOwe: 0, netBalance: 0 },
        recentActivity: [],
      };
    },
    enabled: !!user && !!profile,
    staleTime: 30 * 1000, // 30 seconds - more responsive
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
