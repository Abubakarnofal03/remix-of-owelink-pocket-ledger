import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";

export default function IOUs() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">IOUs</h1>
        <EmptyState
          icon={FileText}
          title="No IOUs yet"
          description="Track simple debts - who owes you or who you owe."
          action={{ label: "Create IOU", onClick: () => {} }}
        />
      </div>
    </AppLayout>
  );
}
