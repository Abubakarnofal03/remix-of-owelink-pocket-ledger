import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { TourStep } from "@/hooks/useOnboarding";
import { cn } from "@/lib/utils";

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

  // Find and highlight the target element
  useEffect(() => {
    if (!step.target) {
      setHighlightRect(null);
      // Center the popover
      setPopoverStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const updatePosition = () => {
      const el = document.querySelector(step.target!);
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
      const padding = 8;
      const highlight: HighlightRect = {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      };
      setHighlightRect(highlight);

      // Calculate popover position
      const popoverWidth = 320;
      const popoverHeight = 200;
      const gap = 16;

      let style: React.CSSProperties = {};
      const pos = step.position || "bottom";

      if (pos === "bottom") {
        style = {
          top: highlight.top + highlight.height + gap,
          left: Math.max(16, Math.min(highlight.left + highlight.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 16)),
        };
      } else if (pos === "top") {
        style = {
          top: Math.max(16, highlight.top - popoverHeight - gap),
          left: Math.max(16, Math.min(highlight.left + highlight.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 16)),
        };
      } else {
        style = {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        };
      }

      setPopoverStyle(style);

      // Scroll element into view
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // Wait for DOM to be ready
    const timer = setTimeout(updatePosition, 200);
    window.addEventListener("resize", updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
    };
  }, [step]);

  const isClickStep = step.action === "click" && step.nextOnClick;
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
      {/* Overlay with hole */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "auto" }}
        onClick={(e) => {
          // Don't block clicks on the highlighted element
          if (highlightRect) {
            const x = e.clientX;
            const y = e.clientY;
            if (
              x >= highlightRect.left &&
              x <= highlightRect.left + highlightRect.width &&
              y >= highlightRect.top &&
              y <= highlightRect.top + highlightRect.height
            ) {
              return;
            }
          }
          // Block all other clicks
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlightRect && (
              <rect
                x={highlightRect.left}
                y={highlightRect.top}
                width={highlightRect.width}
                height={highlightRect.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#tour-mask)"
        />
      </svg>

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

      {/* Make highlighted element clickable */}
      {highlightRect && (
        <div
          className="absolute"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            pointerEvents: "auto",
            zIndex: 10000,
            cursor: isClickStep ? "pointer" : "default",
          }}
        />
      )}

      {/* Popover */}
      <div
        ref={popoverRef}
        className="absolute w-[320px] max-w-[calc(100vw-32px)] bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-3 animate-fade-in"
        style={{ ...popoverStyle, pointerEvents: "auto", zIndex: 10001 }}
      >
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
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
            className="h-6 w-6 -mr-1"
            onClick={onSkip}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div>
          <h3 className="font-display font-bold text-base text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
        </div>

        {/* Action hint for click steps */}
        {isClickStep && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            <span className="text-xs font-medium text-primary">Tap the highlighted button to continue</span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <Button variant="ghost" size="sm" onClick={onPrev} className="gap-1">
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground gap-1">
            <SkipForward className="h-3.5 w-3.5" />
            Skip
          </Button>
          {!isClickStep && (
            <Button size="sm" onClick={onNext} className="gap-1">
              {stepIndex === totalSteps - 1 ? "Done ✓" : "Next"}
              {stepIndex < totalSteps - 1 && <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
