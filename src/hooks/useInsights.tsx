import { useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useBalances } from "./useBalances";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Insight {
  icon: string;
  title: string;
  description: string;
  type: "positive" | "negative" | "neutral" | "warning";
}

interface InsightsData {
  summary: string;
  insights: Insight[];
  tips: string[];
  generatedAt: string;
}

const CACHE_KEY = "owelink_insights";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function useInsights() {
  const { user, profile } = useAuth();
  const { owedToYou, youOwe, netBalance, recentActivity } = useBalances();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InsightsData | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as InsightsData;
        if (Date.now() - new Date(parsed.generatedAt).getTime() < CACHE_DURATION) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const generateInsights = useCallback(async (force = false) => {
    if (!user || !profile) return;

    // Check cache unless forced
    if (!force && data) {
      const age = Date.now() - new Date(data.generatedAt).getTime();
      if (age < CACHE_DURATION) return;
    }

    setLoading(true);
    try {
      const summaryData = {
        owedToYou,
        youOwe,
        netBalance,
        recentActivityCount: recentActivity.length,
        recentActivity: recentActivity.slice(0, 5).map((a) => ({
          type: a.type,
          title: a.title,
          amount: a.amount,
          currency: a.currency,
          isCredit: a.isCredit,
          date: a.date,
        })),
        username: profile.username,
      };

      const { data: result, error } = await supabase.functions.invoke("ai-insights", {
        body: { summaryData },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const insightsData: InsightsData = {
        summary: result.summary || "No summary available",
        insights: result.insights || [],
        tips: result.tips || [],
        generatedAt: new Date().toISOString(),
      };

      setData(insightsData);
      localStorage.setItem(CACHE_KEY, JSON.stringify(insightsData));
    } catch (err: any) {
      console.error("Failed to generate insights:", err);
      toast.error(err?.message || "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  }, [user, profile, owedToYou, youOwe, netBalance, recentActivity, data]);

  return { data, loading, generateInsights };
}
