import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calculator, Delete, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MiniCalculatorProps {
  onInsert: (value: number) => void;
}

export function MiniCalculator({ onInsert }: MiniCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState("0");
  const [hasResult, setHasResult] = useState(false);

  const evaluate = useCallback((expr: string): string => {
    try {
      // Replace × and ÷ with JS operators
      const sanitized = expr.replace(/×/g, "*").replace(/÷/g, "/");
      // Only allow numbers, operators, dots, and parentheses
      if (!/^[0-9+\-*/. ]+$/.test(sanitized)) return "Error";
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== "number" || !isFinite(result)) return "Error";
      return parseFloat(result.toFixed(2)).toString();
    } catch {
      return "Error";
    }
  }, []);

  const currentResult = evaluate(expression);

  const handleNumber = (num: string) => {
    if (hasResult) {
      setExpression(num);
      setHasResult(false);
    } else {
      setExpression((prev) => (prev === "0" ? num : prev + num));
    }
  };

  const handleOperator = (op: string) => {
    setHasResult(false);
    const lastChar = expression.slice(-1);
    if (["+", "-", "×", "÷"].includes(lastChar)) {
      setExpression((prev) => prev.slice(0, -1) + op);
    } else {
      setExpression((prev) => prev + op);
    }
  };

  const handleEquals = () => {
    const result = evaluate(expression);
    if (result !== "Error") {
      setExpression(result);
      setHasResult(true);
    }
  };

  const handleClear = () => {
    setExpression("0");
    setHasResult(false);
  };

  const handleBackspace = () => {
    setExpression((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
    setHasResult(false);
  };

  const handleDecimal = () => {
    // Find the last number segment
    const parts = expression.split(/[+\-×÷]/);
    const lastPart = parts[parts.length - 1];
    if (!lastPart.includes(".")) {
      setExpression((prev) => prev + ".");
    }
  };

  const handleInsert = () => {
    const result = evaluate(expression);
    if (result !== "Error") {
      onInsert(parseFloat(result));
      setExpression("0");
      setHasResult(false);
      setOpen(false);
    }
  };

  const buttons = [
    ["7", "8", "9", "÷"],
    ["4", "5", "6", "×"],
    ["1", "2", "3", "-"],
    [".", "0", "⌫", "+"],
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          title="Calculator"
        >
          <Calculator className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end" side="top">
        <div className="space-y-2">
          {/* Display */}
          <div className="bg-muted rounded-lg p-3 text-right space-y-1">
            <p className="text-xs text-muted-foreground truncate font-mono">
              {expression}
            </p>
            <p className="text-xl font-bold font-mono truncate">
              {currentResult}
            </p>
          </div>

          {/* Buttons Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {/* Clear and Equals row */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="text-xs h-9"
              onClick={handleClear}
            >
              C
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs h-9 col-span-2 font-semibold"
              onClick={handleEquals}
            >
              =
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="text-xs h-9 font-semibold"
              onClick={handleInsert}
              disabled={currentResult === "Error"}
            >
              Use
            </Button>

            {/* Number pad */}
            {buttons.map((row, ri) =>
              row.map((btn) => {
                const isOperator = ["÷", "×", "-", "+"].includes(btn);
                const isBackspace = btn === "⌫";
                return (
                  <Button
                    key={`${ri}-${btn}`}
                    type="button"
                    variant={isOperator ? "secondary" : "outline"}
                    size="sm"
                    className="text-sm h-9 font-medium"
                    onClick={() => {
                      if (isBackspace) handleBackspace();
                      else if (isOperator) handleOperator(btn);
                      else if (btn === ".") handleDecimal();
                      else handleNumber(btn);
                    }}
                  >
                    {isBackspace ? <Delete className="h-4 w-4" /> : btn}
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
