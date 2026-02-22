import { useAuth } from "@/hooks/useAuth";
import { useExpenseGroups } from "@/hooks/useExpenseGroups";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GroupCard } from "@/components/groups/GroupCard";
import { Plus, Users, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function GroupExpenses() {
  const { user, loading: authLoading } = useAuth();
  const { groups, loading } = useExpenseGroups();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <EmptyState
          icon={Users}
          title="Sign in to use groups"
          description="Create an account to start splitting expenses with friends"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 pb-20">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Group Expenses</h1>
          <Button onClick={() => navigate("/groups/new")} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Group
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No groups yet"
            description="Create a group to split expenses with friends, roommates, or travel buddies"
            action={{ label: "Create Group", onClick: () => navigate("/groups/new") }}
          />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                memberCount={0}
                totalExpenses={0}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
