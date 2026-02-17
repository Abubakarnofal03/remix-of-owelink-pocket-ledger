import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInsights } from "@/hooks/useInsights";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  RefreshCw,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { ExpenseChart } from "@/components/insights/ExpenseChart";

const iconMap: Record<string, React.ReactNode> = {
  "trending-up": <TrendingUp className="h-4 w-4" />,
  "trending-down": <TrendingDown className="h-4 w-4" />,
  alert: <AlertTriangle className="h-4 w-4" />,
  check: <CheckCircle2 className="h-4 w-4" />,
  clock: <Clock className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  negative: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  neutral: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function Insights() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data, loading, generateInsights } = useInsights();

  useEffect(() => {
    if (user && !data) {
      generateInsights();
    }
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout hideNav>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="font-display text-xl font-bold text-foreground">AI Insights</h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateInsights(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1.5">Refresh</span>
          </Button>
        </div>

        {/* Expense Chart - always visible */}
        <ExpenseChart />

        {loading && !data ? (
          <div className="space-y-4">
            <div className="card-elevated p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Analyzing your finances...</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Summary */}
            <div className="card-elevated p-5">
              <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>
              {data.generatedAt && (
                <p className="text-[10px] text-muted-foreground mt-3">
                  Generated {new Date(data.generatedAt).toLocaleDateString()} at{" "}
                  {new Date(data.generatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Insights */}
            {data.insights.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground">Key Insights</h2>
                {data.insights.map((insight, i) => (
                  <div key={i} className="card-elevated p-4 flex items-start gap-3">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        typeColors[insight.type] || typeColors.neutral
                      }`}
                    >
                      {iconMap[insight.icon] || <Sparkles className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{insight.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tips */}
            {data.tips.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Tips
                </h2>
                <div className="card-elevated p-4 space-y-3">
                  {data.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-primary mt-0.5">{i + 1}.</span>
                      <p className="text-sm text-foreground">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card-elevated p-8 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Tap refresh to generate AI-powered insights about your finances
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}