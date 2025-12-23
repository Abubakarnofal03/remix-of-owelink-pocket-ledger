import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react";

export default function Contacts() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Contacts</h1>
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add contacts to quickly split bills and track debts."
          action={{ label: "Add Contact", onClick: () => {} }}
        />
      </div>
    </AppLayout>
  );
}
