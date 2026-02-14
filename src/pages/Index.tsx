import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Button } from "@/components/ui/button";
import { useBalances } from "@/hooks/useBalances";
import { useCurrency } from "@/hooks/useCurrency";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { format } from "date-fns";
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  TrendingDown,
  Receipt,
  FileText,
  DollarSign,
  Minus,
  Wallet,
} from "lucide-react";

export default function Index() {
  const { user, profile, loading } = useAuth();
  const { owedToYou, youOwe, netBalance, recentActivity, loading: balancesLoading, refetch } = useBalances();
  const { currency } = useCurrency();
  

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft">
          <div className="h-12 w-12 rounded-xl bg-primary/20" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const getActivityIcon = (type: string, isCredit: boolean) => {
    if (type === "payment") return <DollarSign className="h-4 w-4" />;
    if (type === "bill") return <Receipt className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-6 animate-fade-in">
          {/* Greeting */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Hey, {profile?.username || "there"}! 👋
              </h1>
              <p className="text-muted-foreground text-sm">Here's your balance overview</p>
            </div>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-2 gap-4" data-tour="balance-overview">
            <div className="card-elevated p-4 stagger-1 opacity-0 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Owed to you</span>
              </div>
              <MoneyDisplay 
                amount={balancesLoading ? 0 : owedToYou} 
                currency={currency}
                size="lg" 
                className="text-foreground" 
              />
            </div>

            <div className="card-elevated p-4 stagger-2 opacity-0 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">You owe</span>
              </div>
              <MoneyDisplay 
                amount={balancesLoading ? 0 : youOwe} 
                currency={currency}
                size="lg" 
                className="text-foreground" 
              />
            </div>
          </div>

          {/* Net Balance */}
          <div className="card-elevated p-5 stagger-3 opacity-0 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Net Balance</p>
                <MoneyDisplay 
                  amount={balancesLoading ? 0 : netBalance} 
                  currency={currency}
                  size="xl" 
                  showSign 
                />
                {!balancesLoading && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {netBalance > 0
                      ? "You're in the green!"
                      : netBalance < 0
                      ? "Time to settle up"
                      : "All balanced!"}
                  </p>
                )}
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                netBalance > 0 
                  ? "bg-emerald-100 dark:bg-emerald-900/30" 
                  : netBalance < 0 
                  ? "bg-rose-100 dark:bg-rose-900/30"
                  : "bg-accent"
              }`}>
                {netBalance > 0 ? (
                  <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : netBalance < 0 ? (
                  <TrendingDown className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                ) : (
                  <Minus className="h-6 w-6 text-accent-foreground" />
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3 stagger-4 opacity-0 animate-slide-up" data-tour="quick-actions">
            <h2 className="font-semibold text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-3">
              <Link to="/bills/new">
                <Button variant="secondary" className="w-full h-auto py-4 flex-col gap-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium">Split Bill</span>
                </Button>
              </Link>
              <Link to="/ious/new">
                <Button variant="secondary" className="w-full h-auto py-4 flex-col gap-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium">Track Owe</span>
                </Button>
              </Link>
              <Link to="/expenses">
                <Button variant="secondary" className="w-full h-auto py-4 flex-col gap-2">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium">Add Expense</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-3 stagger-5 opacity-0 animate-slide-up" data-tour="recent-activity">
            <h2 className="font-semibold text-foreground">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <div className="card-elevated p-8 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Receipt className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">No activity yet</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Create your first bill or owe to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((activity) => {
                  // Extract the actual ID from the activity id (remove prefixes)
                  const actualId = activity.id.replace("owe-bill-", "").replace("bill-", "").replace("owe-iou-", "").replace("iou-", "");
                  const linkPath = activity.type === "bill" ? `/bills/${actualId}` : `/ious/${actualId}`;
                  
                  return (
                  <Link
                    key={activity.id}
                    to={linkPath}
                    className="block"
                  >
                    <div className="card-elevated p-3 hover:ring-2 hover:ring-primary/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            activity.isCredit
                              ? "bg-emerald-100 dark:bg-emerald-900/30"
                              : "bg-rose-100 dark:bg-rose-900/30"
                          }`}
                        >
                          {activity.isCredit ? (
                            <ArrowDownLeft
                              className={`h-4 w-4 ${
                                activity.isCredit
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(activity.date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <MoneyDisplay
                          amount={activity.amount}
                          currency={activity.currency}
                          size="sm"
                          className={
                            activity.isCredit
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        />
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
