import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowUpRight, ArrowDownLeft, TrendingUp, Receipt, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  const { user, profile, loading } = useAuth();

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

  return (
    <AppLayout>
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
        <div className="grid grid-cols-2 gap-4">
          <div className="card-elevated p-4 stagger-1 opacity-0 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Owed to you</span>
            </div>
            <MoneyDisplay amount={0} size="lg" className="text-foreground" />
          </div>

          <div className="card-elevated p-4 stagger-2 opacity-0 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">You owe</span>
            </div>
            <MoneyDisplay amount={0} size="lg" className="text-foreground" />
          </div>
        </div>

        {/* Net Balance */}
        <div className="card-elevated p-5 stagger-3 opacity-0 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Net Balance</p>
              <MoneyDisplay amount={0} size="xl" showSign />
            </div>
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-accent-foreground" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3 stagger-4 opacity-0 animate-slide-up">
          <h2 className="font-semibold text-foreground">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/bills/new">
              <Button variant="secondary" className="w-full h-auto py-4 flex-col gap-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium">Split a Bill</span>
              </Button>
            </Link>
            <Link to="/ious/new">
              <Button variant="secondary" className="w-full h-auto py-4 flex-col gap-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium">Create IOU</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3 stagger-5 opacity-0 animate-slide-up">
          <h2 className="font-semibold text-foreground">Recent Activity</h2>
          <div className="card-elevated p-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">No activity yet</p>
            <p className="text-muted-foreground text-xs mt-1">Create your first bill or IOU to get started</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
