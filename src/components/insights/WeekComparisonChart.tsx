import { useMemo } from "react";
import { useExpenses, Expense } from "@/hooks/useExpenses";
import { useAuth } from "@/hooks/useAuth";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowUpRight, ArrowDownLeft, Minus } from "lucide-react";

interface DayData {
  day: string;
  thisWeek: number;
  lastWeek: number;
}

function getWeekData(expenses: Expense[]): DayData[] {
  const now = new Date();
  const todayDay = now.getDay(); // 0=Sun
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - todayDay);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const data: DayData[] = days.map((day) => ({ day, thisWeek: 0, lastWeek: 0 }));

  for (const e of expenses) {
    const d = new Date(e.created_at);
    const dayIdx = d.getDay();

    if (d >= thisWeekStart) {
      data[dayIdx].thisWeek += e.amount;
    } else if (d >= lastWeekStart && d < thisWeekStart) {
      data[dayIdx].lastWeek += e.amount;
    }
  }

  return data.map((d) => ({
    ...d,
    thisWeek: Math.round(d.thisWeek * 100) / 100,
    lastWeek: Math.round(d.lastWeek * 100) / 100,
  }));
}

export function WeekComparisonChart() {
  const { expenses } = useExpenses();
  const { currency } = useAuth();

  const chartData = useMemo(() => getWeekData(expenses), [expenses]);

  const thisWeekTotal = useMemo(() => chartData.reduce((s, d) => s + d.thisWeek, 0), [chartData]);
  const lastWeekTotal = useMemo(() => chartData.reduce((s, d) => s + d.lastWeek, 0), [chartData]);
  const diff = thisWeekTotal - lastWeekTotal;
  const pct = lastWeekTotal > 0 ? Math.round((diff / lastWeekTotal) * 100) : thisWeekTotal > 0 ? 100 : 0;

  if (expenses.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-foreground">This Week vs Last Week</h2>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="card-elevated flex-1 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">This Week</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            <MoneyDisplay amount={thisWeekTotal} currency={currency} />
          </p>
        </div>
        <div className="card-elevated flex-1 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Week</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            <MoneyDisplay amount={lastWeekTotal} currency={currency} />
          </p>
        </div>
        <div className="card-elevated flex-1 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Change</p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            {diff > 0 ? (
              <ArrowUpRight className="h-3 w-3 text-rose-500" />
            ) : diff < 0 ? (
              <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
            ) : (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            <span
              className={`text-sm font-bold ${
                diff > 0
                  ? "text-rose-500"
                  : diff < 0
                  ? "text-emerald-500"
                  : "text-muted-foreground"
              }`}
            >
              {pct}%
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card-elevated p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number) => [value.toFixed(2), ""]}
            />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}
            />
            <Bar dataKey="thisWeek" name="This Week" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lastWeek" name="Last Week" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
