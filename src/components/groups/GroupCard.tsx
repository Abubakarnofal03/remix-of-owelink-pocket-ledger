import { Card, CardContent } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Users, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ExpenseGroup } from "@/hooks/useExpenseGroups";

interface GroupCardProps {
  group: ExpenseGroup;
  memberCount: number;
  totalExpenses: number;
}

export function GroupCard({ group, memberCount, totalExpenses }: GroupCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => navigate(`/groups/${group.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{group.name}</p>
            {group.description && (
              <p className="text-xs text-muted-foreground truncate">{group.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <MoneyDisplay amount={totalExpenses} currency={group.currency} className="text-xs" />
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
