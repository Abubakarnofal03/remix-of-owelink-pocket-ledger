import { useState } from "react";
import { X, Lightbulb } from "lucide-react";

interface FirstVisitTipProps {
  storageKey: string;
  message: string;
}

export function FirstVisitTip({ storageKey, message }: FirstVisitTipProps) {
  const key = `first_visit_tip_${storageKey}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === "true"; } catch { return false; }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(key, "true"); } catch {}
  };

  return (
    <div className="relative flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15 mb-4 animate-fade-in">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Lightbulb className="h-4 w-4 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed pr-6">{message}</p>
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Dismiss tip"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
