import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { extractPhoneSuffix } from "@/lib/phoneUtils";

interface BalanceData {
  owedToYou: number;
  youOwe: number;
  netBalance: number;
  loading: boolean;
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

export function useBalances() {
  const { user, profile } = useAuth();
  const [balances, setBalances] = useState<BalanceData>({
    owedToYou: 0,
    youOwe: 0,
    netBalance: 0,
    loading: true,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  const fetchBalances = useCallback(async () => {
    if (!user || !profile) return;

    try {
      let owedToYou = 0;
      let youOwe = 0;
      const activities: RecentActivity[] = [];
      
      // Use phone_suffix for matching
      const mySuffix = profile.phone_suffix || extractPhoneSuffix(profile.phone_number);

      // Bills I created - calculate what others owe me
      const { data: myBills } = await supabase
        .from("bills")
        .select(`*, participants:bill_participants(*)`)
        .eq("creator_id", user.id)
        .is("deleted_at", null);

      myBills?.forEach((bill) => {
        bill.participants?.forEach((p: any) => {
          // Skip myself as participant using phone_suffix
          const participantSuffix = p.phone_suffix || extractPhoneSuffix(p.phone_number);
          if (participantSuffix !== mySuffix && p.user_id !== user.id) {
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
      // Use phone_suffix for matching
      const { data: allBillParticipants } = await supabase
        .from("bill_participants")
        .select(`*, bill:bills(*)`)
        .or(`user_id.eq.${user.id},phone_suffix.eq.${mySuffix}`);

      allBillParticipants?.forEach((p: any) => {
        if (p.bill && p.bill.creator_id !== user.id && !p.bill.deleted_at) {
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
        .eq("creditor_id", user.id)
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

      // IOUs where I'm the debtor - what I owe (use debtor_phone_suffix)
      const { data: iOwe } = await supabase
        .from("ious")
        .select("*")
        .or(`debtor_user_id.eq.${user.id},debtor_phone_suffix.eq.${mySuffix}`)
        .is("deleted_at", null);

      iOwe?.forEach((iou) => {
        // Don't count if I'm the creditor
        if (iou.creditor_id !== user.id) {
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

      setBalances({
        owedToYou,
        youOwe,
        netBalance: owedToYou - youOwe,
        loading: false,
      });

      setRecentActivity(activities.slice(0, 10));
    } catch (error) {
      console.error("Error fetching balances:", error);
      setBalances((prev) => ({ ...prev, loading: false }));
    }
  }, [user, profile]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    ...balances,
    recentActivity,
    refetch: fetchBalances,
  };
}
