import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell } from "lucide-react";

export default function Notifications() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Notifications</h1>
        <EmptyState
          icon={Bell}
          title="All caught up"
          description="You'll see payment reminders and updates here."
        />
      </div>
    </AppLayout>
  );
}
