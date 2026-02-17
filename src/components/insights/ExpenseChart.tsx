import { useMemo, useState } from "react";
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
  AreaChart,
  Area,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type Period = "7d" | "30d" | "12w" | "6m";

interface ChartData {
  label: string;
  total: number;
}

function groupExpenses(expenses: Expense[], period: Period): ChartData[] {
  const now = new Date();
  const map = new Map<string, number>();

  if (period === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { weekday: "short" });
      map.set(key, 0);
    }
    for (const e of expenses) {
      const d = new Date(e.created_at);
      if (now.getTime() - d.getTime() <= 7 * 86400000) {
        const key = d.toLocaleDateString("en-US", { weekday: "short" });
        map.set(key, (map.get(key) || 0) + e.amount);
      }
    }
  } else if (period === "30d") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      map.set(key, 0);
    }
    for (const e of expenses) {
      const d = new Date(e.created_at);
      if (now.getTime() - d.getTime() <= 30 * 86400000) {
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        map.set(key, (map.get(key) || 0) + e.amount);
      }
    }
  } else if (period === "12w") {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i * 7);
      const key = `W${12 - i}`;
      map.set(key, 0);
    }
    for (const e of expenses) {
      const d = new Date(e.created_at);
      const weeksAgo = Math.floor((now.getTime() - d.getTime()) / (7 * 86400000));
      if (weeksAgo < 12) {
        const key = `W${12 - weeksAgo}`;
        map.set(key, (map.get(key) || 0) + e.amount);
      }
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("en-US", { month: "short" });
      map.set(key, 0);
    }
    for (const e of expenses) {
      const d = new Date(e.created_at);
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        const key = d.toLocaleDateString("en-US", { month: "short" });
        map.set(key, (map.get(key) || 0) + e.amount);
      }
    }
  }

  return Array.from(map.entries()).map(([label, total]) => ({ label, total: Math.round(total * 100) / 100 }));
}

const periods: { value: Period; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "12w", label: "12 Weeks" },
  { value: "6m", label: "6 Months" },
];

export function ExpenseChart() {
  const { expenses } = useExpenses();
  const { currency } = useAuth();
  const [period, setPeriod] = useState<Period>("7d");
  const [chartType, setChartType] = useState<"bar" | "area">("bar");

  const chartData = useMemo(() => groupExpenses(expenses, period), [expenses, period]);
  const periodTotal = useMemo(() => chartData.reduce((s, d) => s + d.total, 0), [chartData]);
  const avg = useMemo(() => {
    const nonZero = chartData.filter(d => d.total > 0).length || 1;
    return Math.round((periodTotal / nonZero) * 100) / 100;
  }, [chartData, periodTotal]);

  if (expenses.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Spending Overview</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setChartType(t => (t === "bar" ? "area" : "bar"))}
        >
          {chartType === "bar" ? <TrendingUp className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5">
        {periods.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex gap-3">
        <div className="card-elevated flex-1 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            <MoneyDisplay amount={periodTotal} currency={currency} />
          </p>
        </div>
        <div className="card-elevated flex-1 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Average</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            <MoneyDisplay amount={avg} currency={currency} />
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="card-elevated p-4">
        <ResponsiveContainer width="100%" height={200}>
          {chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={period === "30d" ? 4 : 0}
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
                formatter={(value: number) => [value.toFixed(2), "Spent"]}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={period === "30d" ? 4 : 0}
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
                formatter={(value: number) => [value.toFixed(2), "Spent"]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#expFill)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
