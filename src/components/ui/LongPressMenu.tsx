import { useState, useRef, useCallback, ReactNode } from "react";
import { hapticMedium } from "@/lib/haptics";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface LongPressAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface LongPressMenuProps {
  children: ReactNode;
  actions: LongPressAction[];
  title?: string;
  disabled?: boolean;
}

export function LongPressMenu({ children, actions, title, disabled }: LongPressMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    didLongPressRef.current = false;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      hapticMedium();
      setIsOpen(true);
    }, 500);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // Cancel if moved more than 10px (user is scrolling)
    if (dx > 10 || dy > 10) {
      clearTimer();
    }
  }, [clearTimer]);

  const handleTouchEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleAction = (action: LongPressAction) => {
    setIsOpen(false);
    // Small delay so sheet closes before action runs
    setTimeout(() => action.onClick(), 150);
  };

  return (
    <>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClickCapture={handleClick}
        className="touch-none-on-hold"
      >
        {children}
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          {title && (
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">{title}</SheetTitle>
            </SheetHeader>
          )}
          <div className="space-y-1 py-2">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => handleAction(action)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  action.variant === "destructive"
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground hover:bg-accent"
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
