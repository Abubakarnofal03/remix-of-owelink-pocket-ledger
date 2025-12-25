import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { BillList } from "@/components/bills/BillList";
import { useBills } from "@/hooks/useBills";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Receipt, Plus, Crown, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BillFilter = "all" | "created" | "shared";

export default function Bills() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { bills, loading: billsLoading, refetch } = useBills();
  const [filter, setFilter] = useState<BillFilter>("all");

  const loading = billsLoading;

  const filteredBills = useMemo(() => {
    if (!user) return [];
    if (filter === "all") return bills;
    if (filter === "created") return bills.filter(b => b.creator_id === user.id);
    if (filter === "shared") return bills.filter(b => b.creator_id !== user.id);
    return bills;
  }, [bills, filter, user]);

  const createdCount = useMemo(() => {
    if (!user) return 0;
    return bills.filter(b => b.creator_id === user.id).length;
  }, [bills, user]);
  
  const sharedCount = useMemo(() => {
    if (!user) return 0;
    return bills.filter(b => b.creator_id !== user.id).length;
  }, [bills, user]);

  const handleRefresh = async () => {
    await refetch();
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-2xl font-bold text-foreground">Bills</h1>
            <Link to="/bills/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Bill
              </Button>
            </Link>
          </div>

          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as BillFilter)} className="mb-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="all" className="text-xs">
                All ({bills.length})
              </TabsTrigger>
              <TabsTrigger value="created" className="text-xs">
                <Crown className="h-3 w-3 mr-1" />
                Created ({createdCount})
              </TabsTrigger>
              <TabsTrigger value="shared" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                Shared ({sharedCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredBills.length === 0 && !loading ? (
            <EmptyState
              icon={Receipt}
              title={filter === "all" ? "No bills yet" : filter === "created" ? "No bills created" : "No shared bills"}
              description={filter === "all" 
                ? "Split expenses with friends and keep track of who owes what."
                : filter === "created"
                ? "Create a bill to split expenses with others."
                : "You'll see bills here when someone adds you as a participant."
              }
              action={filter !== "shared" ? { 
                label: "Create Bill", 
                onClick: () => navigate("/bills/new")
              } : undefined}
            />
          ) : (
            <BillList bills={filteredBills} loading={loading} />
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
