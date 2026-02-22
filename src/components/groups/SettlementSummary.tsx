import { Card, CardContent } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Settlement } from "@/lib/debtSimplification";
import { ExpenseGroupMember } from "@/hooks/useExpenseGroups";

interface SettlementSummaryProps {
  settlements: Settlement[];
  members: ExpenseGroupMember[];
  currency: string;
  hasExpenses?: boolean;
}

export function SettlementSummary({ settlements, members, currency, hasExpenses = false }: SettlementSummaryProps) {
  const getMemberName = (id: string) => {
    const member = members.find(m => m.id === id);
    return member?.nickname || member?.phone_number || 'Unknown';
  };

  if (settlements.length === 0) {
    if (!hasExpenses) return null;
    return (
      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">All settled up! No payments needed.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Settlement Summary</h3>
      {settlements.map((s, i) => (
        <Card key={i}>
          <CardContent className="p-3 flex items-center gap-3">
            <span className="font-medium text-sm text-foreground truncate">{getMemberName(s.from)}</span>
            <div className="flex items-center gap-1 shrink-0">
              <ArrowRight className="h-4 w-4 text-primary" />
              <MoneyDisplay amount={s.amount} currency={currency} className="text-sm font-semibold text-primary" />
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-sm text-foreground truncate">{getMemberName(s.to)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
