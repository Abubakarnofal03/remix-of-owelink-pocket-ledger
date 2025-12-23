import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CURRENCY_SYMBOLS } from "@/lib/constants";

interface MoneyDisplayProps {
  amount: number;
  currency?: string;
  showSign?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const MoneyDisplay = memo(function MoneyDisplay({
  amount,
  currency = "USD",
  showSign = false,
  size = "md",
  className,
}: MoneyDisplayProps) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const isPositive = amount >= 0;
  const displayAmount = Math.abs(amount);

  const sizeClasses = useMemo(() => ({
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl font-semibold",
    xl: "text-3xl font-bold",
  }), []);

  const formattedAmount = useMemo(() => 
    displayAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }), 
    [displayAmount]
  );

  return (
    <span
      className={cn(
        "tabular-nums font-display",
        sizeClasses[size],
        showSign && (isPositive ? "money-positive" : "money-negative"),
        className
      )}
    >
      {showSign && (isPositive ? "+" : "-")}
      {symbol}
      {formattedAmount}
    </span>
  );
});
