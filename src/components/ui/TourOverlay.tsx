import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { TourStep } from "@/hooks/useOnboarding";

interface TourOverlayProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: TourOverlayProps) {
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!step.target) {
      setHighlightRect(null);
      setPopoverStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      setHighlightRect(null);
      setPopoverStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 6;
    const highlight: HighlightRect = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
    setHighlightRect(highlight);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const popoverW = Math.min(300, vw - margin * 2);
    const gap = 12;
    const popoverH = popoverRef.current?.offsetHeight || 180;

    const pos = step.position || "bottom";
    let style: React.CSSProperties = { width: popoverW };

    const centerX = Math.max(margin, Math.min(
      highlight.left + highlight.width / 2 - popoverW / 2,
      vw - popoverW - margin
    ));

    const spaceBelow = vh - (highlight.top + highlight.height + gap);
    const spaceAbove = highlight.top - gap;

    if (pos === "bottom" && spaceBelow >= popoverH) {
      style.top = highlight.top + highlight.height + gap;
      style.left = centerX;
    } else if (pos === "top" && spaceAbove >= popoverH) {
      style.top = highlight.top - popoverH - gap;
      style.left = centerX;
    } else if (spaceBelow >= popoverH) {
      style.top = highlight.top + highlight.height + gap;
      style.left = centerX;
    } else if (spaceAbove >= popoverH) {
      style.top = highlight.top - popoverH - gap;
      style.left = centerX;
    } else {
      style.bottom = margin;
      style.left = centerX;
    }

    setPopoverStyle(style);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [step]);

  useEffect(() => {
    const timer = setTimeout(updatePosition, 200);
    window.addEventListener("resize", updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (popoverRef.current) {
      const timer = setTimeout(updatePosition, 300);
      return () => clearTimeout(timer);
    }
  }, [stepIndex, updatePosition]);

  const isClickStep = step.action === "click" && step.nextOnClick;
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  // Build 4 overlay regions around the highlight hole so clicks pass through to the actual element
  const overlayColor = "rgba(0,0,0,0.7)";
  const vw = "100vw";
  const vh = "100vh";

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
      {highlightRect ? (
        <>
          {/* Top region */}
          <div
            style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: Math.max(0, highlightRect.top),
              background: overlayColor,
              pointerEvents: "auto",
            }}
          />
          {/* Bottom region */}
          <div
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              top: highlightRect.top + highlightRect.height,
              background: overlayColor,
              pointerEvents: "auto",
            }}
          />
          {/* Left region */}
          <div
            style={{
              position: "absolute",
              top: highlightRect.top,
              left: 0,
              width: Math.max(0, highlightRect.left),
              height: highlightRect.height,
              background: overlayColor,
              pointerEvents: "auto",
            }}
          />
          {/* Right region */}
          <div
            style={{
              position: "absolute",
              top: highlightRect.top,
              left: highlightRect.left + highlightRect.width,
              right: 0,
              height: highlightRect.height,
              background: overlayColor,
              pointerEvents: "auto",
            }}
          />
        </>
      ) : (
        /* No highlight - full overlay */
        <div
          style={{
            position: "absolute", inset: 0,
            background: overlayColor,
            pointerEvents: "auto",
          }}
        />
      )}

      {/* Highlight border glow */}
      {highlightRect && (
        <div
          className="absolute rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-transparent animate-pulse"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Popover */}
      <div
        ref={popoverRef}
        className="absolute max-w-[calc(100vw-24px)] bg-card border border-border rounded-2xl shadow-2xl p-3 space-y-2.5 animate-fade-in"
        style={{ ...popoverStyle, pointerEvents: "auto", zIndex: 10001 }}
      >
        {/* Progress bar */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
            {stepIndex + 1}/{totalSteps}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 -mr-0.5"
            onClick={onSkip}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Content */}
        <div>
          <h3 className="font-display font-bold text-sm text-foreground leading-tight">{step.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
        </div>

        {/* Action hint for click steps */}
        {isClickStep && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[11px] font-medium text-primary">Tap the highlighted area to continue</span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-1.5">
          {stepIndex > 0 && (
            <Button variant="ghost" size="sm" onClick={onPrev} className="gap-0.5 h-7 px-2 text-xs">
              <ChevronLeft className="h-3 w-3" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground gap-0.5 h-7 px-2 text-xs">
            <SkipForward className="h-3 w-3" />
            Skip
          </Button>
          {!isClickStep && (
            <Button size="sm" onClick={onNext} className="gap-0.5 h-7 px-2.5 text-xs">
              {stepIndex === totalSteps - 1 ? "Done ✓" : "Next"}
              {stepIndex < totalSteps - 1 && <ChevronRight className="h-3 w-3" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
