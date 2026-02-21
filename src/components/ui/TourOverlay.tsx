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
  const [measured, setMeasured] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const measurePassRef = useRef(0);

  const computePosition = useCallback((highlight: HighlightRect | null, popoverH: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const popoverW = Math.min(280, vw - 24);
    const gap = 12;
    const safeBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0', 10) || 0;

    if (!highlight) {
      // Center position — use measured height
      const top = Math.max(margin, (vh - popoverH) / 2);
      return {
        top,
        left: (vw - popoverW) / 2,
        width: popoverW,
      } as React.CSSProperties;
    }

    // Determine effective position
    let pos = step.position || "bottom";
    // Force top for bottom-nav targets
    if (highlight.top + highlight.height > vh - 100) {
      pos = "top";
    }

    const centerX = Math.max(margin, Math.min(
      highlight.left + highlight.width / 2 - popoverW / 2,
      vw - popoverW - margin
    ));

    const spaceBelow = vh - (highlight.top + highlight.height + gap) - safeBottom;
    const spaceAbove = highlight.top - gap;

    let top: number;

    if (pos === "top" && spaceAbove >= popoverH) {
      top = highlight.top - popoverH - gap;
    } else if (pos === "bottom" && spaceBelow >= popoverH) {
      top = highlight.top + highlight.height + gap;
    } else if (spaceAbove >= spaceBelow) {
      top = highlight.top - popoverH - gap;
    } else {
      top = highlight.top + highlight.height + gap;
    }

    // Clamp to screen bounds
    top = Math.max(margin, Math.min(top, vh - popoverH - margin - safeBottom));
    const left = Math.max(margin, Math.min(centerX, vw - popoverW - margin));

    return { top, left, width: popoverW } as React.CSSProperties;
  }, [step.position]);

  const updatePosition = useCallback(() => {
    if (!step.target) {
      setHighlightRect(null);
      const popoverH = popoverRef.current?.offsetHeight || 180;
      setPopoverStyle(computePosition(null, popoverH));
      setMeasured(true);
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      setHighlightRect(null);
      const popoverH = popoverRef.current?.offsetHeight || 180;
      setPopoverStyle(computePosition(null, popoverH));
      setMeasured(true);
      return;
    }

    // Scroll into view first, then measure after scroll settles
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const padding = 6;
      const highlight: HighlightRect = {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      };
      setHighlightRect(highlight);

      // First pass: render invisibly to measure
      const popoverH = popoverRef.current?.offsetHeight || 180;
      setPopoverStyle(computePosition(highlight, popoverH));
      setMeasured(true);

      // Second pass: re-measure after render
      requestAnimationFrame(() => {
        const actualH = popoverRef.current?.offsetHeight || popoverH;
        if (actualH !== popoverH) {
          setPopoverStyle(computePosition(highlight, actualH));
        }
      });
    }, 350);
  }, [step, computePosition]);

  // Reset measured state on step change
  useEffect(() => {
    setMeasured(false);
    measurePassRef.current += 1;
  }, [stepIndex]);

  useEffect(() => {
    const timer = setTimeout(updatePosition, 200);
    window.addEventListener("resize", updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition]);

  // Re-measure after popover renders with content
  useEffect(() => {
    if (popoverRef.current && measured) {
      const timer = setTimeout(() => {
        const actualH = popoverRef.current?.offsetHeight;
        if (actualH) {
          const highlight = highlightRect;
          setPopoverStyle(computePosition(highlight, actualH));
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [measured, stepIndex, highlightRect, computePosition]);

  const isClickStep = step.action === "click" && step.nextOnClick;
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  const overlayColor = "rgba(0,0,0,0.7)";

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
        className="absolute bg-card border border-border rounded-2xl shadow-2xl p-3 space-y-2.5 animate-fade-in"
        style={{
          ...popoverStyle,
          maxWidth: "calc(100vw - 24px)",
          pointerEvents: "auto",
          zIndex: 10001,
          opacity: measured ? 1 : 0,
          transition: "opacity 0.15s ease-in",
        }}
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
