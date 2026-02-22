import { useRef, useCallback, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { hapticMedium, hapticLight } from "@/lib/haptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const isRefreshing = useRef(false);
  const hasTriggeredHaptic = useRef(false);
  const pullDistanceRef = useRef(0);

  const THRESHOLD = 60;

  // Update DOM directly without triggering React re-renders
  const updateVisuals = useCallback((distance: number) => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translateY(${distance}px)`;
      contentRef.current.style.transition = distance === 0 ? 'transform 0.2s ease-out' : 'none';
    }
    if (indicatorRef.current) {
      indicatorRef.current.style.top = `${distance - 40}px`;
      indicatorRef.current.style.opacity = distance > 5 ? '1' : '0';
      const spinner = indicatorRef.current.querySelector('.pull-spinner') as HTMLElement;
      if (spinner && !isRefreshing.current) {
        const progress = Math.min(distance / THRESHOLD, 1);
        spinner.style.transform = `rotate(${progress * 360}deg)`;
      }
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing.current) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
    hasTriggeredHaptic.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing.current) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      // User is scrolling content normally - disengage pull-to-refresh
      isPulling.current = false;
      if (pullDistanceRef.current > 0) {
        pullDistanceRef.current = 0;
        updateVisuals(0);
      }
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 10) {
      // Only prevent default when we're actually pulling down (not just scrolling)
      e.preventDefault();
      const distance = Math.min(diff * 0.5, 100);
      pullDistanceRef.current = distance;
      updateVisuals(distance);
      
      // Haptic when crossing threshold
      if (distance >= THRESHOLD && !hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = true;
        hapticLight();
      } else if (distance < THRESHOLD && hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = false;
      }
    } else if (diff < 0) {
      // User is scrolling up - disengage
      isPulling.current = false;
      if (pullDistanceRef.current > 0) {
        pullDistanceRef.current = 0;
        updateVisuals(0);
      }
    }
  }, [updateVisuals]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    
    if (pullDistanceRef.current >= THRESHOLD && !isRefreshing.current) {
      hapticMedium();
      isRefreshing.current = true;
      pullDistanceRef.current = THRESHOLD;
      updateVisuals(THRESHOLD);
      
      // Add spin animation
      const spinner = indicatorRef.current?.querySelector('.pull-spinner') as HTMLElement;
      if (spinner) spinner.classList.add('animate-spin');
      
      try {
        await onRefresh();
      } finally {
        isRefreshing.current = false;
        pullDistanceRef.current = 0;
        updateVisuals(0);
        if (spinner) spinner.classList.remove('animate-spin');
      }
    } else {
      pullDistanceRef.current = 0;
      updateVisuals(0);
    }
  }, [onRefresh, updateVisuals]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        ref={indicatorRef}
        className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none"
        style={{ top: -40, opacity: 0, transition: 'opacity 0.2s' }}
      >
        <div className="h-10 w-10 rounded-full bg-background border border-border shadow-md flex items-center justify-center">
          <Loader2 className="pull-spinner h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
}
