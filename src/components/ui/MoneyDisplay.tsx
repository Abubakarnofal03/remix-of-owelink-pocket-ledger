import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { CURRENCY_SYMBOLS } from "@/lib/constants";

interface MoneyDisplayProps {
  amount: number;
  currency?: string;
  showSign?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const MoneyDisplay = forwardRef<HTMLSpanElement, MoneyDisplayProps>(
  function MoneyDisplay(
    { amount, currency = "USD", showSign = false, size = "md", className },
    ref
  ) {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    const isPositive = amount >= 0;
    const displayAmount = Math.abs(amount);

    const sizeClasses = {
      sm: "text-sm",
      md: "text-base",
      lg: "text-xl font-semibold",
      xl: "text-3xl font-bold",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "tabular-nums font-display",
          sizeClasses[size],
          showSign && (isPositive ? "money-positive" : "money-negative"),
          className
        )}
      >
        {showSign && (isPositive ? "+" : "-")}
        {symbol}
        {displayAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    );
  }
);
