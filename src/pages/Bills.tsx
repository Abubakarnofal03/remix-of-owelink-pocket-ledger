import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Receipt } from "lucide-react";

export default function Bills() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Bills</h1>
        <EmptyState
          icon={Receipt}
          title="No bills yet"
          description="Split expenses with friends and keep track of who owes what."
          action={{ label: "Create Bill", onClick: () => {} }}
        />
      </div>
    </AppLayout>
  );
}
