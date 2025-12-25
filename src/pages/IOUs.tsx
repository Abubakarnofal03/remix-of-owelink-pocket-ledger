import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useIOUs } from "@/hooks/useIOUs";
import { IOUList } from "@/components/ious/IOUList";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { FileText, Plus, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export default function IOUs() {
  const { user, loading: authLoading } = useAuth();
  const { owedToMe, iOwe, loading, refetch } = useIOUs();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"owed" | "owe">("owed");

  const currentList = activeTab === "owed" ? owedToMe : iOwe;
  const hasAnyIOUs = owedToMe.length > 0 || iOwe.length > 0;

  const handleRefresh = async () => {
    await refetch();
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="animate-fade-in space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-foreground">IOUs</h1>
            <Button size="sm" onClick={() => navigate("/ious/new")}>
              <Plus className="h-4 w-4 mr-1" />
              New IOU
            </Button>
          </div>

          {/* Tabs */}
          {hasAnyIOUs && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "owed" | "owe")}>
              <TabsList className="w-full">
                <TabsTrigger value="owed" className="flex-1 gap-2">
                  <ArrowDownLeft className="h-4 w-4" />
                  Owed to me ({owedToMe.length})
                </TabsTrigger>
                <TabsTrigger value="owe" className="flex-1 gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  I owe ({iOwe.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* List */}
          {loading ? (
            <IOUList ious={[]} loading />
          ) : hasAnyIOUs ? (
            currentList.length > 0 ? (
              <IOUList ious={currentList} />
            ) : (
              <EmptyState
                icon={activeTab === "owed" ? ArrowDownLeft : ArrowUpRight}
                title={activeTab === "owed" ? "No one owes you" : "You don't owe anyone"}
                description={
                  activeTab === "owed"
                    ? "When someone owes you money, it will show here."
                    : "When you owe someone money, it will show here."
                }
              />
            )
          ) : (
            <EmptyState
              icon={FileText}
              title="No IOUs yet"
              description="Track simple debts - who owes you or who you owe."
              action={{ label: "Create IOU", onClick: () => navigate("/ious/new") }}
            />
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
