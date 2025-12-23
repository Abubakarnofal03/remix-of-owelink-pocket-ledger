import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { BillList } from "@/components/bills/BillList";
import { useBills } from "@/hooks/useBills";
import { Receipt, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Bills() {
  const { user, loading: authLoading } = useAuth();
  const { bills, loading: billsLoading } = useBills();

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const loading = billsLoading;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">Bills</h1>
          <Link to="/bills/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Bill
            </Button>
          </Link>
        </div>

        {bills.length === 0 && !loading ? (
          <EmptyState
            icon={Receipt}
            title="No bills yet"
            description="Split expenses with friends and keep track of who owes what."
            action={{ 
              label: "Create Bill", 
              onClick: () => {
                window.location.href = "/bills/new";
              } 
            }}
          />
        ) : (
          <BillList bills={bills} loading={loading} />
        )}
      </div>
    </AppLayout>
  );
}
